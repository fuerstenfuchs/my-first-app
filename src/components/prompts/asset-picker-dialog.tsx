'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Check, ImageOff, Search, ArrowLeft } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { loadRefImages, type RefImage } from '@/lib/reference-images'
import { ROLLEN_LABEL, type ReferenzRolle } from '@/lib/image-generation'
import { cn } from '@/lib/utils'

export type PickbaresAsset = {
  id: string
  name: string
  cover_image_url?: string | null
  category?: string | null
}

interface AssetPickerDialogProps {
  isOpen: boolean
  onClose: () => void
  rolle: ReferenzRolle
  assets: PickbaresAsset[]
  /** Liefert Asset und gewähltes Bild zurück; Bild ist null, wenn das Titelbild genügt. */
  onFertig: (asset: PickbaresAsset, bild: RefImage | null) => void
}

/**
 * Auswahl über Bilder statt über Namen.
 *
 * Der erste Entwurf war eine Sucheingabe mit kleiner Trefferliste. Beim ersten
 * echten Einsatz zeigte sich: Man muss erst einen Buchstaben tippen, um
 * überhaupt etwas zu sehen, die Zeilen sind winzig — und bei Outfits kennt man
 * die Namen gar nicht, man erkennt sie am Bild. Deshalb: alles sofort sichtbar,
 * groß, als Galerie. Das Suchfeld ist nur noch die Abkürzung bei vielen
 * Einträgen, nicht mehr die Voraussetzung.
 */
export function AssetPickerDialog({
  isOpen, onClose, rolle, assets, onFertig,
}: AssetPickerDialogProps) {
  const [gewaehlt, setGewaehlt] = useState<PickbaresAsset | null>(null)
  const [bilder, setBilder] = useState<RefImage[]>([])
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [suche, setSuche] = useState('')

  const tabelle = rolle === 'character' ? 'character_variants'
    : rolle === 'outfit' ? 'outfit_variants' : 'location_variants'
  const fk = rolle === 'character' ? 'character_id'
    : rolle === 'outfit' ? 'outfit_id' : 'location_id'

  const bilderLaden = useCallback(async (assetId: string) => {
    setLaedt(true); setFehler(null)
    try {
      setBilder(await loadRefImages(tabelle, fk, assetId))
    } catch (e) {
      setBilder([]); setFehler((e as Error).message)
    } finally {
      setLaedt(false)
    }
  }, [tabelle, fk])

  // Beim Öffnen zurück auf Schritt 1
  useEffect(() => {
    if (isOpen) { setGewaehlt(null); setBilder([]); setSuche(''); setFehler(null) }
  }, [isOpen])

  const gefiltert = useMemo(() => {
    if (!suche.trim()) return assets
    const s = suche.toLowerCase()
    return assets.filter(a =>
      a.name.toLowerCase().includes(s) || (a.category ?? '').toLowerCase().includes(s))
  }, [assets, suche])

  function assetWaehlen(a: PickbaresAsset) {
    setGewaehlt(a)
    void bilderLaden(a.id)
  }

  function abschliessen(bild: RefImage | null) {
    if (!gewaehlt) return
    onFertig(gewaehlt, bild)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={o => !o && onClose()}>
      <DialogContent className="flex max-h-[85svh] max-w-3xl flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            {gewaehlt && (
              <Button
                size="icon" variant="ghost" className="h-6 w-6"
                onClick={() => { setGewaehlt(null); setBilder([]) }}
                aria-label="Zurück zur Übersicht"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {gewaehlt ? `${gewaehlt.name} — Bild wählen` : `${ROLLEN_LABEL[rolle]} wählen`}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {gewaehlt
              ? 'Welches Bild soll als Referenz mitgehen?'
              : `${assets.length} Einträge — anklicken genügt.`}
          </DialogDescription>
        </DialogHeader>

        {/* Schritt 1: das Asset */}
        {!gewaehlt && (
          <>
            {assets.length > 8 && (
              <div className="relative shrink-0">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={suche}
                  onChange={e => setSuche(e.target.value)}
                  placeholder="Nach Name oder Kategorie einschränken (optional)"
                  className="h-8 pl-7 text-xs"
                />
              </div>
            )}

            <div className="grid flex-1 grid-cols-3 gap-3 overflow-y-auto pr-1 sm:grid-cols-4 md:grid-cols-5">
              {gefiltert.length === 0 ? (
                <p className="col-span-full py-8 text-center text-xs text-muted-foreground">
                  Nichts gefunden.
                </p>
              ) : gefiltert.map(a => (
                <button
                  key={a.id}
                  onClick={() => assetWaehlen(a)}
                  className="group overflow-hidden rounded-lg border border-border/60 bg-card text-left transition hover:border-emerald-600/60 hover:ring-1 hover:ring-emerald-600/30"
                >
                  <div className="aspect-[3/4] w-full overflow-hidden bg-muted/30">
                    {a.cover_image_url ? (
                      <img
                        src={a.cover_image_url} alt={a.name} loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground/40">
                        <ImageOff className="h-6 w-6" />
                        <span className="text-[9px]">kein Bild</span>
                      </div>
                    )}
                  </div>
                  <div className="p-1.5">
                    <p className="truncate text-[11px] font-medium leading-tight">{a.name}</p>
                    {a.category && (
                      <p className="truncate text-[9px] text-muted-foreground">{a.category}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Schritt 2: das konkrete Bild */}
        {gewaehlt && (
          <div className="flex-1 overflow-y-auto pr-1">
            {laedt ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Bilder werden geladen…</p>
            ) : fehler ? (
              <p className="py-8 text-center text-xs text-destructive">
                Bilder konnten nicht geladen werden: {fehler}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {/* Das Titelbild ist immer wählbar — es ist der Normalfall. */}
                {gewaehlt.cover_image_url && (
                  <button
                    onClick={() => abschliessen(null)}
                    className="group overflow-hidden rounded-lg border-2 border-emerald-600/40 bg-card text-left transition hover:border-emerald-500"
                  >
                    <div className="aspect-[3/4] w-full overflow-hidden bg-muted/30">
                      <img
                        src={gewaehlt.cover_image_url} alt="Titelbild"
                        className="h-full w-full object-cover transition group-hover:scale-[1.04]"
                      />
                    </div>
                    <p className="p-1.5 text-[10px] font-medium text-emerald-400">
                      <Check className="mr-0.5 inline h-2.5 w-2.5" />Titelbild
                    </p>
                  </button>
                )}

                {bilder.map(b => (
                  <button
                    key={b.url}
                    onClick={() => abschliessen(b)}
                    className="group overflow-hidden rounded-lg border border-border/60 bg-card text-left transition hover:border-emerald-600/60 hover:ring-1 hover:ring-emerald-600/30"
                  >
                    <div className="aspect-[3/4] w-full overflow-hidden bg-muted/30">
                      <img
                        src={b.url} alt={b.label} loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-[1.04]"
                      />
                    </div>
                    <p className="truncate p-1.5 text-[10px] leading-tight text-muted-foreground">
                      {b.label}
                    </p>
                  </button>
                ))}

                {!gewaehlt.cover_image_url && bilder.length === 0 && (
                  <p className="col-span-full py-8 text-center text-xs text-amber-500">
                    Dieser Eintrag hat kein einziges Bild — er kann nicht als Referenz dienen.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

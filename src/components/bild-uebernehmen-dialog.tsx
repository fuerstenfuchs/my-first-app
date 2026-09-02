'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { ImageOff, Search, Loader2, Check } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { BAUSTEINE, baustein, type BausteinSchluessel } from '@/lib/bausteine'
import { useBildUebernehmen, type Eintrag, type Variante } from '@/hooks/use-bild-uebernehmen'
import { cn } from '@/lib/utils'

/**
 * „Übernehmen nach …" — ein fertiges Bild in eine Bibliothek legen.
 *
 * Ersetzt sieben Handgriffe über drei Bildschirme: herunterladen, zur
 * Bibliothek wechseln, Eintrag suchen, Variante wählen, hochladen, beschriften.
 *
 * AUSWAHL ÜBER BILDER, NICHT ÜBER NAMEN. Dieselbe Lehre wie beim
 * Referenz-Auswahldialog: Mark kennt die Namen seiner Outfits nicht, er
 * erkennt sie am Bild. Ein Suchfeld ist die Abkürzung bei vielen Einträgen,
 * nicht die Voraussetzung, um überhaupt etwas zu sehen.
 */

interface Props {
  offen: boolean
  onClose: () => void
  /**
   * Adresse UND Speicherpfad des Bildes. Der Pfad wird als Notiz gespeichert,
   * weil die Adresse einen wechselnden Cache-Brecher trägt.
   */
  bild: { url: string; pfad: string } | null
  /** Wird nach erfolgreicher Übernahme gerufen. */
  onFertig?: () => void
}

export function BildUebernehmenDialog({ offen, onClose, bild, onFertig }: Props) {
  const { laeuft, eintraegeLaden, variantenLaden, uebernehmen } = useBildUebernehmen()

  const [art, setArt] = useState<BausteinSchluessel>('charaktere')
  const [eintraege, setEintraege] = useState<Eintrag[]>([])
  const [laedt, setLaedt] = useState(false)
  const [suche, setSuche] = useState('')
  const [gewaehlt, setGewaehlt] = useState<Eintrag | null>(null)
  const [varianten, setVarianten] = useState<Variante[]>([])
  const [variantId, setVariantId] = useState<string | null>(null)

  const b = baustein(art)

  // Beim Öffnen und bei jedem Wechsel der Art neu laden.
  useEffect(() => {
    if (!offen) return
    let abgebrochen = false
    setLaedt(true)
    setGewaehlt(null)
    setVarianten([])
    setVariantId(null)
    void eintraegeLaden(b).then(liste => {
      if (!abgebrochen) { setEintraege(liste); setLaedt(false) }
    })
    return () => { abgebrochen = true }
  }, [offen, art, b, eintraegeLaden])

  // Varianten erst holen, wenn ein Eintrag gewählt ist.
  useEffect(() => {
    if (!gewaehlt) return
    let abgebrochen = false
    void variantenLaden(b, gewaehlt.id).then(liste => {
      if (abgebrochen) return
      setVarianten(liste)
      // Hat der Eintrag nur eine Variante, ist die Wahl keine Frage. Gibt es
      // gar keine (Archetypen, Prompts), bleibt es null — dort hängt das Bild
      // direkt am Eintrag.
      setVariantId(liste[0]?.id ?? null)
    })
    return () => { abgebrochen = true }
  }, [gewaehlt, b, variantenLaden])

  const gefiltert = useMemo(() => {
    const s = suche.trim().toLowerCase()
    return s ? eintraege.filter(e => e.name.toLowerCase().includes(s)) : eintraege
  }, [eintraege, suche])

  const bestaetigen = useCallback(async () => {
    if (!bild || !gewaehlt) return
    // Ein Baustein MIT Varianten braucht eine gewählte; einer ohne nicht.
    if (b.varianten && !variantId) return
    const ok = await uebernehmen(bild.url, bild.pfad, {
      baustein: art,
      parentId: gewaehlt.id,
      parentName: gewaehlt.name,
      variantId,
    })
    if (ok) { onFertig?.(); onClose() }
  }, [bild, gewaehlt, variantId, art, b, uebernehmen, onFertig, onClose])

  const bereit = !!gewaehlt && (!b.varianten || !!variantId) && !laeuft

  return (
    <Dialog open={offen} onOpenChange={o => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-3 overflow-hidden">
        <DialogHeader className="space-y-1">
          <DialogTitle>Bild übernehmen</DialogTitle>
          <DialogDescription className="text-xs">
            Das Bild wird in den Speicher des Bausteins kopiert. Es bleibt dort,
            auch wenn Du den Auftrag später löschst. Das Titelbild bleibt unverändert.
          </DialogDescription>
        </DialogHeader>

        {/* Wohin — neun Ziele in drei Reihen, immer sichtbar. Reihe 1 und 2 sind
            die Bibliotheken und die Prompts, Reihe 3 die Archetypen. */}
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-3">
          {BAUSTEINE.map(eintrag => {
            const Icon = eintrag.icon
            const aktiv = eintrag.schluessel === art
            return (
              <button
                key={eintrag.schluessel}
                onClick={() => setArt(eintrag.schluessel)}
                aria-pressed={aktiv}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[11px] transition',
                  aktiv
                    ? 'border-primary bg-primary/10 font-medium text-primary'
                    : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {eintrag.label}
              </button>
            )
          })}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={suche}
            onChange={e => setSuche(e.target.value)}
            placeholder={`${b.einzahl} suchen …`}
            className="h-8 pl-8 text-xs"
          />
        </div>

        {/* Die Galerie */}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border/50 p-2">
          {laedt ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded bg-muted/40" />
              ))}
            </div>
          ) : gefiltert.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              {eintraege.length === 0
                ? `Noch keine ${b.label} angelegt.`
                : `Kein Treffer für „${suche}".`}
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {gefiltert.map(e => {
                const aktiv = gewaehlt?.id === e.id
                return (
                  <button
                    key={e.id}
                    onClick={() => setGewaehlt(e)}
                    aria-pressed={aktiv}
                    className={cn(
                      'group relative overflow-hidden rounded border text-left transition',
                      aktiv ? 'border-primary ring-1 ring-primary' : 'border-border/50 hover:border-border',
                    )}
                  >
                    <div className="aspect-[3/4] bg-muted/30">
                      {e.cover_image_url ? (
                        <img
                          src={e.cover_image_url} alt={e.name} loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ImageOff className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    <span className="block truncate px-1.5 py-1 text-[10px] leading-tight">
                      {e.name}
                    </span>
                    {aktiv && (
                      <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Variante — nur wenn es überhaupt eine Wahl gibt */}
        {gewaehlt && b.varianten && varianten.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">Variante</span>
            <Select value={variantId ?? ''} onValueChange={setVariantId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {varianten.map(v => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {gewaehlt && b.varianten && varianten.length === 0 && (
          <p className="text-xs text-destructive">
            „{gewaehlt.name}" hat noch keine Variante — dort lässt sich kein Bild ablegen.
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={laeuft}>
            Abbrechen
          </Button>
          <Button size="sm" onClick={() => void bestaetigen()} disabled={!bereit}>
            {laeuft && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {gewaehlt ? `Nach „${gewaehlt.name}" übernehmen` : 'Übernehmen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

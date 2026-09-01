'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Send, X, ImagePlus, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useCharacters } from '@/hooks/use-characters'
import { useOutfits } from '@/hooks/use-outfits'
import { useLocations } from '@/hooks/use-locations'
import { useImageJobs } from '@/hooks/use-image-jobs'
import { loadRefImages, type RefImage } from '@/lib/reference-images'
import {
  MODELLE, DURCHLAEUFE, groesseFuerFormat, promptFuerAuftrag, referenzZuordnung,
  ROLLEN_LABEL,
  type ModellId, type Durchlaeufe, type ReferenzRolle,
} from '@/lib/image-generation'
import { ASPECT_RATIOS, type AspectRatioKey } from '@/lib/scene-builder-options'
import { cn } from '@/lib/utils'

interface PromptToImageDialogProps {
  isOpen: boolean
  onClose: () => void
  prompt: string
  titel?: string | null
  /** Charakter vorauswählen — für den Weg aus einem Charakter-Sheet heraus. */
  vorauswahlCharakter?: { id: string; name: string; cover_image_url?: string | null } | null
}

type AssetLeicht = { id: string; name: string; cover_image_url?: string | null }

/** Eine Zeile im Dialog: Bibliothek wählen, dann das konkrete Bild. */
function ReferenzWahl({
  rolle, assets, gewaehlt, onWaehlen, bild, onBildWaehlen,
}: {
  rolle: ReferenzRolle
  assets: AssetLeicht[]
  gewaehlt: AssetLeicht | null
  onWaehlen: (a: AssetLeicht | null) => void
  bild: RefImage | null
  onBildWaehlen: (b: RefImage | null) => void
}) {
  const [bilder, setBilder] = useState<RefImage[]>([])
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [suche, setSuche] = useState('')

  const tabelle = rolle === 'character' ? 'character_variants'
    : rolle === 'outfit' ? 'outfit_variants' : 'location_variants'
  const fk = rolle === 'character' ? 'character_id'
    : rolle === 'outfit' ? 'outfit_id' : 'location_id'

  const bilderLaden = useCallback(async (assetId: string) => {
    setLaedt(true)
    setFehler(null)
    try {
      setBilder(await loadRefImages(tabelle, fk, assetId))
    } catch (e) {
      setBilder([])
      setFehler((e as Error).message)
    } finally {
      setLaedt(false)
    }
  }, [tabelle, fk])

  useEffect(() => {
    if (!gewaehlt) { setBilder([]); return }
    void bilderLaden(gewaehlt.id)
  }, [gewaehlt, bilderLaden])

  const gefiltert = suche
    ? assets.filter(a => a.name.toLowerCase().includes(suche.toLowerCase()))
    : assets

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label className="w-20 shrink-0 text-xs text-muted-foreground">
          {ROLLEN_LABEL[rolle]}
        </Label>
        {gewaehlt ? (
          <div className="flex flex-1 items-center gap-2 rounded border border-border/60 bg-muted/20 px-2 py-1">
            <span className="flex-1 truncate text-xs font-medium">{gewaehlt.name}</span>
            <Button
              size="icon" variant="ghost" className="h-5 w-5"
              onClick={() => { onWaehlen(null); onBildWaehlen(null); setSuche('') }}
              aria-label={`${ROLLEN_LABEL[rolle]} entfernen`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Input
            value={suche}
            onChange={e => setSuche(e.target.value)}
            placeholder={`${ROLLEN_LABEL[rolle]} suchen…`}
            className="h-7 flex-1 text-xs"
          />
        )}
      </div>

      {/* Trefferliste, solange nichts gewählt ist */}
      {!gewaehlt && suche && (
        <div className="ml-[5.5rem] max-h-28 space-y-px overflow-y-auto rounded border border-border/60">
          {gefiltert.length === 0 ? (
            <p className="px-2 py-1.5 text-[11px] text-muted-foreground">Nichts gefunden</p>
          ) : gefiltert.slice(0, 8).map(a => (
            <button
              key={a.id}
              onClick={() => { onWaehlen(a); setSuche('') }}
              className="flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-muted/40"
            >
              {a.cover_image_url
                ? <img src={a.cover_image_url} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
                : <div className="h-6 w-6 shrink-0 rounded bg-muted" />}
              <span className="truncate text-[11px]">{a.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Bildauswahl — genau das „Charaktersheet-Bild dazu" */}
      {gewaehlt && (
        <div className="ml-[5.5rem]">
          {laedt ? (
            <p className="text-[11px] text-muted-foreground">Bilder werden geladen…</p>
          ) : fehler ? (
            <p className="text-[11px] text-destructive">
              Bilder konnten nicht geladen werden: {fehler}
            </p>
          ) : bilder.length === 0 ? (
            <p className={cn(
              'text-[11px]',
              gewaehlt.cover_image_url ? 'text-muted-foreground' : 'text-amber-500',
            )}>
              {gewaehlt.cover_image_url
                ? 'Keine Einzelbilder hinterlegt — es geht das Titelbild mit.'
                : 'Kein Bild vorhanden — dieser Eintrag geht ohne Referenzbild mit.'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {bilder.map(b => (
                <button
                  key={b.url}
                  onClick={() => onBildWaehlen(bild?.url === b.url ? null : b)}
                  title={b.label}
                  className={cn(
                    'h-12 w-12 overflow-hidden rounded border-2 transition',
                    bild?.url === b.url
                      ? 'border-emerald-500 ring-1 ring-emerald-500/40'
                      : 'border-transparent opacity-60 hover:opacity-100',
                  )}
                >
                  <img src={b.url} alt={b.label} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Aus einem gespeicherten Prompt einen Bildauftrag machen.
 *
 * Schließt die Lücke, dass gespeicherte Prompts bisher nur kopiert werden
 * konnten: Der Scene Builder baut Prompts, aber wer schon einen hat — aus der
 * Bibliothek, aus einem Sheet — hatte keinen Weg zurück in die Erzeugung.
 * Referenzbilder lassen sich hier einzeln wählen, inklusive der Sheet-Bilder
 * eines Charakters.
 */
export function PromptToImageDialog({
  isOpen, onClose, prompt, titel, vorauswahlCharakter = null,
}: PromptToImageDialogProps) {
  const { anlegen } = useImageJobs(false)
  const { characters } = useCharacters()
  const { outfits } = useOutfits()
  const { locations } = useLocations()

  const [charakter, setCharakter] = useState<AssetLeicht | null>(vorauswahlCharakter)
  const [charakterBild, setCharakterBild] = useState<RefImage | null>(null)
  const [outfit, setOutfit] = useState<AssetLeicht | null>(null)
  const [outfitBild, setOutfitBild] = useState<RefImage | null>(null)
  const [location, setLocation] = useState<AssetLeicht | null>(null)
  const [locationBild, setLocationBild] = useState<RefImage | null>(null)

  const [modell, setModell] = useState<ModellId>('gpt-image-2')
  const [durchlaeufe, setDurchlaeufe] = useState<Durchlaeufe>(1)
  const [format, setFormat] = useState<AspectRatioKey | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  // Reihenfolge = Reihenfolge, in der die Bilder ans Modell gehen.
  const referenzen: { url: string; rolle: ReferenzRolle }[] = []
  const charUrl = charakterBild?.url ?? charakter?.cover_image_url
  if (charUrl) referenzen.push({ url: charUrl, rolle: 'character' })
  const outUrl = outfitBild?.url ?? outfit?.cover_image_url
  if (outUrl) referenzen.push({ url: outUrl, rolle: 'outfit' })
  const locUrl = locationBild?.url ?? location?.cover_image_url
  if (locUrl) referenzen.push({ url: locUrl, rolle: 'location' })

  const rollen = referenzen.map(r => r.rolle)
  const zuordnung = groesseFuerFormat(format)
  const rollenBlock = referenzZuordnung(rollen)

  // Beim Öffnen die Vorauswahl übernehmen — der Dialog bleibt gemountet.
  useEffect(() => {
    if (isOpen && vorauswahlCharakter) setCharakter(vorauswahlCharakter)
  }, [isOpen, vorauswahlCharakter])

  function zuruecksetzen() {
    setCharakter(vorauswahlCharakter); setCharakterBild(null)
    setOutfit(null); setOutfitBild(null)
    setLocation(null); setLocationBild(null)
    setFormat(null); setDurchlaeufe(1)
  }

  async function handleQueue() {
    if (!prompt.trim() || laeuft) return
    setLaeuft(true)

    const job = await anlegen({
      prompt:          promptFuerAuftrag(prompt, format, rollen),
      model:           modell,
      size:            zuordnung.size,
      aspect_ratio:    format,
      variants:        durchlaeufe,
      reference_urls:  referenzen.map(r => r.url),
      reference_roles: rollen,
      scene_meta:      { name: titel ?? null, herkunft: 'prompt' },
    })

    setLaeuft(false)
    if (!job) return

    toast.success(
      durchlaeufe === 1 ? 'Auftrag eingereiht' : `${durchlaeufe} Durchläufe eingereiht`,
      {
        description: 'Der Arbeiter auf dem PC holt ihn ab.',
        action: { label: 'Warteschlange', onClick: () => { window.location.href = '/queue' } },
      },
    )
    zuruecksetzen()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={o => { if (!o) { zuruecksetzen(); onClose() } }}>
      <DialogContent className="max-h-[90svh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ImagePlus className="h-4 w-4" />
            Bild aus diesem Prompt
          </DialogTitle>
          <DialogDescription className="text-xs">
            {titel ? `„${titel}" ` : ''}wird unverändert an das Modell geschickt.
            Referenzbilder sind freiwillig.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Prompt
            </Label>
            <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded border border-border/60 bg-muted/20 p-2 font-mono text-[11px] leading-relaxed">
              {prompt}
            </pre>
          </div>

          <div className="space-y-3">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Referenzbilder (optional)
            </Label>
            <ReferenzWahl
              rolle="character" assets={characters}
              gewaehlt={charakter} onWaehlen={setCharakter}
              bild={charakterBild} onBildWaehlen={setCharakterBild}
            />
            <ReferenzWahl
              rolle="outfit" assets={outfits}
              gewaehlt={outfit} onWaehlen={setOutfit}
              bild={outfitBild} onBildWaehlen={setOutfitBild}
            />
            <ReferenzWahl
              rolle="location" assets={locations}
              gewaehlt={location} onWaehlen={setLocation}
              bild={locationBild} onBildWaehlen={setLocationBild}
            />
          </div>

          {rollen.length >= 1 && (
            <div className="rounded border border-dashed border-border/60 px-2 py-1.5">
              <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Zuordnung für das Modell
              </p>
              {rollen.map((rolle, i) => (
                <p key={i} className="font-mono text-[10px] leading-snug text-muted-foreground/70">
                  Bild {i + 1} → {ROLLEN_LABEL[rolle]}
                </p>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Select value={modell} onValueChange={v => setModell(v as ModellId)}>
              <SelectTrigger className="h-8 flex-1 text-xs" aria-label="Modell">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELLE.map(m => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={format ?? 'auto'}
              onValueChange={v => setFormat(v === 'auto' ? null : v as AspectRatioKey)}
            >
              <SelectTrigger className="h-8 w-36 text-xs" aria-label="Bildformat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto" className="text-xs">Format: quadratisch</SelectItem>
                {ASPECT_RATIOS.map(f => (
                  <SelectItem key={f.key} value={f.key} className="text-xs">
                    {f.emoji} {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(durchlaeufe)}
              onValueChange={v => setDurchlaeufe(Number(v) as Durchlaeufe)}
            >
              <SelectTrigger className="h-8 w-24 text-xs" aria-label="Durchläufe">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURCHLAEUFE.map(n => (
                  <SelectItem key={n} value={String(n)} className="text-xs">{n}× Bild</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="flex items-start gap-1 text-[10px] leading-snug text-muted-foreground/70">
            <Info className="mt-px h-2.5 w-2.5 shrink-0" />
            <span>
              {referenzen.length > 0
                ? 'Mit Referenzbildern bestimmt das Modell die Größe selbst — das gewünschte Format geht deshalb im Prompt mit.'
                : `${zuordnung.size}${zuordnung.hinweis ? ` — ${zuordnung.hinweis}` : ''}`}
            </span>
          </p>

          {rollenBlock && (
            <details>
              <summary className="cursor-pointer list-none text-[10px] text-muted-foreground/60 hover:text-muted-foreground">
                + Zusätze im Prompt ansehen
              </summary>
              <pre className="mt-1 whitespace-pre-wrap break-words rounded border border-dashed border-border/60 px-2 py-1 font-mono text-[9px] leading-snug text-muted-foreground/60">
                {rollenBlock}
              </pre>
            </details>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost" size="sm"
              onClick={() => { zuruecksetzen(); onClose() }}
            >
              Abbrechen
            </Button>
            <Button
              size="sm"
              onClick={handleQueue}
              disabled={!prompt.trim() || laeuft}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {laeuft
                ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Wird eingereiht…</>
                : <><Send className="mr-1.5 h-3.5 w-3.5" />Zur Warteschlange</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

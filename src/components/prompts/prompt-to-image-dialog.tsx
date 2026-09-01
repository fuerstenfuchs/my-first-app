'use client'

import { useState, useEffect } from 'react'
import { Loader2, Send, X, ImagePlus, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AssetPickerDialog, type PickbaresAsset } from '@/components/prompts/asset-picker-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useCharacters } from '@/hooks/use-characters'
import { useOutfits } from '@/hooks/use-outfits'
import { useLocations } from '@/hooks/use-locations'
import { useImageJobs } from '@/hooks/use-image-jobs'
import { type RefImage } from '@/lib/reference-images'
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
  /**
   * Welche Referenzarten angeboten werden. Charakter-Sheets beschreiben einen
   * neutralen Hintergrund — eine Location wäre dort nur Ballast und würde dem
   * Prompt widersprechen.
   */
  rollen?: ReferenzRolle[]
}

/**
 * Eine Karte je Rolle. Zeigt das gewählte Bild groß oder lädt zur Auswahl ein.
 * Die eigentliche Auswahl passiert im AssetPickerDialog — als Galerie, nicht
 * als Sucheingabe.
 */
function ReferenzKarte({
  rolle, assets, gewaehlt, bild, onOeffnen, onLoeschen,
}: {
  rolle: ReferenzRolle
  assets: PickbaresAsset[]
  gewaehlt: PickbaresAsset | null
  bild: RefImage | null
  onOeffnen: () => void
  onLoeschen: () => void
}) {
  const anzeigeBild = bild?.url ?? gewaehlt?.cover_image_url ?? null

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
      <div className="flex items-center justify-between border-b border-border/40 px-2 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {ROLLEN_LABEL[rolle]}
        </span>
        {gewaehlt && (
          <Button
            size="icon" variant="ghost" className="h-5 w-5"
            onClick={onLoeschen}
            aria-label={`${ROLLEN_LABEL[rolle]} entfernen`}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <button
        onClick={onOeffnen}
        disabled={assets.length === 0}
        className="group block w-full text-left disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="aspect-[3/4] w-full overflow-hidden bg-muted/20">
          {anzeigeBild ? (
            <img
              src={anzeigeBild} alt={gewaehlt?.name ?? ''}
              className="h-full w-full object-cover transition group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground/50">
              <ImagePlus className="h-6 w-6" />
              <span className="px-2 text-center text-[10px] leading-tight">
                {assets.length === 0
                  ? 'nichts in der Bibliothek'
                  : `${ROLLEN_LABEL[rolle]} wählen`}
              </span>
            </div>
          )}
        </div>
        <div className="px-2 py-1.5">
          <p className="truncate text-[11px] font-medium leading-tight">
            {gewaehlt?.name ?? <span className="text-muted-foreground">— keins —</span>}
          </p>
          {gewaehlt && (
            <p className="truncate text-[9px] text-muted-foreground/70">
              {bild ? bild.label : 'Titelbild'} · zum Ändern klicken
            </p>
          )}
        </div>
      </button>
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
  rollen: angeboteneRollen = ['character', 'outfit', 'location'],
}: PromptToImageDialogProps) {
  const { anlegen } = useImageJobs(false)
  const { characters } = useCharacters()
  const { outfits } = useOutfits()
  const { locations } = useLocations()

  const [charakter, setCharakter] = useState<PickbaresAsset | null>(vorauswahlCharakter)
  const [charakterBild, setCharakterBild] = useState<RefImage | null>(null)
  const [outfit, setOutfit] = useState<PickbaresAsset | null>(null)
  const [outfitBild, setOutfitBild] = useState<RefImage | null>(null)
  const [location, setLocation] = useState<PickbaresAsset | null>(null)
  const [locationBild, setLocationBild] = useState<RefImage | null>(null)

  const [modell, setModell] = useState<ModellId>('gpt-image-2')
  const [durchlaeufe, setDurchlaeufe] = useState<Durchlaeufe>(1)
  const [format, setFormat] = useState<AspectRatioKey | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [text, setText] = useState(prompt)
  const geaendert = text.trim() !== prompt.trim()

  // Beim Öffnen mit einem anderen Prompt den Text nachziehen.
  useEffect(() => { if (isOpen) setText(prompt) }, [isOpen, prompt])
  const [pickerOffen, setPickerOffen] = useState<ReferenzRolle | null>(null)

  function pickerFertig(asset: PickbaresAsset, gewaehltesBild: RefImage | null) {
    if (pickerOffen === 'character') { setCharakter(asset); setCharakterBild(gewaehltesBild) }
    if (pickerOffen === 'outfit')    { setOutfit(asset);    setOutfitBild(gewaehltesBild) }
    if (pickerOffen === 'location')  { setLocation(asset);  setLocationBild(gewaehltesBild) }
  }

  const pickerAssets: PickbaresAsset[] =
    pickerOffen === 'character' ? characters
    : pickerOffen === 'outfit'  ? outfits
    : pickerOffen === 'location' ? locations
    : []

  // Reihenfolge = Reihenfolge, in der die Bilder ans Modell gehen.
  const referenzen: { url: string; rolle: ReferenzRolle }[] = []
  const charUrl = charakterBild?.url ?? charakter?.cover_image_url
  if (charUrl && angeboteneRollen.includes('character')) {
    referenzen.push({ url: charUrl, rolle: 'character' })
  }
  const outUrl = outfitBild?.url ?? outfit?.cover_image_url
  if (outUrl && angeboteneRollen.includes('outfit')) {
    referenzen.push({ url: outUrl, rolle: 'outfit' })
  }
  const locUrl = locationBild?.url ?? location?.cover_image_url
  if (locUrl && angeboteneRollen.includes('location')) {
    referenzen.push({ url: locUrl, rolle: 'location' })
  }

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
    if (!text.trim() || laeuft) return
    setLaeuft(true)

    const job = await anlegen({
      prompt:          promptFuerAuftrag(text, format, rollen),
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
            <div className="flex items-baseline justify-between">
              <Label htmlFor="auftrag-prompt" className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Prompt
              </Label>
              {geaendert && (
                <button
                  onClick={() => setText(prompt)}
                  className="text-[10px] text-muted-foreground/70 underline underline-offset-2 hover:text-foreground"
                >
                  Änderungen verwerfen
                </button>
              )}
            </div>
            {/*
              Bearbeitbar, damit sich ein Widerspruch zum Referenzbild vor dem
              Abschicken entfernen lässt — etwa eine Outfit-Beschreibung, wenn
              ohnehin ein Outfit-Bild mitgeht. Der gespeicherte Prompt bleibt
              davon unberührt; geändert wird nur, was dieser eine Auftrag bekommt.
            */}
            <Textarea
              id="auftrag-prompt"
              value={text}
              onChange={e => setText(e.target.value)}
              rows={6}
              className="mt-1 max-h-48 resize-y font-mono text-[11px] leading-relaxed"
            />
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground/60">
              {geaendert
                ? 'Geändert — gilt nur für diesen Auftrag, der gespeicherte Prompt bleibt wie er ist.'
                : 'Kann hier angepasst werden, ohne den gespeicherten Prompt zu verändern.'}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Referenzbilder (optional)
              </Label>
              <span className="text-[10px] text-muted-foreground/60">
                Anklicken öffnet die Galerie
              </span>
            </div>
            <div className={cn(
              'grid gap-2',
              angeboteneRollen.length === 1 ? 'grid-cols-1'
                : angeboteneRollen.length === 2 ? 'grid-cols-2' : 'grid-cols-3',
            )}>
              {angeboteneRollen.includes('character') && (
                <ReferenzKarte
                  rolle="character" assets={characters}
                  gewaehlt={charakter} bild={charakterBild}
                  onOeffnen={() => setPickerOffen('character')}
                  onLoeschen={() => { setCharakter(null); setCharakterBild(null) }}
                />
              )}
              {angeboteneRollen.includes('outfit') && (
                <ReferenzKarte
                  rolle="outfit" assets={outfits}
                  gewaehlt={outfit} bild={outfitBild}
                  onOeffnen={() => setPickerOffen('outfit')}
                  onLoeschen={() => { setOutfit(null); setOutfitBild(null) }}
                />
              )}
              {angeboteneRollen.includes('location') && (
                <ReferenzKarte
                  rolle="location" assets={locations}
                  gewaehlt={location} bild={locationBild}
                  onOeffnen={() => setPickerOffen('location')}
                  onLoeschen={() => { setLocation(null); setLocationBild(null) }}
                />
              )}
            </div>
          </div>

          {rollen.length >= 1 && (
            <div className="rounded border border-dashed border-amber-700/40 bg-amber-950/10 px-2 py-1.5">
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-amber-500/80">
                Was gilt bei Widerspruch
              </p>
              <p className="text-[10px] leading-snug text-muted-foreground">
                Beschreibt der Prompt {rollen.includes('character') && 'die Person'}
                {rollen.includes('character') && rollen.length > 1 && ', '}
                {rollen.includes('outfit') && 'die Kleidung'}
                {rollen.includes('outfit') && rollen.includes('location') && ' oder '}
                {rollen.includes('location') && 'den Ort'} anders als das Referenzbild,
                {' '}<strong className="text-foreground">gewinnt das Bild</strong> — für genau
                diesen Punkt. Szene, Licht, Kamera und Stimmung kommen weiter aus dem Text.
              </p>
            </div>
          )}

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
              disabled={!text.trim() || laeuft}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {laeuft
                ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Wird eingereiht…</>
                : <><Send className="mr-1.5 h-3.5 w-3.5" />Zur Warteschlange</>}
            </Button>
          </div>
        </div>
      </DialogContent>

      {pickerOffen && (
        <AssetPickerDialog
          isOpen={!!pickerOffen}
          onClose={() => setPickerOffen(null)}
          rolle={pickerOffen}
          assets={pickerAssets}
          onFertig={pickerFertig}
        />
      )}
    </Dialog>
  )
}

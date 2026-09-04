'use client'

import { useMemo, useRef, useState } from 'react'
import { Loader2, Film, Info } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useImageJobs } from '@/hooks/use-image-jobs'
import {
  groesseFuerFormat, promptFuerAuftrag,
  type ModellId, type KlassenId, type Referenz,
} from '@/lib/image-generation'
import { SHOT_TYPES, type AspectRatioKey, type ShotTypeKey } from '@/lib/scene-builder-options'
import {
  REIHEN_ORDNUNG, REIHE_VORBELEGUNG, baueReihe, reiheMeta, reihenAnsage,
} from '@/lib/einstellungsreihe'
import type { Scene } from '@/lib/szene-prompt'

interface ReiheButtonProps {
  /** Die fertige Szene — Vorlage für jede Einstellung. */
  scene: Scene
  /** Der Prompt der Szene, wie er rechts steht. Nur zur Sperre des Knopfes. */
  prompt: string
  referenzen: Referenz[]
  aspectRatio: AspectRatioKey | null
  sceneMeta: Record<string, unknown>
  szenenName?: string | null
  /** Modell und Größenklasse werden oben EINMAL gewählt und hier mitbenutzt. */
  modell: ModellId
  zielKlasse: KlassenId | null
}

/**
 * „Reihe erzeugen" (PROJ-44) — aus einer fertigen Szene mehrere Einstellungen.
 *
 * N AUFTRÄGE, NICHT EIN AUFTRAG MIT N DURCHLÄUFEN. `anlegen()` nimmt EINEN
 * Prompt und erzeugt ihn `variants`-mal; jede Einstellung braucht aber einen
 * anderen Prompt, weil die Einstellungsgröße als Textbaustein darin steckt.
 * Sieben Durchläufe eines Auftrags gäben siebenmal dieselbe Einstellung.
 *
 * Der Prompt-Bau selbst steht in `einstellungsreihe.ts` und ist dort geprüft.
 * Hier steht nur, was ohne Anmeldung nicht prüfbar wäre: einreihen, sperren,
 * melden.
 */
export function ReiheButton({
  scene, prompt, referenzen, aspectRatio, sceneMeta, szenenName = null,
  modell, zielKlasse,
}: ReiheButtonProps) {
  const { anlegen } = useImageJobs(false)
  const [gewaehlt, setGewaehlt] = useState<ShotTypeKey[]>(REIHE_VORBELEGUNG)
  const [laeuft, setLaeuft] = useState(false)
  const [fortschritt, setFortschritt] = useState(0)

  /**
   * DIE SPERRE LIEGT IM REF, NICHT IM STATE. `setLaeuft(true)` wirkt erst beim
   * nächsten Rendern — zwei schnelle Klicks kämen beide durch die Prüfung und
   * reihten die Reihe doppelt ein. Bei bis zu zehn bezahlten Erzeugungen ist
   * das Fenster größer als sonst, und genau dieser Fehler steht in
   * `features/OFFEN.md` als offener Befund.
   */
  const laeuftRef = useRef(false)

  const reihe = useMemo(() => baueReihe(scene, gewaehlt), [scene, gewaehlt])
  const anzahl = reihe.length
  const gesperrt = !prompt || anzahl === 0 || laeuft

  function umschalten(key: ShotTypeKey) {
    setGewaehlt(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    )
  }

  async function handleReihe() {
    if (laeuftRef.current) return
    if (!prompt || anzahl === 0) return

    laeuftRef.current = true
    setLaeuft(true)
    setFortschritt(0)

    // Eine Kennung für die ganze Reihe. Der Lichttisch zeigt sie noch nicht
    // gruppiert — ohne sie wäre das später aber gar nicht mehr möglich.
    const reiheId = crypto.randomUUID()

    const zuordnung = groesseFuerFormat(aspectRatio)
    const rollen = referenzen.map(r => r.rolle)
    const urls = referenzen.map(r => r.url)

    let eingereiht = 0
    try {
      for (const einstellung of reihe) {
        const job = await anlegen({
          prompt:          promptFuerAuftrag(einstellung.prompt, aspectRatio, rollen),
          model:           modell,
          size:            zuordnung.size,
          // EIN Format für die ganze Reihe. Was sich ändert, ist der
          // Bildausschnitt, nicht das Seitenverhältnis.
          aspect_ratio:    aspectRatio,
          variants:        1,
          ziel_klasse:     zielKlasse,
          reference_urls:  urls,
          reference_roles: rollen,
          scene_meta:      reiheMeta({ ...sceneMeta, name: szenenName }, reiheId, einstellung),
        })

        // Beim ersten Fehlschlag anhalten. `anlegen` meldet den Grund bereits
        // selbst; neun weitere gleichlautende Meldungen hinterher wären nur
        // Lärm — und die Reihe ist ohnehin unvollständig.
        if (!job) break
        eingereiht++
        setFortschritt(eingereiht)
      }
    } finally {
      laeuftRef.current = false
      setLaeuft(false)
      setFortschritt(0)
    }

    if (eingereiht === 0) return

    toast.success(
      eingereiht === anzahl
        ? `${eingereiht} Einstellungen eingereiht`
        : `Nur ${eingereiht} von ${anzahl} Einstellungen eingereiht`,
      {
        description: eingereiht === anzahl
          ? 'Gleiche Szene, gleiches Licht — nur der Bildausschnitt wechselt.'
          : 'Der Rest wurde nicht eingereiht. Die Meldung dazu steht darüber.',
        action: { label: 'Warteschlange', onClick: () => { window.location.href = '/queue' } },
      },
    )
  }

  return (
    <div className="space-y-2 rounded-md border border-orange-500/25 bg-background/40 p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold text-foreground/80">🎞️ Einstellungsreihe</span>
        <button
          type="button"
          onClick={() => setGewaehlt(REIHE_VORBELEGUNG)}
          className="text-[9px] text-muted-foreground/50 hover:text-muted-foreground"
        >
          Vorschlag
        </button>
      </div>

      {/* Reihenfolge wie im Schnitt: weit → nah. Nicht die Klickreihenfolge. */}
      <div className="flex flex-wrap gap-1">
        {REIHEN_ORDNUNG.map(key => {
          const opt = SHOT_TYPES.find(s => s.key === key)!
          const an = gewaehlt.includes(key)
          return (
            <button
              key={key}
              type="button"
              aria-pressed={an}
              onClick={() => umschalten(key)}
              disabled={laeuft}
              className={cn(
                'flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-40',
                an
                  ? 'border-orange-500/50 bg-orange-500/15 text-orange-300'
                  : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              <span>{opt.emoji}</span>
              <span>{opt.label}</span>
            </button>
          )
        })}
      </div>

      {/*
        DIE ZAHL STEHT VOR DEM KLICK DA. Ein Knopf, der einen Schritt nennt und
        mehrere bezahlte Erzeugungen startet, steht in diesem Projekt schon als
        offener Befund.
      */}
      <Button
        onClick={handleReihe}
        disabled={gesperrt}
        className="h-8 w-full text-[11px] bg-orange-600 hover:bg-orange-500 disabled:opacity-40"
      >
        {laeuft
          ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Einstellung {Math.min(fortschritt + 1, anzahl)} von {anzahl}…</>
          : <><Film className="mr-1.5 h-3 w-3" />Reihe erzeugen — {reihenAnsage(anzahl)}</>}
      </Button>

      <p className="flex items-start gap-1 text-[10px] leading-snug text-muted-foreground/70">
        <Info className="mt-px h-2.5 w-2.5 shrink-0" />
        <span>
          {anzahl === 0
            ? 'Mindestens eine Einstellungsgröße wählen.'
            : <>Ein eigener Auftrag je Einstellung — jeder einzeln wiederholbar.
                Charakter, Outfit, Location, Licht, Objektiv und Format bleiben gleich.</>}
        </span>
      </p>
    </div>
  )
}

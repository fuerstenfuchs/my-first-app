'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Loader2, Send, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useImageJobs } from '@/hooks/use-image-jobs'
import {
  MODELLE, MODELLE_MIT_REFERENZ, DURCHLAEUFE, KLASSEN, rechnetInKlassen,
  groesseFuerFormat, formatAnsage, promptFuerAuftrag, referenzZuordnung,
  ROLLEN_LABEL,
  type ModellId, type Durchlaeufe, type Referenz, type KlassenId,
} from '@/lib/image-generation'
import type { AspectRatioKey } from '@/lib/scene-builder-options'
import { ReiheButton } from '@/components/scene-builder/reihe-button'
import type { Scene } from '@/lib/szene-prompt'

interface QueueButtonProps {
  prompt: string
  referenzen: Referenz[]
  aspectRatio: AspectRatioKey | null
  sceneMeta: Record<string, unknown>
  /** Kurzname der Szene, wandert in den Dateinamen beim Download. */
  szenenName?: string | null
  /**
   * Die ganze Szene — nur für die Einstellungsreihe (PROJ-44), die je
   * Einstellungsgröße einen eigenen Prompt baut. Ohne sie bleibt der
   * Reihen-Kasten weg; der Auftragsknopf funktioniert unverändert.
   */
  scene?: Scene | null
}

/**
 * „Zur Warteschlange" — legt aus der aktuellen Szene einen Auftrag an.
 *
 * Die Prompt-Erzeugung des Scene Builders wird nicht angefasst. Angehängt
 * werden höchstens zwei Blöcke, und beide nur bei Referenzbildern:
 * die Zuordnung, welches Bild wofür steht, und die Formatansage.
 */
export function QueueButton({
  prompt, referenzen, aspectRatio, sceneMeta, szenenName = null, scene = null,
}: QueueButtonProps) {
  const { anlegen } = useImageJobs(false)
  const [modell, setModell] = useState<ModellId>('gpt-image-2')
  const [durchlaeufe, setDurchlaeufe] = useState<Durchlaeufe>(1)
  const [klasse, setKlasse] = useState<KlassenId>('2K')
  const [laeuft, setLaeuft] = useState(false)

  /**
   * Sobald Referenzbilder dabei sind, stehen nur Modelle zur Wahl, die sie auch
   * verarbeiten. Gemini stünde sonst hier — und würde sie lautlos verwerfen,
   * weil dieses Menü nur `m.label` zeigt und die Notiz dazu gar nicht.
   */
  const auswahl = useMemo(
    () => (referenzen.length > 0 ? MODELLE_MIT_REFERENZ : MODELLE),
    [referenzen.length],
  )

  // Wer erst Gemini wählt und dann ein Referenzbild dazunimmt, hätte sonst ein
  // Modell eingestellt, das gar nicht mehr im Menü steht.
  useEffect(() => {
    if (!auswahl.some(m => m.id === modell)) setModell('gpt-image-2')
  }, [auswahl, modell])

  // Gemini rechnet in Größenklassen statt in Pixeln. Ohne diese Angabe lehnt
  // die Datenbank den Auftrag ab — und eine stille Vorgabe wäre schlechter als
  // eine sichtbare Wahl.
  const inKlassen = rechnetInKlassen(modell)

  const zuordnung = groesseFuerFormat(aspectRatio)
  const rollen = referenzen.map(r => r.rolle)
  const mitReferenz = referenzen.length > 0
  const ansage = mitReferenz ? formatAnsage(aspectRatio) : null
  const rollenBlock = referenzZuordnung(rollen)

  /**
   * Die Sperre liegt im Ref, nicht im State: `setLaeuft(true)` wirkt erst beim
   * nächsten Rendern, zwei schnelle Klicks kämen beide durch `if (laeuft)` und
   * legten zwei Aufträge an. Steht so in `features/OFFEN.md`.
   */
  const laeuftRef = useRef(false)

  async function handleQueue() {
    if (!prompt || laeuftRef.current) return
    laeuftRef.current = true
    setLaeuft(true)

    // MIT `finally`, wie in der Reihe daneben: `anlegen` faengt Datenbank-
    // fehler selbst ab, aber `auth.getUser()` darin kann bei abgerissener
    // Verbindung werfen. Ohne `finally` bliebe der Knopf dann fuer immer
    // gesperrt, und nur ein Neuladen der Seite holte ihn zurueck.
    let job = null
    try {
      job = await anlegen({
        prompt:          promptFuerAuftrag(prompt, aspectRatio, rollen),
        model:           modell,
        size:            zuordnung.size,
        aspect_ratio:    aspectRatio,
        variants:        durchlaeufe,
        ziel_klasse:     inKlassen ? klasse : null,
        reference_urls:  referenzen.map(r => r.url),
        reference_roles: rollen,
        // name fuer den Dateinamen beim Download — ohne ihn hiessen alle Bilder
        // aus dem Scene Builder nur "tresor-<datum>.png".
        scene_meta:      { ...sceneMeta, name: szenenName },
      })
    } finally {
      laeuftRef.current = false
      setLaeuft(false)
    }

    if (!job) return

    toast.success(
      durchlaeufe === 1 ? 'Auftrag eingereiht' : `${durchlaeufe} Durchläufe eingereiht`,
      {
        description: 'Der Arbeiter auf dem PC holt ihn ab.',
        action: { label: 'Warteschlange', onClick: () => { window.location.href = '/queue' } },
      },
    )
  }

  return (
    /*
      Die Farbwerte `--sb-*` kommen aus `scene-builder/papier.css` und gelten
      nur innerhalb von `.sb-papier`. Dieser Kasten wird ausschliesslich dort
      gezeichnet (einziger Aufrufer: die Scene-Builder-Seite).
    */
    <div className="space-y-2.5 border border-[var(--sb-rule)] bg-[var(--sb-card)] p-3 shadow-[0_1px_3px_rgba(60,48,25,0.09)]">
      <div className="flex items-center gap-2">
        <Select value={modell} onValueChange={v => setModell(v as ModellId)}>
          <SelectTrigger className="h-9 flex-1 text-sm" aria-label="Modell">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="sb-papier">
            {auswahl.map(m => (
              <SelectItem key={m.id} value={m.id} className="text-sm">{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {inKlassen && (
          <Select value={klasse} onValueChange={v => setKlasse(v as KlassenId)}>
            <SelectTrigger className="h-9 w-[6.75rem] text-sm" aria-label="Größenklasse">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="sb-papier">
              {KLASSEN.map(k => (
                <SelectItem key={k.id} value={k.id} className="text-sm">
                  {k.label} · {k.note}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={String(durchlaeufe)}
          onValueChange={v => setDurchlaeufe(Number(v) as Durchlaeufe)}
        >
          <SelectTrigger className="h-9 w-[5.75rem] text-sm" aria-label="Durchläufe">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="sb-papier">
            {DURCHLAEUFE.map(n => (
              <SelectItem key={n} value={String(n)} className="text-sm">
                {n}× Bild
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        onClick={handleQueue}
        disabled={!prompt || laeuft}
        className="h-11 w-full text-[15px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-40"
      >
        {laeuft
          ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Wird eingereiht…</>
          : <><Send className="mr-1.5 h-4 w-4" />Zur Warteschlange</>}
      </Button>

      {/*
        Welches Bild wofür steht — auf einen Blick, in derselben Reihenfolge, in
        der die Bilder ans Modell gehen. Ohne diese Zuordnung nahm es schon mal
        die Person aus dem Outfit-Bild.
      */}
      {rollen.length >= 1 && (
        <p className="border border-dashed border-amber-600/60 bg-amber-50 px-2 py-1.5 text-[13px] leading-snug text-[var(--sb-ink2)]">
          <span className="font-bold text-amber-800">Bei Widerspruch gewinnt das Bild.</span>{' '}
          Beschreibt der Prompt die Person, die Kleidung oder den Ort anders als das
          Referenzbild, folgt das Modell dem Bild — Szene, Licht und Kamera weiter dem Text.
        </p>
      )}

      {rollen.length >= 1 && (
        <div className="border border-dashed border-[var(--sb-rule)] px-2 py-1.5">
          <p className="mb-1 text-[13px] font-bold uppercase tracking-[0.15em] text-[var(--sb-ink3)]">
            Zuordnung für das Modell
          </p>
          <ol className="space-y-px">
            {rollen.map((rolle, i) => (
              <li key={i} className="font-mono text-[13px] leading-snug text-[var(--sb-ink2)]">
                Bild {i + 1} → {ROLLEN_LABEL[rolle]}
                {rolle === 'outfit' && <span className="text-[var(--sb-ink3)]"> (nur Kleidung)</span>}
                {rolle === 'character' && <span className="text-[var(--sb-ink3)]"> (Gesicht &amp; Person)</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[13px] leading-snug text-[var(--sb-ink2)]">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {mitReferenz ? (
            <>Mit Referenzbildern bestimmt das Modell die Größe selbst.</>
          ) : (
            <>
              {zuordnung.size}
              {zuordnung.hinweis ? ` — ${zuordnung.hinweis}` : ''}
            </>
          )}
        </span>
      </p>

      {/*
        Die Einstellungsreihe (PROJ-44) — direkt unter dem Auftragsknopf, damit
        Modell und Größenklasse oben nur EINMAL gewählt werden müssen und für
        beide Wege gelten.
      */}
      {scene && (
        <ReiheButton
          scene={scene}
          prompt={prompt}
          referenzen={referenzen}
          aspectRatio={aspectRatio}
          sceneMeta={sceneMeta}
          szenenName={szenenName}
          modell={modell}
          zielKlasse={inKlassen ? klasse : null}
        />
      )}

      {/* Wörtlich zeigen, was zusätzlich abgeschickt wird — sonst steht rechts
          ein anderer Text als der, für den bezahlt wird. */}
      {(rollenBlock || ansage) && (
        <details className="group">
          <summary className="cursor-pointer list-none text-[13px] text-[var(--sb-ink3)] hover:text-[var(--sb-ink)]">
            + Zusätze im Prompt ansehen
          </summary>
          <pre className="mt-1.5 whitespace-pre-wrap break-words border border-dashed border-[var(--sb-rule)] bg-[var(--sb-pap2)] px-2 py-1.5 font-mono text-[13px] leading-snug text-[var(--sb-ink2)]">
            {[rollenBlock, ansage].filter(Boolean).join('\n\n')}
          </pre>
        </details>
      )}
    </div>
  )
}

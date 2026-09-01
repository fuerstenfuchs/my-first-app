'use client'

import { useState } from 'react'
import { Loader2, Send, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useImageJobs } from '@/hooks/use-image-jobs'
import {
  MODELLE, DURCHLAEUFE, groesseFuerFormat, formatAnsage, promptFuerAuftrag,
  referenzZuordnung, ROLLEN_LABEL,
  type ModellId, type Durchlaeufe, type Referenz,
} from '@/lib/image-generation'
import type { AspectRatioKey } from '@/lib/scene-builder-options'

interface QueueButtonProps {
  prompt: string
  referenzen: Referenz[]
  aspectRatio: AspectRatioKey | null
  sceneMeta: Record<string, unknown>
  /** Kurzname der Szene, wandert in den Dateinamen beim Download. */
  szenenName?: string | null
}

/**
 * „Zur Warteschlange" — legt aus der aktuellen Szene einen Auftrag an.
 *
 * Die Prompt-Erzeugung des Scene Builders wird nicht angefasst. Angehängt
 * werden höchstens zwei Blöcke, und beide nur bei Referenzbildern:
 * die Zuordnung, welches Bild wofür steht, und die Formatansage.
 */
export function QueueButton({
  prompt, referenzen, aspectRatio, sceneMeta, szenenName = null,
}: QueueButtonProps) {
  const { anlegen } = useImageJobs(false)
  const [modell, setModell] = useState<ModellId>('gpt-image-2')
  const [durchlaeufe, setDurchlaeufe] = useState<Durchlaeufe>(1)
  const [laeuft, setLaeuft] = useState(false)

  const zuordnung = groesseFuerFormat(aspectRatio)
  const rollen = referenzen.map(r => r.rolle)
  const mitReferenz = referenzen.length > 0
  const ansage = mitReferenz ? formatAnsage(aspectRatio) : null
  const rollenBlock = referenzZuordnung(rollen)

  async function handleQueue() {
    if (!prompt || laeuft) return
    setLaeuft(true)

    const job = await anlegen({
      prompt:          promptFuerAuftrag(prompt, aspectRatio, rollen),
      model:           modell,
      size:            zuordnung.size,
      aspect_ratio:    aspectRatio,
      variants:        durchlaeufe,
      reference_urls:  referenzen.map(r => r.url),
      reference_roles: rollen,
      // name fuer den Dateinamen beim Download — ohne ihn hiessen alle Bilder
      // aus dem Scene Builder nur "tresor-<datum>.png".
      scene_meta:      { ...sceneMeta, name: szenenName },
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
  }

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5">
      <div className="flex items-center gap-2">
        <Select value={modell} onValueChange={v => setModell(v as ModellId)}>
          <SelectTrigger className="h-7 flex-1 text-[11px]" aria-label="Modell">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODELLE.map(m => (
              <SelectItem key={m.id} value={m.id} className="text-xs">{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(durchlaeufe)}
          onValueChange={v => setDurchlaeufe(Number(v) as Durchlaeufe)}
        >
          <SelectTrigger className="h-7 w-[4.5rem] text-[11px]" aria-label="Durchläufe">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DURCHLAEUFE.map(n => (
              <SelectItem key={n} value={String(n)} className="text-xs">
                {n}× Bild
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        onClick={handleQueue}
        disabled={!prompt || laeuft}
        className="h-8 w-full text-[11px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40"
      >
        {laeuft
          ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Wird eingereiht…</>
          : <><Send className="mr-1.5 h-3 w-3" />Zur Warteschlange</>}
      </Button>

      {/*
        Welches Bild wofür steht — auf einen Blick, in derselben Reihenfolge, in
        der die Bilder ans Modell gehen. Ohne diese Zuordnung nahm es schon mal
        die Person aus dem Outfit-Bild.
      */}
      {rollen.length >= 1 && (
        <p className="rounded border border-dashed border-amber-700/40 bg-amber-950/10 px-1.5 py-1 text-[9px] leading-snug text-muted-foreground">
          <span className="font-semibold text-amber-500/80">Bei Widerspruch gewinnt das Bild.</span>{' '}
          Beschreibt der Prompt die Person, die Kleidung oder den Ort anders als das
          Referenzbild, folgt das Modell dem Bild — Szene, Licht und Kamera weiter dem Text.
        </p>
      )}

      {rollen.length >= 1 && (
        <div className="rounded border border-dashed border-border/60 px-1.5 py-1">
          <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Zuordnung für das Modell
          </p>
          <ol className="space-y-px">
            {rollen.map((rolle, i) => (
              <li key={i} className="font-mono text-[10px] leading-snug text-muted-foreground/70">
                Bild {i + 1} → {ROLLEN_LABEL[rolle]}
                {rolle === 'outfit' && <span className="text-muted-foreground/50"> (nur Kleidung)</span>}
                {rolle === 'character' && <span className="text-muted-foreground/50"> (Gesicht &amp; Person)</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="flex items-start gap-1 text-[10px] leading-snug text-muted-foreground/70">
        <Info className="mt-px h-2.5 w-2.5 shrink-0" />
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

      {/* Wörtlich zeigen, was zusätzlich abgeschickt wird — sonst steht rechts
          ein anderer Text als der, für den bezahlt wird. */}
      {(rollenBlock || ansage) && (
        <details className="group">
          <summary className="cursor-pointer list-none text-[10px] text-muted-foreground/60 hover:text-muted-foreground">
            + Zusätze im Prompt ansehen
          </summary>
          <pre className="mt-1 whitespace-pre-wrap break-words rounded border border-dashed border-border/60 px-1.5 py-1 font-mono text-[9px] leading-snug text-muted-foreground/60">
            {[rollenBlock, ansage].filter(Boolean).join('\n\n')}
          </pre>
        </details>
      )}
    </div>
  )
}

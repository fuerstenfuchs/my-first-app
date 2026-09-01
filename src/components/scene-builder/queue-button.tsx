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
  type ModellId, type Durchlaeufe,
} from '@/lib/image-generation'
import type { AspectRatioKey } from '@/lib/scene-builder-options'

interface QueueButtonProps {
  prompt: string
  referenceUrls: string[]
  aspectRatio: AspectRatioKey | null
  sceneMeta: Record<string, unknown>
}

/**
 * „Zur Warteschlange" — legt aus der aktuellen Szene einen Auftrag an.
 *
 * Die Prompt-Erzeugung des Scene Builders wird nicht angefasst. Angehängt wird
 * höchstens eine Formatansage, und auch die nur, wenn Referenzbilder mitgehen:
 * Dann ignoriert gpt-image-2 den Größenparameter und richtet sich nach dem
 * Referenzbild (am 01.09.2026 nachgemessen — 1024x1024 angefordert,
 * 1122x1402 zurückbekommen).
 */
export function QueueButton({ prompt, referenceUrls, aspectRatio, sceneMeta }: QueueButtonProps) {
  const { anlegen } = useImageJobs(false)
  const [modell, setModell] = useState<ModellId>('gpt-image-2')
  const [durchlaeufe, setDurchlaeufe] = useState<Durchlaeufe>(1)
  const [laeuft, setLaeuft] = useState(false)

  const zuordnung = groesseFuerFormat(aspectRatio)
  const mitReferenz = referenceUrls.length > 0
  const ansage = mitReferenz ? formatAnsage(aspectRatio) : null

  async function handleQueue() {
    if (!prompt || laeuft) return
    setLaeuft(true)

    const endgueltigerPrompt = promptFuerAuftrag(prompt, aspectRatio, mitReferenz)

    const job = await anlegen({
      prompt:         endgueltigerPrompt,
      model:          modell,
      size:           zuordnung.size,
      aspect_ratio:   aspectRatio,
      variants:       durchlaeufe,
      reference_urls: referenceUrls,
      scene_meta:     sceneMeta,
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

      {/*
        Wörtlich zeigen, was zusätzlich abgeschickt wird. Ohne das läge rechts im
        Prompt-Feld ein anderer Text als der, für den bezahlt wird — sichtbar
        erst hinterher auf /queue.
      */}
      {ansage && (
        <p className="rounded border border-dashed border-border/60 px-1.5 py-1 font-mono text-[10px] leading-snug text-muted-foreground/60">
          <span className="not-italic">+ </span>{ansage}
        </p>
      )}
    </div>
  )
}

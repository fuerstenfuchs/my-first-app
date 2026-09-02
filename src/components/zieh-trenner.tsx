'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Ein Trennbalken, an dem sich die linke Spalte breiter ziehen lässt.
 *
 * Mark am 02.09.2026 zum Erzeugen-Feld: „ist mir viel zu klein … Ich kann hier
 * fast nichts lesen, was dort alles steht. Brauch ein bisschen Platz zum
 * Erzeugen des Promptes."
 *
 * Die Breite bleibt im Browser gespeichert — einmal eingestellt, gilt sie beim
 * nächsten Mal wieder. `localStorage` kann in einem privaten Fenster oder bei
 * gesperrten Seitendaten werfen, deshalb steht jeder Zugriff in einem try.
 *
 * WARUM POINTER-EVENTS UND NICHT MOUSE: Damit es auch mit Stift und auf dem
 * Tabletbildschirm funktioniert. `setPointerCapture` sorgt dafür, dass das
 * Ziehen nicht abreißt, sobald der Zeiger den schmalen Balken verlässt — genau
 * das passiert beim schnellen Ziehen sonst ständig.
 */

interface Props {
  /** Unter welchem Schlüssel die Breite gemerkt wird. */
  merkschluessel: string
  breite: number
  onBreite: (px: number) => void
  min?: number
  max?: number
}

export function ZiehTrenner({ merkschluessel, breite, onBreite, min = 220, max = 720 }: Props) {
  const [zieht, setZieht] = useState(false)
  const start = useRef<{ x: number; breite: number } | null>(null)

  const merken = useCallback((px: number) => {
    try { localStorage.setItem(merkschluessel, String(px)) } catch { /* egal */ }
  }, [merkschluessel])

  useEffect(() => {
    if (!zieht) return
    // Während des Ziehens keine Textauswahl und überall der Ziehcursor —
    // sonst markiert der Zug den Prompt-Text im Feld daneben.
    const vorher = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    return () => {
      document.body.style.userSelect = vorher
      document.body.style.cursor = ''
    }
  }, [zieht])

  function begrenzen(px: number): number {
    return Math.min(max, Math.max(min, Math.round(px)))
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Breite des Erzeugen-Bereichs"
      aria-valuenow={breite}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={e => {
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { x: e.clientX, breite }
        setZieht(true)
      }}
      onPointerMove={e => {
        if (!start.current) return
        onBreite(begrenzen(start.current.breite + (e.clientX - start.current.x)))
      }}
      onPointerUp={e => {
        e.currentTarget.releasePointerCapture(e.pointerId)
        start.current = null
        setZieht(false)
        merken(breite)
      }}
      // Auch ohne Maus bedienbar: Pfeiltasten verschieben in Zehnerschritten.
      onKeyDown={e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
        e.preventDefault()
        const neu = begrenzen(breite + (e.key === 'ArrowRight' ? 16 : -16))
        onBreite(neu)
        merken(neu)
      }}
      // Doppelklick stellt die Vorgabe wieder her — wer sich verzogen hat,
      // muss nicht zurückzielen.
      onDoubleClick={() => { onBreite(min + 40); merken(min + 40) }}
      title="Ziehen zum Verbreitern · Doppelklick setzt zurück"
      className={cn(
        'group relative hidden w-1.5 shrink-0 cursor-col-resize touch-none lg:block',
        'before:absolute before:inset-y-0 before:-left-1 before:-right-1 before:content-[""]',
        zieht ? 'bg-primary/60' : 'bg-border/50 hover:bg-primary/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      )}
    >
      {/* Griffpunkte, damit man sieht, dass hier etwas zu ziehen ist */}
      <span className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col gap-1">
        {[0, 1, 2].map(i => (
          <span key={i} className="h-1 w-0.5 rounded-full bg-foreground/30 group-hover:bg-foreground/60" />
        ))}
      </span>
    </div>
  )
}

/** Die gemerkte Breite lesen — oder die Vorgabe. */
export function gemerkteBreite(schluessel: string, vorgabe: number): number {
  try {
    const roh = localStorage.getItem(schluessel)
    const n = roh ? Number(roh) : NaN
    return Number.isFinite(n) && n > 0 ? n : vorgabe
  } catch {
    return vorgabe
  }
}

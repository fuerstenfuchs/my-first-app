'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

/**
 * Läuft der Arbeiter auf dem PC?
 *
 * Ohne diese Auskunft sieht ein wartender Auftrag genau gleich aus, egal ob der
 * Arbeiter ihn gleich abholt oder seit gestern aus ist. Genau diese Stille —
 * die aussieht wie Geduld — hat in diesem Projekt schon zweimal Zeit gekostet.
 *
 * Die Zeitspanne rechnet die Datenbank aus (`worker_status`), nicht der Browser:
 * Die PC-Uhr wich am 01.09.2026 um 34 Sekunden von der Serverzeit ab, und ein
 * Vergleich zweier verschiedener Uhren hätte „vor -34 Sekunden" ergeben.
 */

/**
 * Ab wann er als weg gilt.
 *
 * Er meldet sich alle 20 Sekunden — unabhängig davon, wie oft er nach Aufträgen
 * fragt. Das ist wichtig, seit der Auftragstakt sich der Lage anpasst und bei
 * Ruhe auf eine Minute geht: Sonst hätte die Anzeige ihn für weg gehalten,
 * obwohl er nur sparsam war.
 */
const SCHWELLE_SEKUNDEN = 60

export type WorkerStatus =
  | { zustand: 'laeuft'; sekundenHer: number }
  | { zustand: 'weg'; sekundenHer: number }
  | { zustand: 'nie' }
  | { zustand: 'unbekannt' }

export function useWorkerStatus(aktiv = true): WorkerStatus {
  const [status, setStatus] = useState<WorkerStatus>({ zustand: 'unbekannt' })
  const supabase = createClient()

  const lesen = useCallback(async () => {
    const { data, error } = await supabase
      .from('worker_status')
      .select('sekunden_her')
      .maybeSingle()

    if (error) { setStatus({ zustand: 'unbekannt' }); return }
    if (!data) { setStatus({ zustand: 'nie' }); return }

    const her = data.sekunden_her as number
    setStatus({ zustand: her <= SCHWELLE_SEKUNDEN ? 'laeuft' : 'weg', sekundenHer: her })
  }, [supabase])

  useEffect(() => {
    if (!aktiv) return
    void lesen()
    const timer = setInterval(() => { void lesen() }, 15_000)
    return () => clearInterval(timer)
  }, [aktiv, lesen])

  return status
}

/** „vor 3 Minuten" — kurz und ohne Bibliothek. */
export function seitWann(sekunden: number): string {
  if (sekunden < 90) return `vor ${sekunden} Sekunden`
  const min = Math.round(sekunden / 60)
  if (min < 90) return `vor ${min} Minuten`
  const std = Math.round(min / 60)
  if (std < 36) return `vor ${std} Stunden`
  return `vor ${Math.round(std / 24)} Tagen`
}

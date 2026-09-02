'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import type { AnalyseArt } from '@/lib/analyse-prompts'
import { ANALYSE_ANGABEN } from '@/lib/analyse-prompts'
import { analysiereUeberProxy, proxyBereit } from '@/lib/proxy-analyse'

/**
 * EIN Weg fuer alle sieben Bildanalysen.
 *
 * Vorher rief jede Seite ihre Route selbst — fuenfmal derselbe Ablauf, fuenfmal
 * eigene Fehlerbehandlung. Seit dem 03.09.2026 gibt es zwei moegliche Wege
 * (Marks eigener Proxy im Browser, sonst die bezahlte Route auf dem Server),
 * und die Entscheidung zwischen ihnen gehoert an EINE Stelle. Laege sie
 * fuenfmal vor, wuerde eine der fuenf beim naechsten Umbau vergessen — und
 * genau die wuerde dann still weiter Geld kosten.
 *
 * WARUM DER RUECKFALL LAUT IST: Wenn der Proxy aus ist, laeuft die Analyse
 * ueber Anthropic bzw. OpenAI, und das kostet. Ein stiller Rueckfall waere
 * bequem und falsch: Mark wuerde nicht merken, dass der Proxy seit Tagen nicht
 * mehr laeuft, und die Rechnung erst am Monatsende sehen.
 */

export type AnalyseWeg = 'proxy' | 'route'

export interface AnalyseBild {
  /** Reines Base64 ohne `data:`-Vorspann. NUR damit ist der Proxy-Weg moeglich. */
  imageBase64?: string
  mediaType?: string
  /** Nur eine URL? Dann bleibt allein die Route — das Bild holt der Server. */
  imageUrl?: string
}

export interface AnalyseOptionen {
  /** Die bestehende Server-Route, z.B. `/api/analyze-pose`. */
  route: string
  /** Zusaetzliche Felder fuer den Route-Rumpf (z.B. `assetType`, `personPlaceholder`). */
  zusatz?: Record<string, unknown>
  /** Modell fuer den Proxy-Weg. Ohne Angabe das eingestellte. */
  modell?: string
  signal?: AbortSignal
}

export interface AnalyseErgebnis<T> {
  ergebnis: T
  /** Welcher Weg es tatsaechlich wurde — der Aufrufer darf das anzeigen. */
  weg: AnalyseWeg
}

/** Der bisherige Weg: Server-Route. Unveraendert, damit ohne Proxy alles bleibt wie es war. */
async function ueberRoute<T>(
  art: AnalyseArt,
  bild: AnalyseBild,
  optionen: AnalyseOptionen,
): Promise<T> {
  const rumpf: Record<string, unknown> = { ...optionen.zusatz }
  if (bild.imageBase64) {
    rumpf.imageBase64 = bild.imageBase64
    rumpf.mediaType = bild.mediaType ?? 'image/jpeg'
  } else if (bild.imageUrl) {
    rumpf.imageUrl = bild.imageUrl
  }

  const res = await fetch(optionen.route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rumpf),
    signal: optionen.signal,
  })
  if (!res.ok) {
    const daten = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(daten.error ?? `HTTP ${res.status}`)
  }

  const daten = await res.json() as unknown
  // Die Text-Analysen (`bild`, `bildPlatzhalter`) antworten als `{ prompt }`,
  // die JSON-Analysen liefern das Objekt direkt. Der Aufrufer soll diesen
  // Unterschied nicht mehr kennen muessen.
  if (ANALYSE_ANGABEN[art].ausgabe === 'text') {
    return ((daten as { prompt?: string }).prompt ?? '') as unknown as T
  }
  return daten as T
}

/**
 * Erst der Proxy, dann — sichtbar — die Route.
 *
 * Als freie Funktion und nicht nur als Hook, damit sie auch ausserhalb einer
 * Komponente aufrufbar und ohne React testbar bleibt.
 */
export async function analysiere<T = unknown>(
  art: AnalyseArt,
  bild: AnalyseBild,
  optionen: AnalyseOptionen,
): Promise<AnalyseErgebnis<T>> {
  // Ohne Base64 kein Proxy: Der laeuft auf Marks Rechner und kaeme an eine
  // Supabase-URL im Zweifel nicht heran. Dann ist die Route nicht der
  // Rueckfall, sondern von vornherein der einzige Weg — und dafuer gibt es
  // keinen Grund fuer eine Meldung.
  if (proxyBereit() && bild.imageBase64) {
    try {
      const ergebnis = await analysiereUeberProxy<T>({
        art,
        bildBase64: bild.imageBase64,
        mediaType: bild.mediaType,
        modell: optionen.modell,
        signal: optionen.signal,
      })
      return { ergebnis, weg: 'proxy' }
    } catch (err) {
      // Hat der Aufrufer selbst abgebrochen, ist das kein Rueckfallgrund —
      // sonst liefe die teure Route ausgerechnet dann, wenn niemand mehr
      // auf das Ergebnis wartet.
      if (optionen.signal?.aborted) throw err
      const grund = err instanceof Error ? err.message : 'Unbekannter Fehler'
      toast.info('Eigener Proxy nicht erreichbar — Analyse läuft über den bezahlten Dienst.', {
        description: grund,
      })
    }
  }

  return { ergebnis: await ueberRoute<T>(art, bild, optionen), weg: 'route' }
}

/** Dieselbe Funktion, nur als Hook — stabil referenziert fuer Abhaengigkeitslisten. */
export function useAnalyse() {
  return {
    analysiere: useCallback(analysiere, []),
  }
}

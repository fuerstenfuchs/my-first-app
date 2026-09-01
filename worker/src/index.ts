/**
 * Der lokale Arbeiter für die Bildgenerierung.
 *
 * Warum es ihn gibt: Prompt Trésor läuft auf Vercel, der Bild-Proxy auf diesem
 * PC unter 127.0.0.1. Die Cloud erreicht diese Adresse nie. Also holt der PC
 * sich die Arbeit ab, statt dass die Cloud sie schickt.
 *
 * Start:  npm start   (im Ordner worker/)
 * Ende:   Strg+C — ein laufendes Bild wird noch zu Ende gebracht.
 */

import { config } from './config.ts'
import { auftragAbarbeiten, beschreibung } from './abarbeiten.ts'
import {
  naechsterAuftrag,
  haengendeAuftraegeEinsammeln,
  auftragFehlgeschlagen,
  auftragZurueckstellen,
} from './supabase.ts'
import type { ImageJob } from './supabase.ts'

function uhrzeit(): string {
  return new Date().toLocaleTimeString('de-DE')
}

function sage(text: string): void {
  console.log(`${uhrzeit()}  ${text}`)
}

let beenden = false
const laufenderAbbruch = new AbortController()

async function durchgang(): Promise<boolean> {
  const eingesammelt = await haengendeAuftraegeEinsammeln()
  if (eingesammelt > 0) {
    sage(`${eingesammelt} hängengebliebene(n) Auftrag wieder eingereiht.`)
  }

  const job = await naechsterAuftrag()
  if (!job) return false

  sage(`Auftrag ${job.id.slice(0, 8)} · ${beschreibung(job)}`)

  try {
    await auftragAbarbeiten(job, sage, laufenderAbbruch.signal)
    sage(`  Auftrag ${job.id.slice(0, 8)} abgeschlossen.`)
  } catch (e) {
    const fehler = e as Error
    if (fehler.name === 'AbortError') {
      sage(`  Abgebrochen — Auftrag ${job.id.slice(0, 8)} wird wieder eingereiht.`)
      await auftragZurueckstellen(job.id, job.attempts, 'Arbeiter wurde beendet')
      return false
    }
    const status = await auftragFehlgeschlagen(job.id, job.attempts, fehler.message)
    sage(
      `  Fehlgeschlagen (Versuch ${job.attempts}/${config.maxAttempts}): ${fehler.message}`,
    )
    sage(status === 'failed'
      ? '  Endgültig aufgegeben — auf der Seite /queue erneut einreihbar.'
      : '  Kommt zurück in die Warteschlange.')
  }
  return true
}

/**
 * Warten, aber unterbrechbar. Ohne den Wecker müsste Strg+C bis zu fünf
 * Sekunden warten, bis die Schleife das Beenden-Flag wieder prüft.
 */
let wecker: (() => void) | null = null

async function schlafen(ms: number): Promise<void> {
  return new Promise(fertig => {
    const timer = setTimeout(() => { wecker = null; fertig() }, ms)
    wecker = () => { clearTimeout(timer); wecker = null; fertig() }
  })
}

async function hauptschleife(): Promise<void> {
  sage('Arbeiter läuft.')
  sage(`  Proxy:    ${config.proxyUrl}`)
  sage(`  Supabase: ${config.supabaseUrl}`)
  sage(`  Abfrage alle ${config.pollIntervalMs / 1000}s. Beenden mit Strg+C.`)

  let ruhigSeit = 0
  while (!beenden) {
    try {
      const gabArbeit = await durchgang()
      if (gabArbeit) {
        ruhigSeit = 0
        continue  // ohne Pause weiter, solange etwas wartet
      }
      // Nur einmal melden, dass nichts da ist — nicht alle fünf Sekunden.
      if (ruhigSeit === 0) sage('Nichts zu tun. Warte auf Aufträge…')
      ruhigSeit++
    } catch (e) {
      sage(`Durchgang fehlgeschlagen: ${(e as Error).message}`)
      sage('  Versuche es beim nächsten Mal erneut.')
    }
    await schlafen(config.pollIntervalMs)
  }
  sage('Arbeiter beendet.')
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (beenden) {
      // Zweites Strg+C: sofort raus, laufendes Bild verwerfen.
      laufenderAbbruch.abort()
      process.exit(130)
    }
    beenden = true
    sage('Beende nach dem laufenden Bild. Nochmal Strg+C bricht sofort ab.')
    wecker?.()   // nicht erst die Wartezeit zu Ende sitzen
  })
}

await hauptschleife()

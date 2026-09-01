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
import { bildErzeugen } from './proxy.ts'
import {
  naechsterAuftrag,
  haengendeAuftraegeEinsammeln,
  auftragFertig,
  auftragFehlgeschlagen,
  ergebnisAblegen,
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

async function auftragAbarbeiten(job: ImageJob): Promise<void> {
  const anzahl = Math.min(Math.max(job.variants ?? 1, 1), 4)
  const referenzen = job.reference_urls.length
  sage(
    `Auftrag ${job.id.slice(0, 8)} · ${job.model} · ${job.size} · ` +
    `${anzahl} Durchlauf${anzahl > 1 ? 'e' : ''}` +
    (referenzen ? ` · ${referenzen} Referenz${referenzen > 1 ? 'en' : ''}` : ' · ohne Referenz'),
  )

  const pfade: string[] = []
  for (let i = 0; i < anzahl; i++) {
    const begonnen = Date.now()
    const daten = await bildErzeugen(job, laufenderAbbruch.signal)
    const pfad = await ergebnisAblegen(job.user_id, job.id, i, daten)
    pfade.push(pfad)
    const sekunden = Math.round((Date.now() - begonnen) / 1000)
    sage(`  Bild ${i + 1}/${anzahl} fertig nach ${sekunden}s · ${Math.round(daten.length / 1024)} kB`)
  }

  await auftragFertig(job.id, pfade)
  sage(`  Auftrag ${job.id.slice(0, 8)} abgeschlossen.`)
}

async function durchgang(): Promise<boolean> {
  const eingesammelt = await haengendeAuftraegeEinsammeln()
  if (eingesammelt > 0) {
    sage(`${eingesammelt} hängengebliebene(n) Auftrag wieder eingereiht.`)
  }

  const job = await naechsterAuftrag()
  if (!job) return false

  try {
    await auftragAbarbeiten(job)
  } catch (e) {
    const fehler = e as Error
    if (fehler.name === 'AbortError') {
      sage(`  Abgebrochen — Auftrag ${job.id.slice(0, 8)} wird wieder eingereiht.`)
      await auftragFehlgeschlagen(job.id, 0, 'Arbeiter wurde beendet')
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

async function schlafen(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
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
  })
}

await hauptschleife()

/**
 * Der lokale Arbeiter für die Bildgenerierung.
 *
 * Warum es ihn gibt: Prompt Trésor läuft auf Vercel, der Bild-Proxy auf diesem
 * PC unter 127.0.0.1. Die Cloud erreicht diese Adresse nie. Also holt der PC
 * sich die Arbeit ab, statt dass die Cloud sie schickt.
 *
 * Start:  npm start   (im Ordner worker/)
 * Ende:   Strg+C — der laufende Auftrag wird noch zu Ende gebracht,
 *         bei mehreren Durchlaeufen also bis zu vier Bilder. Nochmal Strg+C
 *         bricht sofort ab und stellt den Auftrag zurueck.
 */

import { config } from './config.ts'
import { auftragAbarbeiten, beschreibung } from './abarbeiten.ts'
import {
  naechsterAuftrag,
  haengendeAuftraegeEinsammeln,
  auftragFehlgeschlagen,
  auftragZurueckstellen,
  lebenszeichen,
} from './supabase.ts'
import type { ImageJob } from './supabase.ts'

function uhrzeit(): string {
  return new Date().toLocaleTimeString('de-DE')
}

function sage(text: string): void {
  console.log(`${uhrzeit()}  ${text}`)
}

const VERSION = '2026-09-01'

let beenden = false
const laufenderAbbruch = new AbortController()

async function durchgang(aufraeumen: boolean): Promise<boolean> {
  const eingesammelt = aufraeumen ? await haengendeAuftraegeEinsammeln() : 0
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
    // Ein nicht erreichbarer Proxy ist kein Fehler des Auftrags — das passiert
    // beim Hochfahren regelmaessig, weil Arbeiter und Proxy beide im Autostart
    // liegen und der Arbeiter schneller da ist. Ohne diese Unterscheidung
    // haetten drei Anlaeufe in den ersten Sekunden einen Auftrag verbrannt.
    if (fehler.message.includes('Der Proxy war nicht erreichbar')) {
      sage('  Der Bild-Proxy antwortet noch nicht — Auftrag bleibt liegen.')
      await auftragZurueckstellen(job.id, job.attempts, 'Bild-Proxy war nicht erreichbar')
      return true
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

/**
 * Wie lange bis zur nächsten Abfrage.
 *
 * Ein starrer Fünf-Sekunden-Takt kostet 17.280 Durchgänge am Tag — gemessen
 * 36 MB täglich und damit 21 Prozent des Supabase-Kontingents, nur fürs
 * Nachfragen ins Leere. An einem Tag ohne einen einzigen Auftrag ist das alles
 * verschenkt.
 *
 * Deshalb: schnell, solange etwas los ist, und immer träger, je länger Ruhe
 * herrscht. Nach dem ersten Auftrag ist er sofort wieder bei fünf Sekunden.
 */
function naechsterTakt(ruhigeDurchgaenge: number, grundtakt: number): number {
  if (ruhigeDurchgaenge < 12)  return grundtakt          //  erste Minute:  5 s
  if (ruhigeDurchgaenge < 32)  return grundtakt * 3      //  bis ~6 min:   15 s
  if (ruhigeDurchgaenge < 92)  return grundtakt * 6      //  bis ~35 min:  30 s
  return grundtakt * 12                                   //  danach:       60 s
}

async function hauptschleife(): Promise<void> {
  sage('Arbeiter läuft.')
  sage(`  Proxy:    ${config.proxyUrl}`)
  sage(`  Supabase: ${config.supabaseUrl}`)
  sage(`  Abfrage alle ${config.pollIntervalMs / 1000}s, bei längerer Ruhe seltener.`)
  sage('  Beenden mit Strg+C.')

  if (!config.userId) {
    sage('  Hinweis: WORKER_USER_ID fehlt — die App kann nicht anzeigen, dass er läuft.')
  }

  let ruhigSeit = 0
  let letztesLebenszeichen = 0
  let letztesAufraeumen = 0

  while (!beenden) {
    const jetzt = Date.now()
    try {
      // Das Lebenszeichen hängt nicht am Auftragstakt: Die App soll auch dann
      // sehen, dass er läuft, wenn er nur noch jede Minute nachfragt.
      if (config.userId && jetzt - letztesLebenszeichen >= 20_000) {
        await lebenszeichen(config.userId, VERSION)
        letztesLebenszeichen = jetzt
      }

      // Aufräumen ist Vorsorge, keine Eile — einmal pro Minute genügt.
      const raeumen = jetzt - letztesAufraeumen >= 60_000
      if (raeumen) letztesAufraeumen = jetzt

      const gabArbeit = await durchgang(raeumen)
      if (gabArbeit) {
        if (ruhigSeit > 0) sage('Wieder etwas zu tun.')
        ruhigSeit = 0
        continue  // ohne Pause weiter, solange etwas wartet
      }
      // Nur einmal melden, dass nichts da ist — nicht bei jedem Durchgang.
      if (ruhigSeit === 0) sage('Nichts zu tun. Warte auf Aufträge…')
      ruhigSeit++
    } catch (e) {
      sage(`Durchgang fehlgeschlagen: ${(e as Error).message}`)
      sage('  Versuche es beim nächsten Mal erneut.')
    }
    await schlafen(naechsterTakt(ruhigSeit, config.pollIntervalMs))
  }
  sage('Arbeiter beendet.')
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (beenden) {
      // Zweites Strg+C: laufendes Bild verwerfen. Der Abbruch braucht einen
      // Moment, um den Auftrag zurueckzustellen — process.exit() direkt hier
      // war synchron und hat genau das verhindert: Der Auftrag blieb mit
      // erhoehtem Versuchszaehler auf 'running' liegen und wurde erst nach der
      // Aufraeumfrist eingesammelt.
      sage('Wird abgebrochen, der Auftrag wird zurueckgestellt…')
      laufenderAbbruch.abort()
      // Notausgang, falls das Zurueckstellen selbst haengt.
      setTimeout(() => process.exit(130), 5000).unref()
      return
    }
    beenden = true
    sage('Beende nach dem laufenden Auftrag. Nochmal Strg+C bricht sofort ab.')
    wecker?.()   // nicht erst die Wartezeit zu Ende sitzen
  })
}

await hauptschleife()

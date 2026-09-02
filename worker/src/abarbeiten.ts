/**
 * Was mit einem übernommenen Auftrag geschieht — die eine Wahrheit für beide
 * Einstiege.
 *
 * Vorher stand diese Schleife zweimal da: einmal im Dauerbetrieb (index.ts),
 * einmal im Abnahmewerkzeug (einmal.ts). Beim Nachrüsten lief die Kopie zweimal
 * hinterher — erst beim Fortschreiben nach jedem Bild, dann beim zweiten
 * Auftragstyp, wo das Abnahmewerkzeug eine Vergrößerung an das Bildmodell
 * schickte und eine Absage bekam. Zwei Kopien einer Ablauflogik driften
 * zuverlässig auseinander, deshalb jetzt hier.
 */

import { bildErzeugen } from './proxy.ts'
import { bildVergroessern } from './upscale.ts'
import { bildVergroessernKi, type KiVerfahren } from './fal.ts'
import { bildNachbauen, bildErzeugenGemini, GROESSENKLASSEN } from './gemini.ts'
import {
  auftragFertig, ergebnisAblegen, ergebnisHolen, externeAnfrageMerken, fortschrittMerken,
} from './supabase.ts'
import type { ImageJob } from './supabase.ts'

/** Wohin Zwischenmeldungen gehen — der Dauerbetrieb stempelt die Uhrzeit davor. */
export type Melder = (text: string) => void

export function beschreibung(job: ImageJob): string {
  if (job.job_type === 'upscale') {
    // Ohne die Rückfalltexte stünde bei einem Auftrag, der die Schranke
    // umgangen hat, „vergrößern null" — eine Meldung, die in die Irre führt
    // statt auf die Ursache.
    const ziel = job.upscaler === 'gemini'
      ? (job.ziel_klasse ?? 'ohne Größenklasse')
      : (job.scale ? `${job.scale}×` : 'ohne Faktor')
    return `vergrößern ${ziel} · ${job.upscaler ?? 'ohne Verfahren'}`
  }
  const anzahl = durchlaeufe(job)
  const referenzen = job.reference_urls.length
  // Bei Gemini ist `size` bedeutungslos — dort zaehlt die Groessenklasse.
  const groesse = job.model.startsWith('gemini') ? (job.ziel_klasse ?? '2K') : job.size
  return (
    `${job.model} · ${groesse} · ${anzahl} Durchlauf${anzahl > 1 ? 'e' : ''}` +
    (referenzen ? ` · ${referenzen} Referenz${referenzen > 1 ? 'en' : ''}` : ' · ohne Referenz')
  )
}

export function durchlaeufe(job: ImageJob): number {
  return Math.min(Math.max(job.variants ?? 1, 1), 4)
}

/**
 * Vergrößern — rechnerisch auf dem PC oder mit KI über fal.ai.
 *
 * Beide Wege liefern genau ein Bild, deshalb kein Fortschreiben wie beim
 * Erzeugen. Der Unterschied liegt woanders: Lanczos ist umsonst und ein
 * Neuversuch kostet nichts, SeedVR2 kostet pro Lauf. Das Verfahren steht
 * deshalb im Auftrag und wird hier nicht erraten — ein fehlender Wert ist ein
 * Fehler und keine stille Voreinstellung auf das kostenpflichtige Verfahren.
 */
async function vergroessern(
  job: ImageJob, sage: Melder, signal?: AbortSignal,
): Promise<void> {
  if (!job.source_path) {
    throw new Error('Vergrößerungsauftrag ohne Ausgangsbild.')
  }
  const bekannt = ['lanczos', 'seedvr2', 'crystal', 'gemini']
  if (!job.upscaler || !bekannt.includes(job.upscaler)) {
    throw new Error(`Unbekanntes Vergrößerungsverfahren: ${job.upscaler ?? 'keins angegeben'}`)
  }

  const begonnen = Date.now()
  const quelle = await ergebnisHolen(job.source_path, job.user_id)

  let daten: ArrayBuffer
  let nachher: { breite: number; hoehe: number }
  // Was im Protokoll steht: bei Gemini die Klasse, sonst der Faktor.
  let ziel: string

  if (job.upscaler === 'gemini') {
    // Kein Fortschreiben und kein Wiederaufnehmen: Der Weg läuft über Marks
    // eigene Anmeldung im lokalen Proxy und kostet nichts extra. Ein
    // Neuversuch ist deshalb harmlos — anders als bei fal.
    if (!job.ziel_klasse) {
      throw new Error('Gemini-Auftrag ohne Größenklasse.')
    }
    ziel = job.ziel_klasse
    sage(`  Gemini baut das Bild in ${job.ziel_klasse} nach…`)
    const ergebnis = await bildNachbauen(Buffer.from(quelle), job.ziel_klasse, { signal })
    daten = ergebnis.daten.buffer.slice(
      ergebnis.daten.byteOffset,
      ergebnis.daten.byteOffset + ergebnis.daten.byteLength,
    ) as ArrayBuffer
    nachher = { breite: ergebnis.breite, hoehe: ergebnis.hoehe }
    sage(`  Seitenverhältnis ${ergebnis.verhaeltnis}, Farben auf das Original zurückgerechnet.`)
  } else if (job.upscaler !== 'lanczos') {
    if (!job.scale) throw new Error('Vergrößerungsauftrag ohne Faktor.')
    ziel = `${job.scale}×`
    sage(`  KI-Vergrößerung bei fal.ai (${job.upscaler})…`)
    const ergebnis = await bildVergroessernKi(quelle, job.scale, job.upscaler as KiVerfahren, {
      signal,
      // Ein früherer Versuch hat vielleicht schon bezahlt. Dann wird sein
      // Ergebnis abgeholt statt ein zweites Mal gerechnet.
      vorhandeneAnfrage: job.external_ref,
      merken: anfrage => externeAnfrageMerken(job.id, anfrage),
    })
    if (ergebnis.wiederaufgenommen) {
      sage('  Ergebnis eines früheren Versuchs abgeholt — kostet nichts.')
    }
    daten = ergebnis.daten
    nachher = ergebnis.nachher
  } else {
    if (!job.scale) throw new Error('Vergrößerungsauftrag ohne Faktor.')
    ziel = `${job.scale}×`
    const ergebnis = await bildVergroessern(quelle, job.scale)
    daten = ergebnis.daten
    nachher = ergebnis.nachher
  }

  const pfad = await ergebnisAblegen(job.user_id, job.id, 0, daten)

  sage(
    `  ${job.upscaler} · ${ziel} → ${nachher.breite}×${nachher.hoehe} ` +
    `in ${Math.round((Date.now() - begonnen) / 1000)}s · ` +
    `${Math.round(daten.byteLength / 1024)} kB`,
  )
  await auftragFertig(job.id, [pfad])
}

/** Erzeugen. Jedes fertige Bild wird sofort festgehalten. */
async function erzeugen(job: ImageJob, sage: Melder, signal?: AbortSignal): Promise<void> {
  const anzahl = durchlaeufe(job)

  // Bereits erzeugte Bilder aus einem früheren Versuch übernehmen, statt sie
  // noch einmal zu bezahlen. Der Neuversuch ist damit eine Fortsetzung.
  const pfade: string[] = [...job.result_paths]
  if (pfade.length > 0) {
    sage(`  ${pfade.length} Bild(er) aus einem früheren Versuch übernommen.`)
  }

  // Gemini spricht einen anderen Weg als die OpenAI-artigen Modelle: nicht
  // /v1/images/generations mit Pixelmaßen, sondern den nativen Endpunkt mit
  // Seitenverhältnis und Größenklasse. Am 02.09.2026 gemessen — auf den
  // Bild-Endpunkten antwortet der Proxy für Gemini mit HTTP 400.
  const ueberGemini = job.model.startsWith('gemini')

  /**
   * Wo weitergezaehlt wird — aus dem HOECHSTEN vorhandenen Index, nicht aus der
   * Anzahl.
   *
   * WARUM DER UNTERSCHIED SEIT DEM 02.09.2026 ZAEHLT: Ergebnispfade sind
   * `<nutzer>/<auftrag>/<index>.<endung>` und werden mit `upsert` geschrieben.
   * Bis es das Loeschen einzelner Bilder im Lichttisch gab, konnte
   * `result_paths` keine Luecken haben — `pfade.length` und „naechster freier
   * Index" waren dasselbe. Jetzt nicht mehr: Faellt bei einem Auftrag ueber
   * vier Bilder nach dreien (0,1,2) der Versuch aus und Mark loescht Bild 0,
   * bleiben zwei Pfade, und die Schleife begaenne bei 2 — also auf `2.png`,
   * das es schon gibt. Das vorhandene Bild waere ueberschrieben, `2.png`
   * stuende zweimal in der Liste, und statt vier Bildern laegen drei da.
   */
  const naechsterIndex = pfade.reduce((hoechste, p) => {
    const n = Number(p.split('/').pop()?.split('.')[0])
    return Number.isInteger(n) ? Math.max(hoechste, n + 1) : hoechste
  }, pfade.length)

  for (let i = naechsterIndex; i < naechsterIndex + (anzahl - pfade.length); i++) {
    const begonnen = Date.now()
    let daten: ArrayBuffer
    if (ueberGemini) {
      // KEIN Rückfall auf eine Vorgabe. Drei Zweige weiter oben gilt eine
      // fehlende Größenklasse bei der Gemini-Vergrößerung als Fehler; hier
      // hätte `?? '2K'` dieselbe Lücke verschluckt. Zwei Zweige, dieselbe
      // Frage, entgegengesetzte Antwort — das war die eigentliche Schwäche.
      if (!job.ziel_klasse) {
        throw new Error(
          'Gemini-Auftrag ohne Größenklasse. Gemini rechnet nicht in Pixeln — ' +
          'die Spalte ziel_klasse muss 1K, 2K oder 4K enthalten.',
        )
      }
      // Gemini bekommt hier NUR den Prompt. Referenzbilder würden lautlos
      // verschwinden, während der Prompt weiter „Image 1 = CHARACTER …"
      // diktiert — das Ergebnis wäre eine erfundene Person, und in der
      // Warteschlange stünde trotzdem „2 Ref.". Lieber ein klarer Fehler.
      if (job.reference_urls.length > 0) {
        throw new Error(
          `Gemini kann keine Referenzbilder verarbeiten (${job.reference_urls.length} übergeben). ` +
          'Für Aufträge mit Referenz gpt-image-2 wählen.',
        )
      }
      const klasse = job.ziel_klasse as typeof GROESSENKLASSEN[number]
      const e = await bildErzeugenGemini(job.prompt, job.aspect_ratio, klasse, signal, job.model)
      daten = e.daten.buffer.slice(
        e.daten.byteOffset, e.daten.byteOffset + e.daten.byteLength,
      ) as ArrayBuffer
    } else {
      daten = await bildErzeugen(job, signal)
    }
    const pfad = await ergebnisAblegen(job.user_id, job.id, i, daten)
    pfade.push(pfad)
    // Sofort festhalten — sonst wäre alles verloren, wenn das nächste Bild scheitert.
    await fortschrittMerken(job.id, pfade)
    sage(
      `  Bild ${i + 1}/${anzahl} fertig nach ${Math.round((Date.now() - begonnen) / 1000)}s · ` +
      `${Math.round(daten.byteLength / 1024)} kB`,
    )
  }

  await auftragFertig(job.id, pfade)
}

export async function auftragAbarbeiten(
  job: ImageJob, sage: Melder, signal?: AbortSignal,
): Promise<void> {
  if (job.job_type === 'upscale') return vergroessern(job, sage, signal)
  return erzeugen(job, sage, signal)
}

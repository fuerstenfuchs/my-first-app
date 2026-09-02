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
import { bildVergroessernKi } from './fal.ts'
import {
  auftragFertig, ergebnisAblegen, ergebnisHolen, externeAnfrageMerken, fortschrittMerken,
} from './supabase.ts'
import type { ImageJob } from './supabase.ts'

/** Wohin Zwischenmeldungen gehen — der Dauerbetrieb stempelt die Uhrzeit davor. */
export type Melder = (text: string) => void

export function beschreibung(job: ImageJob): string {
  if (job.job_type === 'upscale') {
    return `vergrößern ${job.scale}× · ${job.upscaler ?? 'ohne Verfahren'}`
  }
  const anzahl = durchlaeufe(job)
  const referenzen = job.reference_urls.length
  return (
    `${job.model} · ${job.size} · ${anzahl} Durchlauf${anzahl > 1 ? 'e' : ''}` +
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
  if (!job.source_path || !job.scale) {
    throw new Error('Vergrößerungsauftrag ohne Ausgangsbild oder Faktor.')
  }
  if (job.upscaler !== 'lanczos' && job.upscaler !== 'seedvr2') {
    throw new Error(`Unbekanntes Vergrößerungsverfahren: ${job.upscaler ?? 'keins angegeben'}`)
  }

  const begonnen = Date.now()
  const quelle = await ergebnisHolen(job.source_path, job.user_id)

  let daten: ArrayBuffer
  let nachher: { breite: number; hoehe: number }

  if (job.upscaler === 'seedvr2') {
    sage('  KI-Vergrößerung bei fal.ai…')
    const ergebnis = await bildVergroessernKi(quelle, job.scale, {
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
    const ergebnis = await bildVergroessern(quelle, job.scale)
    daten = ergebnis.daten
    nachher = ergebnis.nachher
  }

  const pfad = await ergebnisAblegen(job.user_id, job.id, 0, daten)

  sage(
    `  ${job.upscaler} · ${job.scale}× → ${nachher.breite}×${nachher.hoehe} ` +
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

  for (let i = pfade.length; i < anzahl; i++) {
    const begonnen = Date.now()
    const daten = await bildErzeugen(job, signal)
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

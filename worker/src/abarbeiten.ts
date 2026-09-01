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
import {
  auftragFertig, ergebnisAblegen, ergebnisHolen, fortschrittMerken,
} from './supabase.ts'
import type { ImageJob } from './supabase.ts'

/** Wohin Zwischenmeldungen gehen — der Dauerbetrieb stempelt die Uhrzeit davor. */
export type Melder = (text: string) => void

export function beschreibung(job: ImageJob): string {
  if (job.job_type === 'upscale') {
    return `vergrößern ${job.scale}×`
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
 * Vergrößern. Rechnet der PC selbst, kostet nichts und braucht keine
 * Gegenstelle — deshalb auch kein Fortschreiben: Es ist immer genau ein Bild,
 * und ein Neuversuch ist umsonst.
 */
async function vergroessern(job: ImageJob, sage: Melder): Promise<void> {
  if (!job.source_path || !job.scale) {
    throw new Error('Vergrößerungsauftrag ohne Ausgangsbild oder Faktor.')
  }
  const begonnen = Date.now()
  const quelle = await ergebnisHolen(job.source_path, job.user_id)
  const { daten, vorher, nachher } = await bildVergroessern(quelle, job.scale)
  const pfad = await ergebnisAblegen(job.user_id, job.id, 0, daten)

  sage(
    `  ${vorher.breite}×${vorher.hoehe} → ${nachher.breite}×${nachher.hoehe} ` +
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
  if (job.job_type === 'upscale') return vergroessern(job, sage)
  return erzeugen(job, sage, signal)
}

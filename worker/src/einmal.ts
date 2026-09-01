/**
 * Genau einen Auftrag abarbeiten und aufhören.
 *
 * Für die Abnahme nach Stufe 1 des Briefings: einen Auftrag von Hand in die
 * Tabelle schreiben, dies hier starten, schauen ob ein Bild herauskommt.
 * Läuft mit `npm run einmal`.
 */

import { config } from './config.ts'
import { bildErzeugen } from './proxy.ts'
import {
  naechsterAuftrag,
  auftragFertig,
  auftragFehlgeschlagen,
  fortschrittMerken,
  ergebnisAblegen,
} from './supabase.ts'

const job = await naechsterAuftrag()

if (!job) {
  console.log('\nKein wartender Auftrag. Nichts zu tun.\n')
  process.exit(0)
}

const anzahl = Math.min(Math.max(job.variants ?? 1, 1), 4)
console.log(`\nAuftrag ${job.id}`)
console.log(`  Modell:     ${job.model}`)
console.log(`  Groesse:    ${job.size}`)
console.log(`  Durchlaeufe:${anzahl}`)
console.log(`  Referenzen: ${job.reference_urls.length}`)
console.log(`  Prompt:     ${job.prompt.slice(0, 120)}${job.prompt.length > 120 ? '…' : ''}`)
console.log(`\nDas dauert bei quality=high ein bis drei Minuten pro Bild.\n`)

try {
  // Gleiches Verhalten wie im Dauerbetrieb: bereits erzeugte Bilder übernehmen
  // und den Fortschritt nach jedem Bild festhalten.
  const pfade: string[] = [...job.result_paths]
  if (pfade.length > 0) {
    console.log(`  ${pfade.length} Bild(er) aus einem frueheren Versuch uebernommen.`)
  }
  for (let i = pfade.length; i < anzahl; i++) {
    const begonnen = Date.now()
    const daten = await bildErzeugen(job)
    const pfad = await ergebnisAblegen(job.user_id, job.id, i, daten)
    pfade.push(pfad)
    await fortschrittMerken(job.id, pfade)
    console.log(
      `  Bild ${i + 1}/${anzahl}: ${Math.round((Date.now() - begonnen) / 1000)}s, ` +
      `${Math.round(daten.byteLength / 1024)} kB → ${pfad}`,
    )
  }
  await auftragFertig(job.id, pfade)
  console.log('\nFertig. Oeffentliche Adresse(n):')
  for (const p of pfade) {
    console.log(`  ${config.supabaseUrl}/storage/v1/object/public/generated-images/${p}`)
  }
  console.log('')
} catch (e) {
  const fehler = e as Error
  const status = await auftragFehlgeschlagen(job.id, job.attempts, fehler.message)
  console.error(`\nFehlgeschlagen: ${fehler.message}`)
  console.error(status === 'failed'
    ? 'Endgueltig aufgegeben (Versuchsgrenze erreicht).\n'
    : 'Zurueck in der Warteschlange.\n')
  process.exit(1)
}

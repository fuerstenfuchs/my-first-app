/**
 * Genau einen Auftrag abarbeiten und aufhören.
 *
 * Für die Abnahme: einen Auftrag von Hand in die Tabelle schreiben, dies hier
 * starten, schauen ob etwas herauskommt. Läuft mit `npm run einmal`.
 *
 * Die eigentliche Arbeit macht abarbeiten.ts — dieselbe Logik wie im
 * Dauerbetrieb. Eine eigene Kopie hier ist zweimal hinterhergelaufen, zuletzt
 * beim zweiten Auftragstyp: Das Werkzeug schickte eine Vergrößerung an das
 * Bildmodell und bekam eine Absage.
 */

import { config } from './config.ts'
import { auftragAbarbeiten, beschreibung } from './abarbeiten.ts'
import { naechsterAuftrag, auftragFehlgeschlagen, ergebnisPfade } from './supabase.ts'

const job = await naechsterAuftrag()

if (!job) {
  console.log('\nKein wartender Auftrag. Nichts zu tun.\n')
  process.exit(0)
}

console.log(`\nAuftrag ${job.id}`)
console.log(`  ${beschreibung(job)}`)
if (job.job_type === 'generate') {
  console.log(`  Prompt: ${job.prompt.slice(0, 120)}${job.prompt.length > 120 ? '…' : ''}`)
  console.log('\nDas dauert bei quality=high ein bis drei Minuten pro Bild.\n')
} else {
  console.log('')
}

try {
  await auftragAbarbeiten(job, text => console.log(text))
  // DIE PFADE ZURÜCKLESEN, NICHT NACHBAUEN. Hier stand die Endung fest als
  // `.png` — seit PROJ-69 legt der Arbeiter JPEG ab, und jede so gebaute
  // Adresse wäre ein 404 gewesen. Der Zweck dieser Ausgabe ist ein Link zum
  // Anklicken; einer, der nicht trägt, ist schlimmer als gar keiner.
  const pfade = await ergebnisPfade(job.id)
  if (pfade.length === 0) {
    console.log('\nFertig — aber der Auftrag nennt keine Ergebnispfade.')
  } else {
    console.log('\nFertig. Öffentliche Adresse(n):')
    for (const pfad of pfade) {
      console.log(`  ${config.supabaseUrl}/storage/v1/object/public/generated-images/${pfad}`)
    }
  }
  console.log('')
} catch (e) {
  const fehler = e as Error
  const status = await auftragFehlgeschlagen(job.id, job.attempts, fehler.message)
  console.error(`\nFehlgeschlagen: ${fehler.message}`)
  console.error(status === 'failed'
    ? 'Endgültig aufgegeben (Versuchsgrenze erreicht).\n'
    : 'Zurück in der Warteschlange.\n')
  process.exit(1)
}

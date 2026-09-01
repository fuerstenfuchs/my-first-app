/**
 * Verbindungsprüfung — erzeugt KEIN Bild und kostet daher nichts.
 *
 * Sinn: Wenn hier alles grün ist, kann ein fehlgeschlagener Auftrag nicht mehr
 * an der Einrichtung liegen. Läuft mit `npm run pruefen`.
 */

import { config, ohneGeheimnis } from './config.ts'

let fehler = 0

function gut(text: string): void { console.log(`  [ok]     ${text}`) }
function schlecht(text: string): void { console.log(`  [FEHLER] ${text}`); fehler++ }

console.log('\nPrüfe die Einrichtung des Arbeiters\n')

// ── 1. Bild-Proxy ───────────────────────────────────────────────────────────
console.log('Bild-Proxy')
try {
  const antwort = await fetch(`${config.proxyUrl}/v1/models`, {
    headers: { Authorization: `Bearer ${config.proxyToken}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (antwort.ok) {
    gut(`erreichbar unter ${config.proxyUrl}, Token wird angenommen`)
  } else if (antwort.status === 401 || antwort.status === 403) {
    schlecht(`${config.proxyUrl} antwortet, lehnt den Token aber ab (HTTP ${antwort.status}). PROXY_TOKEN prüfen.`)
  } else {
    schlecht(`${config.proxyUrl} antwortet mit HTTP ${antwort.status}`)
  }
} catch (e) {
  schlecht(ohneGeheimnis(
    `${config.proxyUrl} nicht erreichbar (${(e as Error).message}). Läuft EasyCLIProxyAPI?`,
  ))
}

// ── 2. Supabase: Tabelle und Funktionen ─────────────────────────────────────
console.log('\nSupabase')
const kopf = {
  apikey: config.supabaseKey,
  Authorization: `Bearer ${config.supabaseKey}`,
  'Content-Type': 'application/json',
}

try {
  const antwort = await fetch(
    `${config.supabaseUrl}/rest/v1/image_jobs?select=id,status&limit=1`,
    { headers: kopf, signal: AbortSignal.timeout(15_000) },
  )
  if (antwort.ok) {
    gut('Tabelle image_jobs erreichbar')
  } else {
    const roh = await antwort.text().catch(() => '')
    schlecht(ohneGeheimnis(
      `Tabelle image_jobs nicht erreichbar (HTTP ${antwort.status}): ${roh.slice(0, 200)}` +
      '\n           Ist docs/proj-37-image-jobs.sql eingespielt? Ist es wirklich der service_role-Key?',
    ))
  }
} catch (e) {
  schlecht(ohneGeheimnis(`Supabase nicht erreichbar: ${(e as Error).message}`))
}

for (const [name, rumpf] of [
  ['claim_next_image_job', { max_attempts: 0 }],       // 0 Versuche = nimmt garantiert nichts
  ['requeue_stale_image_jobs', { stale_minutes: 99999 }], // so lange her = trifft nichts
] as const) {
  try {
    const antwort = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: kopf, body: JSON.stringify(rumpf),
      signal: AbortSignal.timeout(15_000),
    })
    if (antwort.ok) gut(`Funktion ${name} vorhanden`)
    else schlecht(`Funktion ${name} fehlt oder lehnt ab (HTTP ${antwort.status})`)
  } catch (e) {
    schlecht(`Funktion ${name}: ${(e as Error).message}`)
  }
}

// ── 3. Storage ──────────────────────────────────────────────────────────────
try {
  const antwort = await fetch(
    `${config.supabaseUrl}/storage/v1/bucket/generated-images`,
    { headers: kopf, signal: AbortSignal.timeout(15_000) },
  )
  if (antwort.ok) gut('Ablage generated-images vorhanden')
  else schlecht(`Ablage generated-images fehlt (HTTP ${antwort.status})`)
} catch (e) {
  schlecht(`Ablage: ${(e as Error).message}`)
}

// ── Ergebnis ────────────────────────────────────────────────────────────────
console.log('')
if (fehler === 0) {
  console.log('Alles bereit. Der Arbeiter kann mit `npm start` laufen.\n')
  process.exit(0)
} else {
  console.log(`${fehler} Punkt(e) offen — siehe oben.\n`)
  process.exit(1)
}

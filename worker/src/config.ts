/**
 * Konfiguration des Arbeiters.
 *
 * Alles kommt aus der Umgebung, nichts steht im Code. Gestartet wird mit
 * `node --env-file=.env src/index.ts` — Node lädt die Datei selbst, deshalb
 * braucht der Arbeiter keine einzige Abhängigkeit.
 */

function pflicht(name: string): string {
  const wert = process.env[name]
  if (!wert || !wert.trim()) {
    console.error(
      `\nIn der .env fehlt ${name}.\n` +
      `Vorlage: worker/.env.example — kopieren nach worker/.env und ausfüllen.\n`,
    )
    process.exit(1)
  }
  return wert.trim()
}

function zahl(name: string, vorgabe: number): number {
  const roh = process.env[name]
  if (!roh) return vorgabe
  const n = Number(roh)
  if (!Number.isFinite(n) || n <= 0) {
    console.error(`${name} muss eine positive Zahl sein, steht aber auf "${roh}".`)
    process.exit(1)
  }
  return n
}

export const config = {
  proxyUrl:   pflicht('PROXY_URL').replace(/\/+$/, ''),
  proxyToken: pflicht('PROXY_TOKEN'),

  supabaseUrl: pflicht('SUPABASE_URL').replace(/\/+$/, ''),
  // Service-Key, weil der Arbeiter niemandes Sitzung hat. Er umgeht damit RLS —
  // deshalb filtert er selbst nie nach Nutzer, sondern arbeitet ausschließlich
  // Aufträge ab, die claim_next_image_job ihm zuteilt.
  supabaseKey: pflicht('SUPABASE_SERVICE_KEY'),

  pollIntervalMs: zahl('POLL_INTERVAL_MS', 5000),
  // gpt-image-2 braucht bei quality=high oft ein bis drei Minuten pro Bild.
  requestTimeoutMs: zahl('REQUEST_TIMEOUT_MS', 300_000),
  staleMinutes: zahl('STALE_MINUTES', 10),
  maxAttempts: zahl('MAX_ATTEMPTS', 3),
}

/** Schlüssel aus Fehlertexten entfernen, bevor irgendetwas ausgegeben wird. */
export function ohneGeheimnis(text: string): string {
  let sauber = text
  for (const geheim of [config.proxyToken, config.supabaseKey]) {
    if (geheim && geheim.length > 6) {
      sauber = sauber.split(geheim).join('***')
    }
  }
  return sauber
}

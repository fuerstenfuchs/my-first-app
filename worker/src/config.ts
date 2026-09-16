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
  // Ab wann ein Auftrag auf 'running' als verwaist gilt.
  //
  // MUSS über der Zeit liegen, die ein EINZELNES Bild höchstens braucht — nicht
  // über der des ganzen Auftrags. Das ist kein Zufall: `fortschrittMerken`
  // frischt `started_at` nach jedem fertigen Bild auf, die Frist läuft also je
  // Bild neu. Bei requestTimeoutMs = 5 min ist 30 reichlich.
  //
  // Hier stand zuerst „4 Durchläufe mal 5 Minuten sind 20 Minuten". Das trug
  // nur, solange ein Auftrag höchstens 20 Minuten lief — mit Gemini wären es
  // 4 × 10 = 40. Ein Ausfall entsteht daraus nicht (siehe oben), aber wer die
  // alte Rechnung liest und STALE_MINUTES danach einstellt, rechnet falsch.
  //
  // Ein zu kleiner Wert reiht einen noch laufenden Auftrag neu ein — bei zwei
  // Arbeitern wird er dann ein zweites Mal erzeugt, und jedes Bild kostet Geld.
  staleMinutes: zahl('STALE_MINUTES', 30),
  maxAttempts: zahl('MAX_ATTEMPTS', 3),
  /**
   * Für wen dieser Arbeiter läuft — nur für das Lebenszeichen. Steht die
   * Kennung nicht in der .env, meldet er sich eben nicht; das ist kein Grund,
   * nicht zu arbeiten.
   */
  userId: (process.env.WORKER_USER_ID ?? '').trim(),
  /**
   * Zugang zu fal.ai fuer die KI-Vergroesserung. Bewusst KEINE Pflicht:
   * Erzeugen und rechnerisches Vergroessern kosten nichts und sollen nicht
   * daran haengen, dass irgendwo ein Guthabenkonto eingerichtet ist. Fehlt der
   * Schluessel, scheitert genau der eine Auftragstyp, der ihn braucht — mit
   * einem Satz, der sagt wo er hingehoert.
   */
  falKey: (process.env.FAL_KEY ?? '').trim(),
  /**
   * Wie lange auf fal.ai gewartet wird.
   *
   * Bewusst NICHT requestTimeoutMs mitbenutzt: Das ist die Zeitgrenze je Bild
   * beim lokalen Proxy. Wer sie wegen des Proxys herabsetzt, haette sonst
   * stillschweigend auch die Geduld gegenueber fal verkuerzt — und ein zu
   * frueh aufgegebener Lauf ist dort schon bezahlt.
   */
  falTimeoutMs: zahl('FAL_TIMEOUT_MS', 600_000),
  /**
   * Backblaze B2 für die ORIGINALE neuer Ergebnisse (15.09.2026).
   *
   * Seit dem Umzug liegen in Supabase nur WebP-Fassungen ≤ 2048 px; die
   * Originale gehören nach Backblaze. Bewusst KEINE Pflicht: Fehlt ein Wert,
   * legt der Arbeiter wie bisher in voller Größe ab. Lieber ein voller Speicher
   * als ein verlorenes Original — und ein Arbeiter, der wegen eines fehlenden
   * Archivs gar nicht startet, erzeugt auch keine Bilder.
   */
  b2KeyId: (process.env.B2_KEY_ID ?? '').trim(),
  b2AppKey: (process.env.B2_APP_KEY ?? '').trim(),
  b2Bucket: (process.env.B2_BUCKET ?? '').trim(),
}

export type B2Einrichtung =
  | { an: true; fehlt: [] }
  | { an: false; fehlt: string[]; teilweise: boolean }

/**
 * Ist Backblaze vollständig eingerichtet? Und wenn nicht: was fehlt?
 *
 * `teilweise` unterscheidet „bewusst aus" (nichts gesetzt) von „halb
 * eingetragen" — Letzteres ist fast immer ein Tippfehler in der .env und
 * verdient eine deutliche Meldung, nicht ein stilles Abschalten.
 */
export function b2Einrichtung(
  werte: { b2KeyId: string; b2AppKey: string; b2Bucket: string } = config,
): B2Einrichtung {
  const fehlt = ([['B2_KEY_ID', werte.b2KeyId], ['B2_APP_KEY', werte.b2AppKey], ['B2_BUCKET', werte.b2Bucket]] as const)
    .filter(([, wert]) => !wert)
    .map(([name]) => name)
  if (fehlt.length === 0) return { an: true, fehlt: [] }
  return { an: false, fehlt, teilweise: fehlt.length < 3 }
}

/** Schlüssel aus Fehlertexten entfernen, bevor irgendetwas ausgegeben wird. */
export function ohneGeheimnis(text: string): string {
  let sauber = text
  for (const geheim of [config.proxyToken, config.supabaseKey, config.falKey, config.b2KeyId, config.b2AppKey]) {
    if (geheim && geheim.length > 6) {
      sauber = sauber.split(geheim).join('***')
    }
  }
  return sauber
}

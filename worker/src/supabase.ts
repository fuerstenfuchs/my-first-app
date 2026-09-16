/**
 * Zugriff auf Supabase über die REST-Schnittstelle — ohne SDK, damit der
 * Arbeiter ohne node_modules auskommt.
 */

import { createHash, randomBytes } from 'node:crypto'
import { config, ohneGeheimnis } from './config.ts'
import type { FalAnfrage } from './fal.ts'
import { bildart } from './netz.ts'
import { alsJpeg } from './jpeg.ts'
import { b2AusKonfiguration, originalName, originalPraefix, B2Fehler, type B2Ablage } from './b2.ts'
import { fuerSpeicher, masseLesen, VERGROESSERUNGEN_VOLLE_GROESSE, type Speicherfassung, type Masse } from './speicher.ts'

export type ImageJob = {
  id: string
  user_id: string
  status: 'queued' | 'running' | 'done' | 'failed'
  attempts: number
  prompt: string
  model: string
  size: string
  aspect_ratio: string | null
  input_fidelity: string | null
  variants: number
  reference_urls: string[]
  reference_roles: string[]
  job_type: 'generate' | 'upscale'
  source_path: string | null
  scale: number | null
  upscaler: 'lanczos' | 'seedvr2' | 'crystal' | 'gemini' | null
  /** Nur bei Gemini: Groessenklasse statt Faktor. */
  ziel_klasse: '1K' | '2K' | '4K' | null
  external_ref: FalAnfrage | null
  anchor_job_id: string | null
  scene_meta: unknown
  result_paths: string[]
}

const kopf = {
  apikey: config.supabaseKey,
  Authorization: `Bearer ${config.supabaseKey}`,
  'Content-Type': 'application/json',
}

async function ruf(pfad: string, init: RequestInit): Promise<unknown> {
  const antwort = await fetch(`${config.supabaseUrl}${pfad}`, {
    ...init,
    headers: { ...kopf, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
  })
  const roh = await antwort.text()
  if (!antwort.ok) {
    throw new Error(ohneGeheimnis(`Supabase ${pfad} → HTTP ${antwort.status}: ${roh.slice(0, 300)}`))
  }
  return roh ? JSON.parse(roh) : null
}

/**
 * Nächsten wartenden Auftrag übernehmen.
 *
 * Die Sperre (`for update skip locked`) steckt in der Datenbankfunktion, weil
 * sie sich über REST nicht ausdrücken lässt. Ohne sie würden zwei versehentlich
 * gleichzeitig laufende Arbeiter denselben Auftrag doppelt abarbeiten — und
 * jedes Bild kostet Geld.
 */
export async function naechsterAuftrag(): Promise<ImageJob | null> {
  const ergebnis = await ruf('/rest/v1/rpc/claim_next_image_job', {
    method: 'POST',
    body: JSON.stringify({ max_attempts: config.maxAttempts }),
  }) as ImageJob[] | null
  return ergebnis?.[0] ?? null
}

/** Hängengebliebene Aufträge wieder einreihen (Arbeiter war abgestürzt). */
export async function haengendeAuftraegeEinsammeln(): Promise<number> {
  const anzahl = await ruf('/rest/v1/rpc/requeue_stale_image_jobs', {
    method: 'POST',
    body: JSON.stringify({
      stale_minutes: config.staleMinutes,
      max_attempts: config.maxAttempts,
    }),
  })
  return typeof anzahl === 'number' ? anzahl : 0
}

/**
 * Lebenszeichen setzen — eine Zeile je Nutzer, im Takt der Abfrage überschrieben.
 *
 * Damit die Warteschlange in der App sagen kann, ob überhaupt jemand die
 * Aufträge abholt. Ohne das sieht ein wartender Auftrag genauso aus, egal ob der
 * Arbeiter gleich zugreift oder seit gestern aus ist — und Stille sieht aus wie
 * Geduld.
 *
 * Fehler werden verschluckt: Ein Lebenszeichen ist eine Nebensache, es darf den
 * Betrieb nicht anhalten.
 */
export async function lebenszeichen(userId: string, version: string): Promise<void> {
  try {
    await ruf('/rest/v1/worker_heartbeat', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      // Ohne gesehen_am: Die Spalte hat default now(), die Datenbank stempelt
      // also selbst. Die PC-Uhr wich am 01.09.2026 um 34 Sekunden ab — ein
      // Zeitstempel von hier waere in der Zukunft gelandet.
      body: JSON.stringify({ user_id: userId, version }),
    })
  } catch { /* Nebensache */ }
}

async function auftragAendern(id: string, felder: Record<string, unknown>): Promise<void> {
  await ruf(`/rest/v1/image_jobs?id=eq.${id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(felder),
  })
}

/**
 * Zwischenstand nach jedem einzelnen Bild festhalten.
 *
 * Ohne das wäre ein Auftrag mit vier Durchläufen, der beim vierten Bild
 * abstürzt, ein Totalverlust: Die drei fertigen Bilder liegen zwar im Speicher,
 * aber keine Zeile weiß davon. Der Neuversuch begänne wieder bei null und
 * erzeugte sie ein zweites Mal — bezahlt würden sie zweimal.
 *
 * `started_at` wird dabei mit aufgefrischt und wird so zum Lebenszeichen:
 * requeue_stale_image_jobs misst dann die Zeit seit dem letzten fertigen Bild,
 * nicht seit dem Beginn des ganzen Auftrags.
 */
export async function fortschrittMerken(id: string, resultPaths: string[]): Promise<void> {
  await auftragAendern(id, {
    result_paths: resultPaths,
    started_at: new Date().toISOString(),
  })
}

/**
 * Die tatsaechlich abgelegten Pfade eines Auftrags zurueckholen.
 *
 * WARUM NICHT NACHBAUEN: `einmal.ts` hat die Adressen frueher aus user_id,
 * job_id, Laufnummer und der festen Endung `.png` zusammengesetzt. Seit
 * PROJ-69 legt der Arbeiter JPEG ab — jede so gebaute Adresse waere ein 404
 * gewesen. Der Auftrag weiss selbst, was er geschrieben hat; das ist die
 * einzige Quelle, die nicht veraltet, wenn sich die Ablage aendert.
 */
export async function ergebnisPfade(id: string): Promise<string[]> {
  const antwort = await fetch(
    `${config.supabaseUrl}/rest/v1/image_jobs?id=eq.${id}&select=result_paths`,
    {
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
      },
      signal: AbortSignal.timeout(30_000),
    },
  )
  if (!antwort.ok) return []
  const zeilen = await antwort.json() as { result_paths?: string[] | null }[]
  return zeilen[0]?.result_paths ?? []
}

/**
 * Den abgesendeten fal-Auftrag festhalten — das Gegenstueck zu
 * `fortschrittMerken`, nur ist das Bezahlte hier kein Bild, sondern eine
 * Auftragsnummer.
 *
 * WARUM DAS NOETIG IST: Ab dem Absenden ist der Lauf bezahlt. Jeder Fehler
 * danach — Zeitablauf, misslungenes Hochladen, eine einzelne 5xx-Antwort beim
 * Nachfragen, ein Neustart durch `node --watch`, zweimal Strg+C — stellt den
 * Auftrag zurueck auf 'queued'. Ohne diese Zeile schickt der naechste
 * Durchgang einen zweiten kostenpflichtigen Auftrag, obwohl drueben laengst
 * gerechnet wurde. Mit ihr wird dasselbe Ergebnis abgeholt.
 */
export async function externeAnfrageMerken(id: string, anfrage: unknown): Promise<void> {
  await auftragAendern(id, { external_ref: anfrage })
}

/**
 * Auftrag zurückstellen, ohne einen Versuch zu verbrauchen.
 *
 * Für den Abbruch durch den Bediener: Der Versuch hat ja nicht stattgefunden.
 * Würde hier nur der Status zurückgesetzt, bliebe ein im dritten Versuch
 * abgebrochener Auftrag mit attempts = 3 auf 'queued' stehen — claim holt ihn
 * wegen `attempts < max_attempts` nie wieder, requeue sieht ihn nicht (nur
 * 'running'), und auf /queue zeigt er für immer „Wartet". Stille, die aussieht
 * wie Geduld.
 */
export async function auftragZurueckstellen(
  id: string, attempts: number, grund: string,
): Promise<void> {
  await auftragAendern(id, {
    status: 'queued',
    attempts: Math.max(0, attempts - 1),
    error: ohneGeheimnis(grund).slice(0, 2000),
    started_at: null,
  })
}

/**
 * Auftrag abschließen. `zusatz` schreibt weitere Spalten im SELBEN Schritt —
 * seit 16.09.2026 den Vermerk „Original in Backblaze" (`scene_meta`) und bei
 * Vergrößerungen die tatsächlich abgelegte Größe (`size`). In einem Schritt,
 * damit die App nie einen fertigen Auftrag ohne Vermerk sieht.
 */
export async function auftragFertig(
  id: string, resultPaths: string[], zusatz: Record<string, unknown> = {},
): Promise<void> {
  await auftragAendern(id, {
    ...zusatz,
    status: 'done',
    finished_at: new Date().toISOString(),
    result_paths: resultPaths,
    error: null,
  })
}

/**
 * Fehlschlag vermerken. Unterhalb der Versuchsgrenze zurück in die
 * Warteschlange, darüber endgültig auf 'failed' — damit nichts endlos kreist.
 */
export async function auftragFehlgeschlagen(
  id: string, attempts: number, fehler: string,
): Promise<'queued' | 'failed'> {
  const status = attempts >= config.maxAttempts ? 'failed' : 'queued'
  await auftragAendern(id, {
    status,
    error: ohneGeheimnis(fehler).slice(0, 2000),
    ...(status === 'failed' ? { finished_at: new Date().toISOString() } : {}),
  })
  return status
}

/**
 * Referenzbild herunterladen. Die Buckets sind öffentlich lesbar.
 *
 * Nur Adressen aus dem eigenen Supabase-Speicher: Der Arbeiter läuft auf dem PC
 * und erreicht damit alles im Heimnetz — 127.0.0.1, den Router, den Bild-Proxy.
 * Die Adresse steht in einer Datenbankzeile, die der Browser schreibt, und der
 * Fehlertext landet sichtbar auf /queue. Ohne diese Schranke ließe sich von
 * außen abfragen, welche Geräte hier antworten.
 */
export async function bildHolen(url: string): Promise<{ daten: ArrayBuffer; typ: string }> {
  const erlaubt = `${config.supabaseUrl}/storage/v1/object/public/`
  if (!url.startsWith(erlaubt)) {
    throw new Error('Referenzbilder dürfen nur aus dem eigenen Speicher kommen.')
  }

  const antwort = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!antwort.ok) {
    throw new Error(`Referenzbild ${url.slice(0, 80)} → HTTP ${antwort.status}`)
  }
  const daten = await antwort.arrayBuffer()

  // DEN TYP AN DER SIGNATUR LESEN, NICHT AM KOPF.
  // Hier stand `antwort.headers.get('content-type') ?? 'image/png'`. Der
  // Speicher gibt genau das zurueck, was beim Hochladen behauptet wurde — und
  // das stimmt oft nicht. Am 04.09.2026 lehnte das Bildmodell deshalb eine
  // Vorlage ab: „Invalid image data ... images[0].image_url". `bildart` liest
  // die ersten Bytes, und die luegen nicht.
  const art = bildart(daten)
  if (!art) {
    const gemeldet = antwort.headers.get('content-type') ?? 'unbekannt'
    throw new Error(
      `Referenz ist kein lesbares Bild (gemeldet als ${gemeldet}). `
      + 'Haeufigste Ursachen: eine SVG-Datei oder eine Fehlerseite mit Status 200.',
    )
  }
  return { daten, typ: art.typ }
}

/**
 * Ein bereits abgelegtes Ergebnis wieder holen — Ausgangspunkt fürs Vergrößern.
 *
 * Der Pfad kommt aus einer Datenbankzeile, die der Browser geschrieben hat, und
 * geholt wird mit dem Service-Key — also unter Umgehung aller Storage-Regeln.
 * Deshalb wird hier geprüft, statt zu vertrauen: Der Pfad muss im Ordner des
 * Auftraggebers liegen, und er darf nichts enthalten, was die Adresse
 * umschreibt. Ein einziges `../` würde sonst genügen, um eine fremde Ablage zu
 * lesen — der URL-Parser löst es auf, bevor die Anfrage rausgeht.
 */
export async function ergebnisHolen(
  pfad: string, userId: string, abruf: typeof fetch = fetch,
): Promise<ArrayBuffer> {
  pfadPruefen(pfad, userId)
  return speicherLesenFrisch(abruf, pfad)
}

function pfadPruefen(pfad: string, userId: string): void {
  if (!pfad.startsWith(`${userId}/`)) {
    throw new Error('Das Ausgangsbild liegt nicht im eigenen Ordner.')
  }
  // Zeichen, die die Adresse umschreiben oder aus dem Ordner führen könnten.
  const unerlaubt = ['..', '?', '#', '%', '\\']
  if (unerlaubt.some(z => pfad.includes(z))) {
    throw new Error('Der Pfad des Ausgangsbildes enthält unerlaubte Zeichen.')
  }
}

const speicherAdresse = (pfad: string) =>
  `${config.supabaseUrl}/storage/v1/object/generated-images/${pfad.split('/').map(encodeURIComponent).join('/')}`

/**
 * Eine Datei aus generated-images lesen — FRISCH, am Zwischenspeicher vorbei.
 *
 * WARUM DER ZUFALLSPARAMETER: Cloudflare speichert bei Supabase AUCH den Weg
 * mit Service-Key zwischen. Beim Umzug am 15.09.2026 gemessen: ohne Parameter
 * „cf HIT" mit der alten PNG-Fassung, mit Parameter sofort die neue. Ohne ihn
 * rechnete eine Vergrößerung aus einem Bild, das es so nicht mehr gibt, und
 * die Rückprüfung nach dem Ablegen verglich mit dem Falschen.
 */
async function speicherLesenFrisch(abruf: typeof fetch, pfad: string): Promise<ArrayBuffer> {
  const antwort = await abruf(`${speicherAdresse(pfad)}?frisch=${Date.now()}-${randomBytes(4).toString('hex')}`, {
    headers: { apikey: config.supabaseKey, Authorization: `Bearer ${config.supabaseKey}` },
    signal: AbortSignal.timeout(120_000),
  })
  if (!antwort.ok) {
    throw new Error(ohneGeheimnis(`Ausgangsbild ${pfad} nicht abrufbar (HTTP ${antwort.status})`))
  }
  return antwort.arrayBuffer()
}

export type Abhaengigkeiten = {
  /** `undefined`: aus der Konfiguration; `null`: ausdrücklich ohne Backblaze. */
  b2?: B2Ablage | null
  abruf?: typeof fetch
  warten?: (ms: number) => Promise<void>
  /** Abbruch durch den Bediener — reicht bis in den Backblaze-Upload. */
  signal?: AbortSignal
  /** Was abgelegt wird. Vergrößerungen kann ein Schalter ausnehmen. */
  art?: 'erzeugung' | 'vergroesserung'
  /** Nur für Tests: überschreibt `VERGROESSERUNGEN_VOLLE_GROESSE`. */
  vergroesserungenVolleGroesse?: boolean
}

/**
 * Das Ausgangsbild zum Vergrößern — das ORIGINAL aus Backblaze, wenn es dort
 * eines gibt, sonst die Fassung aus Supabase.
 *
 * WARUM: Seit dem 15.09.2026 liegt in Supabase nur noch WebP ≤ 2048. Eine
 * 4×-Vergrößerung daraus wäre eine Vergrößerung einer Verkleinerung — bezahlt,
 * aber schlechter als nötig.
 *
 * DAS ORIGINAL MUSS ZU GENAU DIESER FASSUNG GEHÖREN (Critic B1, 15.09.2026).
 * Gesucht wird über `<user>/<job>/<index>.` — und derselbe Name kann zu einem
 * ANDEREN Bild gehören: Versuch 1 legt ein Original nach Backblaze, dann
 * scheitert Supabase; Versuch 2 erzeugt ein neues Bild und landet ohne
 * Backblaze als `0.jpg`. Eine Vergrößerung von `0.jpg` hätte sonst das Original
 * des verworfenen Bildes geholt. Deshalb gilt ein Original nur, wenn
 *   1. der Supabase-Pfad auf `.webp` endet — nur eine WebP-Fassung hat eines;
 *      ein Rückfall legt nie mit Original ab, sein Pfad wird nie gefragt;
 *   2. die Prüfsumme der Fassung, die JETZT in Supabase liegt, gleich der ist,
 *      die beim Ablegen am Original gespeichert wurde (`webp_sha256`).
 * Warum Prüfsumme statt einer neuen Spalte im Auftrag: Sie belegt die
 * Zusammengehörigkeit am Inhalt selbst und braucht keine Migration; eine
 * gespeicherte Zuordnung könnte veralten, der Inhalt nicht. Der Preis ist ein
 * kurzes Laden der kleinen Fassung (≤ 2048 px) vor jeder Vergrößerung.
 *
 * FÄLLT BACKBLAZE AUS — Tageslimit (`download_cap_exceeded`), Netz, Anmeldung —,
 * wird die Supabase-Fassung genommen und das im Protokoll gesagt (Critic S1).
 * Kein verbrauchter Versuch, kein Absturz: Eine Vergrößerung aus der 2048er-
 * Fassung ist schlechter, aber ein stehender Auftrag hilft niemandem.
 */
export async function quelleHolen(
  pfad: string, userId: string, abh: Abhaengigkeiten = {},
): Promise<{ daten: ArrayBuffer; herkunft: 'backblaze' | 'supabase'; hinweis: string | null }> {
  pfadPruefen(pfad, userId)
  const abruf = abh.abruf ?? fetch
  const b2 = abh.b2 === undefined ? b2AusKonfiguration() : abh.b2
  const praefix = originalPraefix(pfad)
  const ausSupabase = async (hinweis: string | null) =>
    ({ daten: await speicherLesenFrisch(abruf, pfad), herkunft: 'supabase' as const, hinweis })

  if (!b2 || !praefix || !pfad.endsWith('.webp')) return ausSupabase(null)

  try {
    const original = await b2.originalSuchen(praefix)
    if (!original) return ausSupabase('Kein Original in Backblaze, Quelle: Fassung aus Supabase')
    const erwartet = original.info.webp_sha256
    if (!erwartet) return ausSupabase('Original ohne Fassungs-Prüfsumme — nicht verwendet, Quelle: Fassung aus Supabase')

    const fassung = await speicherLesenFrisch(abruf, pfad)
    if (sha256(new Uint8Array(fassung)) !== erwartet) {
      return {
        daten: fassung, herkunft: 'supabase',
        hinweis: 'Original in Backblaze gehört zu einer anderen Fassung — nicht verwendet, Quelle: Fassung aus Supabase',
      }
    }
    const d = await b2.herunterladen(original.name)
    return { daten: d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) as ArrayBuffer, herkunft: 'backblaze', hinweis: null }
  } catch (e) {
    if (!(e instanceof B2Fehler)) {
      return ausSupabase(`Original nicht prüfbar (${ohneGeheimnis((e as Error).message)}), Quelle: 2048er-Fassung`)
    }
    // „Tageslimit" nur, wenn B2 es auch so nennt. Eine andere 403 (etwa ein
    // Schlüssel ohne Leserecht) braucht eine andere Handlung als Abwarten —
    // dafür muss ihr Code dastehen (Critic, 15.09.2026).
    if (e.code === 'download_cap_exceeded') {
      return ausSupabase('Original nicht erreichbar (Tageslimit), Quelle: 2048er-Fassung')
    }
    if (e.status === 403) {
      return ausSupabase(`Backblaze antwortet 403 (${e.code || 'ohne Code'}), Quelle: 2048er-Fassung`)
    }
    return ausSupabase(`Original nicht erreichbar (${ohneGeheimnis(e.message)}), Quelle: 2048er-Fassung`)
  }
}

/** Ergebnis ablegen. Pfadmuster {user_id}/{job_id}/{index}.{endung}. */
export type Ablage = {
  pfad: string
  /** Was WIRKLICH im Speicher liegt — nicht, was der Erzeuger geliefert hat. */
  groesse: number
  /** Ein Satz fürs Protokoll — immer gesetzt, auch wenn nichts umgewandelt wurde. */
  hinweis: string
  /** Ob umgewandelt wurde (WebP mit Original in Backblaze, oder JPEG wie bisher). */
  umgewandelt: boolean
  /** Name des Originals in Backblaze — `null`, wenn keins dort liegt. */
  original: string | null
  /** Maße dessen, was in Supabase liegt — `null`, wenn nicht lesbar. */
  masse: Masse | null
  /** Maße des Originals in Backblaze — `null`, wenn keins dort liegt. */
  originalMasse: Masse | null
}

async function speicherSchreiben(abruf: typeof fetch, pfad: string, daten: Uint8Array, typ: string): Promise<void> {
  const antwort = await abruf(speicherAdresse(pfad), {
    method: 'POST',
    headers: {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
      'Content-Type': typ,
      'x-upsert': 'true',
    },
    body: new Uint8Array(daten),
    signal: AbortSignal.timeout(120_000),
  })
  if (!antwort.ok) {
    const roh = await antwort.text().catch(() => '')
    throw new Error(ohneGeheimnis(`Hochladen fehlgeschlagen (HTTP ${antwort.status}): ${roh.slice(0, 300)}`))
  }
}

const sha256 = (d: Uint8Array) => createHash('sha256').update(d).digest('hex')

/**
 * Die abgelegte Fassung zurücklesen und vergleichen — mit Wiederholung.
 *
 * WARUM NICHT BEIM ERSTEN FEHLER WERFEN (Critic S2, 15.09.2026): Das Hochladen
 * ist in diesem Moment schon bestätigt. Ein kurzer Netzaussetzer beim
 * Zurücklesen hätte ein fertiges, bezahltes Ergebnis verworfen — der Auftrag
 * wäre gescheitert, obwohl alles richtig dalag. Geworfen wird nur, wenn
 * wirklich etwas ANDERES zurückkommt. Lässt sich gar nicht lesen, gilt die
 * Ablage als unbestätigt, und das Protokoll sagt es.
 */
async function zuruecklesen(
  abruf: typeof fetch, pfad: string, erwartet: string, warten: (ms: number) => Promise<void>,
): Promise<'gleich' | 'abweichend' | 'unbestaetigt'> {
  for (let versuch = 1; versuch <= 3; versuch++) {
    try {
      const zurueck = new Uint8Array(await speicherLesenFrisch(abruf, pfad))
      return sha256(zurueck) === erwartet ? 'gleich' : 'abweichend'
    } catch {
      if (versuch < 3) await warten(1000 * versuch)
    }
  }
  return 'unbestaetigt'
}

/**
 * Ein Ergebnis ablegen.
 *
 * MIT BACKBLAZE (Stufe 2, 15.09.2026) — in dieser Reihenfolge, wie beim Umzug:
 *   1. WebP-Fassung rechnen (`speicher.ts`). Lohnt sie nicht (GIF, unter
 *      300 KB, keine 30 % Ersparnis, Transparenz ginge verloren): weiter wie
 *      bisher, das Original bleibt ja in Supabase.
 *   2. Original nach Backblaze — und erst, wenn B2 SHA-1 und Länge BESTÄTIGT.
 *   3. Dann erst die WebP-Fassung nach Supabase.
 *   4. Zurücklesen, am Zwischenspeicher vorbei, und vergleichen.
 * Andersherum läge im schlechtesten Fall nur noch die kleine Fassung da.
 *
 * OHNE BACKBLAZE, oder wenn B2 nicht antwortet: wie bisher, volle Größe.
 * Lieber ein voller Speicher als ein verlorenes Original.
 */
export async function ergebnisAblegen(
  userId: string, jobId: string, index: number, daten: ArrayBuffer, abh: Abhaengigkeiten = {},
): Promise<Ablage> {
  const abruf = abh.abruf ?? fetch
  const warten = abh.warten ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)))
  // Vergrößerungen bleiben in voller Größe, solange Mark nicht anders
  // entschieden hat (`VERGROESSERUNGEN_VOLLE_GROESSE` in speicher.ts).
  const ausgenommen = abh.art === 'vergroesserung' &&
    (abh.vergroesserungenVolleGroesse ?? VERGROESSERUNGEN_VOLLE_GROESSE)
  const b2 = ausgenommen ? null : (abh.b2 === undefined ? b2AusKonfiguration() : abh.b2)
  let vorbemerkung = ausgenommen ? 'Vergrößerung in voller Größe · ' : ''

  if (b2) {
    const roh = Buffer.from(daten)
    let fassung: Speicherfassung
    try {
      fassung = await fuerSpeicher(roh)
    } catch (e) {
      fassung = { webp: null, grund: `WebP-Umwandlung fehlgeschlagen (${(e as Error).message})` }
    }

    if (fassung.webp) {
      const art = bildart(roh)
      const name = originalName(userId, jobId, index, art?.endung ?? 'bin')
      const webpSha = sha256(fassung.webp)
      let b2Fehler: string | null = null
      try {
        // Die Prüfsumme der Fassung hängt am Original — daran erkennt
        // `quelleHolen` später, dass beide zusammengehören (Critic B1).
        await b2.hochladen(name, roh, art?.typ ?? 'application/octet-stream', {
          info: { webp_sha256: webpSha },
          signal: abh.signal,
        })
      } catch (e) {
        // Ein Abbruch durch den Bediener ist kein Backblaze-Ausfall: nicht in
        // voller Größe ablegen, sondern aufhören (Critic K3).
        if (abh.signal?.aborted || (e as Error)?.name === 'AbortError') throw e
        b2Fehler = ohneGeheimnis((e as Error).message)
      }

      if (!b2Fehler) {
        const pfad = `${userId}/${jobId}/${index}.webp`
        await speicherSchreiben(abruf, pfad, fassung.webp, 'image/webp')
        const pruefung = await zuruecklesen(abruf, pfad, webpSha, warten)
        if (pruefung === 'abweichend') {
          throw new Error(`Nach dem Ablegen liegt nicht die WebP-Fassung da (${pfad}). Das Original ist in Backblaze: ${name}`)
        }
        return {
          pfad,
          groesse: fassung.webp.length,
          hinweis: `${fassung.grund} · Original in Backblaze` +
            (pruefung === 'unbestaetigt' ? ' · Rückprüfung nicht möglich (Netz)' : ''),
          umgewandelt: true,
          original: name,
          masse: { breite: fassung.breite, hoehe: fassung.hoehe },
          originalMasse: fassung.quelle,
        }
      }
      vorbemerkung = `Backblaze nicht erreichbar (${b2Fehler}) — in voller Größe abgelegt · `
    } else {
      vorbemerkung = `kein WebP: ${fassung.grund} · `
    }
  }

  // AB HIER JPEG (PROJ-69). Mark am 05.09.2026: „Wir lassen die PNGs drin und
  // nehmen aber ab jetzt JPEGs." Nachgemessen waren 661 PNG zusammen 1709 MB,
  // die 521 JPEG derselben Sammlung nur 151 MB. Bestehendes wird nicht
  // angefasst — hier geht nur Neues durch.
  //
  // `alsJpeg` gibt das Bild UNVERAENDERT zurueck, wenn es Transparenz benutzt,
  // schon JPEG ist oder als JPEG groesser waere. Deshalb muss `bildart` DANACH
  // laufen: Endung und Typ folgen dem, was tatsaechlich hochgeht.
  const { daten: fertig, umgewandelt, grund } = await alsJpeg(daten)

  // Endung und Typ folgen dem INHALT, nicht der Annahme. Vorher stand hier
  // fest `.png` mit `Content-Type: image/png` — Gemini liefert aber JPEG.
  // Ein JPEG unter PNG-Namen zeigt der Browser richtig an (er rät), aber ein
  // Bildprogramm oder eine Druckerei lehnt es ab, und der Fehler fällt erst
  // außerhalb der App auf.
  const art = bildart(fertig)
  if (!art) throw new Error('Das Ergebnis ist kein erkennbares Bild — nicht abgelegt.')
  const pfad = `${userId}/${jobId}/${index}.${art.endung}`
  await speicherSchreiben(abruf, pfad, fertig, art.typ)
  return {
    pfad,
    groesse: fertig.length,
    // IMMER melden, auch wenn nichts umgewandelt wurde — der Satz sagt dann,
    // WARUM nicht. Ein Ausfall von `sharp` sieht sonst genauso aus wie ein
    // Bild mit Transparenz, und beides sieht aus wie Erfolg.
    hinweis: vorbemerkung + grund,
    umgewandelt,
    original: null,
    masse: await masseLesen(fertig),
    originalMasse: null,
  }
}

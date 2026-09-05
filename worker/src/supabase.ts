/**
 * Zugriff auf Supabase über die REST-Schnittstelle — ohne SDK, damit der
 * Arbeiter ohne node_modules auskommt.
 */

import { config, ohneGeheimnis } from './config.ts'
import type { FalAnfrage } from './fal.ts'
import { bildart } from './netz.ts'
import { alsJpeg } from './jpeg.ts'

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

export async function auftragFertig(id: string, resultPaths: string[]): Promise<void> {
  await auftragAendern(id, {
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
export async function ergebnisHolen(pfad: string, userId: string): Promise<ArrayBuffer> {
  if (!pfad.startsWith(`${userId}/`)) {
    throw new Error('Das Ausgangsbild liegt nicht im eigenen Ordner.')
  }
  // Zeichen, die die Adresse umschreiben oder aus dem Ordner führen könnten.
  const unerlaubt = ['..', '?', '#', '%', '\\']
  if (unerlaubt.some(z => pfad.includes(z))) {
    throw new Error('Der Pfad des Ausgangsbildes enthält unerlaubte Zeichen.')
  }

  const antwort = await fetch(
    `${config.supabaseUrl}/storage/v1/object/generated-images/` +
      pfad.split('/').map(encodeURIComponent).join('/'),
    {
      headers: { apikey: config.supabaseKey, Authorization: `Bearer ${config.supabaseKey}` },
      signal: AbortSignal.timeout(120_000),
    },
  )
  if (!antwort.ok) {
    throw new Error(ohneGeheimnis(
      `Ausgangsbild ${pfad} nicht abrufbar (HTTP ${antwort.status})`))
  }
  return antwort.arrayBuffer()
}

/** Ergebnis ablegen. Pfadmuster {user_id}/{job_id}/{index}.png. */
export type Ablage = {
  pfad: string
  /** Was WIRKLICH im Speicher liegt — nicht, was der Erzeuger geliefert hat. */
  groesse: number
  /** Ein Satz fürs Protokoll — immer gesetzt, auch wenn nichts umgewandelt wurde. */
  hinweis: string
  /** Ob wirklich nach JPEG umgewandelt wurde. */
  umgewandelt: boolean
}

export async function ergebnisAblegen(
  userId: string, jobId: string, index: number, daten: ArrayBuffer,
): Promise<Ablage> {
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
  const antwort = await fetch(
    `${config.supabaseUrl}/storage/v1/object/generated-images/${pfad}`,
    {
      method: 'POST',
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
        'Content-Type': art.typ,
        'x-upsert': 'true',
      },
      body: new Uint8Array(fertig),
      signal: AbortSignal.timeout(120_000),
    },
  )
  if (!antwort.ok) {
    const roh = await antwort.text().catch(() => '')
    throw new Error(ohneGeheimnis(`Hochladen fehlgeschlagen (HTTP ${antwort.status}): ${roh.slice(0, 300)}`))
  }
  return {
    pfad,
    groesse: fertig.length,
    // IMMER melden, auch wenn nichts umgewandelt wurde — der Satz sagt dann,
    // WARUM nicht. Ein Ausfall von `sharp` sieht sonst genauso aus wie ein
    // Bild mit Transparenz, und beides sieht aus wie Erfolg.
    hinweis: grund,
    umgewandelt,
  }
}

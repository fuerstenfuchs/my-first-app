/**
 * Zugriff auf Supabase über die REST-Schnittstelle — ohne SDK, damit der
 * Arbeiter ohne node_modules auskommt.
 */

import { config, ohneGeheimnis } from './config.ts'

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
    body: JSON.stringify({ stale_minutes: config.staleMinutes }),
  })
  return typeof anzahl === 'number' ? anzahl : 0
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
  const typ = antwort.headers.get('content-type') ?? 'image/png'
  if (!typ.startsWith('image/')) {
    throw new Error(`Referenz ist kein Bild, sondern ${typ}`)
  }
  return { daten: await antwort.arrayBuffer(), typ }
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
export async function ergebnisAblegen(
  userId: string, jobId: string, index: number, daten: ArrayBuffer,
): Promise<string> {
  const pfad = `${userId}/${jobId}/${index}.png`
  const antwort = await fetch(
    `${config.supabaseUrl}/storage/v1/object/generated-images/${pfad}`,
    {
      method: 'POST',
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
      },
      body: daten,
      signal: AbortSignal.timeout(120_000),
    },
  )
  if (!antwort.ok) {
    const roh = await antwort.text().catch(() => '')
    throw new Error(ohneGeheimnis(`Hochladen fehlgeschlagen (HTTP ${antwort.status}): ${roh.slice(0, 300)}`))
  }
  return pfad
}

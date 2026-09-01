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

/** Referenzbild herunterladen. Die Buckets sind öffentlich lesbar. */
export async function bildHolen(url: string): Promise<{ daten: Uint8Array; typ: string }> {
  const antwort = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!antwort.ok) {
    throw new Error(`Referenzbild ${url.slice(0, 80)} → HTTP ${antwort.status}`)
  }
  const typ = antwort.headers.get('content-type') ?? 'image/png'
  if (!typ.startsWith('image/')) {
    throw new Error(`Referenz ist kein Bild, sondern ${typ}`)
  }
  return { daten: new Uint8Array(await antwort.arrayBuffer()), typ }
}

/** Ergebnis ablegen. Pfadmuster {user_id}/{job_id}/{index}.png. */
export async function ergebnisAblegen(
  userId: string, jobId: string, index: number, daten: Uint8Array,
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

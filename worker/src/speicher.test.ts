/**
 * Wächter über die Ablage neuer Ergebnisse (Stufe 2, 15.09.2026).
 *
 *  1. Die Regelkopie in `speicher.ts` stimmt mit `src/lib/speicher-regeln.ts`
 *     überein — Werte UND gemeinsame Beispiele.
 *  2. Die Umwandlung mit echtem `sharp`.
 *  3. Die Reihenfolge beim Ablegen: Original nach Backblaze, ERST DANN WebP
 *     nach Supabase, dann frisch zurücklesen. Ohne Backblaze wie bisher.
 *     Dazu: Wiederholung beim Zurücklesen (S2), Abbruch (K3), Vergrößerungen
 *     in voller Größe (S3).
 *  4. Das Ausgangsbild zum Vergrößern: Original nur, wenn es zu genau dieser
 *     Fassung gehört (B1); fällt Backblaze aus, sichtbar die Supabase-Fassung (S1).
 *
 * Läuft mit: npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import sharp from 'sharp'

process.env.PROXY_URL ??= 'http://127.0.0.1:8317'
process.env.PROXY_TOKEN ??= 'test'
process.env.SUPABASE_URL ??= 'https://beispiel.supabase.co'
process.env.SUPABASE_SERVICE_KEY ??= 'test'

const speicher = await import('./speicher.ts')
const { ergebnisAblegen, quelleHolen } = await import('./supabase.ts')
const { B2Fehler } = await import('./b2.ts')

type Beispiele = {
  masse: { name: string; breite: number; hoehe: number; ziel: unknown }[]
  ersparnis: { name: string; alt: number; neu: number; lohnt: boolean }[]
  kandidaten: { name: string; typ: string | null; groesse: number; ja: boolean }[]
  bewegt: { name: string; hex: string; bewegt: boolean }[]
}
const beispiele = JSON.parse(readFileSync(new URL('../../src/lib/speicher-regeln-beispiele.json', import.meta.url), 'utf8')) as Beispiele
const sha256 = (d: Uint8Array) => createHash('sha256').update(d).digest('hex')

// ── 1. Regelkopie ───────────────────────────────────────────────────────────

test('Regelkopie: dieselben Werte wie src/lib/speicher-regeln.ts', async () => {
  const vorlage = await import('../../src/lib/speicher-regeln.ts')
  assert.deepEqual(speicher.SPEICHER_REGELN, vorlage.SPEICHER_REGELN)
})

test('Regelkopie: gemeinsame Beispiele', () => {
  for (const b of beispiele.masse) assert.deepEqual(speicher.zielMasse(b.breite, b.hoehe), b.ziel, b.name)
  for (const b of beispiele.ersparnis) assert.equal(speicher.lohntSich(b.alt, b.neu), b.lohnt, b.name)
  for (const b of beispiele.kandidaten) assert.equal(speicher.kandidat(b.typ, b.groesse).ja, b.ja, b.name)
  for (const b of beispiele.bewegt) assert.equal(speicher.istBewegt(Buffer.from(b.hex, 'hex')), b.bewegt, b.name)
})

test('Schalter: Marks Entscheidung vom 16.09.2026 — Vergrößerungen werden verkleinert', () => {
  assert.equal(speicher.VERGROESSERUNGEN_VOLLE_GROESSE, false)
})

// ── Vermerk „Original in Backblaze" (16.09.2026) ────────────────────────────

test('Vermerk: Form wie in src/lib/speicher-vermerk.ts, übrige scene_meta bleibt', () => {
  const alt = { name: 'Szene', abgelegt: true, speicher: { originale: { 'u1/j1/0.webp': { ort: 'backblaze', masse: '1x1' } } } }
  const neu = speicher.speicherVermerk(alt, [
    { pfad: 'u1/j1/1.webp', originalMasse: { breite: 4608, hoehe: 3072 }, masse: { breite: 2048, hoehe: 1365 } },
    { pfad: 'u1/j1/2.jpg', originalMasse: null, masse: { breite: 1024, hoehe: 1024 } },
  ])
  assert.deepEqual(neu, {
    name: 'Szene', abgelegt: true,
    speicher: { originale: {
      'u1/j1/0.webp': { ort: 'backblaze', masse: '1x1' },
      'u1/j1/1.webp': { ort: 'backblaze', masse: '4608x3072' },
    } },
  })
})

test('Vermerk: nichts zu vermerken → null, scene_meta bleibt unangetastet', () => {
  assert.equal(speicher.speicherVermerk({ name: 'x' }, [{ pfad: 'u1/j1/0.jpg', originalMasse: null, masse: null }]), null)
  assert.equal(speicher.speicherVermerk(null, []), null)
})

test('Critic S1: Original nicht größer als die Fassung → kein Vermerk, keine Plakette', () => {
  // Ein 1024er-PNG: als WebP abgelegt, Original in Backblaze — aber gleich groß.
  const gleich = { breite: 1024, hoehe: 1024 }
  assert.equal(speicher.speicherVermerk({ name: 'x' }, [{ pfad: 'u1/j1/0.webp', originalMasse: gleich, masse: gleich }]), null)
  // Fehlen die abgelegten Maße, wird nichts behauptet.
  assert.equal(speicher.speicherVermerk({}, [{ pfad: 'u1/j1/0.webp', originalMasse: { breite: 4096, hoehe: 4096 }, masse: null }]), null)
  // Nur eine Seite größer (Streifen) zählt als größer.
  assert.notEqual(speicher.speicherVermerk({}, [{
    pfad: 'u1/j1/0.webp', originalMasse: { breite: 1440, hoehe: 20000 }, masse: { breite: 1440, hoehe: 16383 },
  }]), null)
})

// ── 2. Umwandlung ───────────────────────────────────────────────────────────

async function rauschPng(breite: number, hoehe: number): Promise<Buffer> {
  const roh = Buffer.alloc(breite * hoehe * 3)
  for (let y = 0; y < hoehe; y++) {
    for (let x = 0; x < breite; x++) {
      const i = (y * breite + x) * 3
      roh[i] = (x * 7 + y * 3 + ((x * y) % 17) * 9) & 0xff
      roh[i + 1] = ((x ^ y) * 5) & 0xff
      roh[i + 2] = (Math.floor(Math.sin(x * 0.3 + y * 0.7) * 120) + 128) & 0xff
    }
  }
  return sharp(roh, { raw: { width: breite, height: hoehe, channels: 3 } }).png().toBuffer()
}

const GROSS = await rauschPng(3000, 1500)

test('Umwandlung: großes PNG → WebP 2048×1024', async () => {
  const f = await speicher.fuerSpeicher(GROSS)
  assert.ok(f.webp, f.grund)
  const m = await sharp(f.webp).metadata()
  assert.deepEqual([m.format, m.width, m.height], ['webp', 2048, 1024])
})

test('Umwandlung: kleines Bild bleibt', async () => {
  const klein = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#336699' } }).png().toBuffer()
  const f = await speicher.fuerSpeicher(klein)
  assert.equal(f.webp, null)
})

// ── Attrappen ───────────────────────────────────────────────────────────────

type B2Opt = {
  wirft?: Error
  original?: { name: string; info: Record<string, string> } | null
  suchenWirft?: Error
  ladenWirft?: Error
}

function b2Attrappe(opt: B2Opt = {}) {
  const log: string[] = []
  const infos: Record<string, string>[] = []
  return {
    log, infos,
    b2: {
      anmelden: async () => { log.push('b2:anmelden') },
      hochladen: async (name: string, daten: Uint8Array, typ: string,
        optionen: { info?: Record<string, string>; signal?: AbortSignal } = {}) => {
        optionen.signal?.throwIfAborted()
        log.push(`b2:hochladen:${name}:${typ}:${daten.length}`)
        infos.push(optionen.info ?? {})
        if (opt.wirft) throw opt.wirft
        return { fileId: 'F', sha1: 'x' }
      },
      originalSuchen: async (praefix: string) => {
        log.push(`b2:suchen:${praefix}`)
        if (opt.suchenWirft) throw opt.suchenWirft
        return opt.original ?? null
      },
      herunterladen: async (name: string) => {
        log.push(`b2:laden:${name}`)
        if (opt.ladenWirft) throw opt.ladenWirft
        return Buffer.from('ORIGINAL')
      },
    },
  }
}

function supabaseAttrappe(log: string[], opt: {
  zurueckVerfaelscht?: boolean; lesefehler?: number; vorhanden?: Record<string, Buffer>
} = {}) {
  const abgelegt = new Map<string, Buffer>(Object.entries(opt.vorhanden ?? {}))
  let fehlerUebrig = opt.lesefehler ?? 0
  const abruf = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url)
    const pfad = decodeURIComponent(u.split('/generated-images/')[1]!.split('?')[0]!)
    if (init?.method === 'POST') {
      abgelegt.set(pfad, Buffer.from(init.body as Uint8Array))
      log.push(`sb:schreiben:${pfad}:${(init.headers as Record<string, string>)['Content-Type']}`)
      return new Response('{}')
    }
    log.push(`sb:lesen:${pfad}:${u.includes('?frisch=') ? 'frisch' : 'ZWISCHENSPEICHER'}`)
    if (fehlerUebrig > 0) { fehlerUebrig--; throw new TypeError('fetch failed') }
    const d = abgelegt.get(pfad) ?? Buffer.from('SUPABASE')
    return new Response(new Uint8Array(opt.zurueckVerfaelscht ? Buffer.from('anders') : d))
  }) as typeof fetch
  return { abruf, abgelegt }
}

const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
const ohneWarten = async () => {}

// ── 3. Ablegen ──────────────────────────────────────────────────────────────

test('mit Backblaze: ERST Original nach B2, DANN WebP nach Supabase, dann frisch zurücklesen', async () => {
  const { b2, log, infos } = b2Attrappe()
  const sb = supabaseAttrappe(log)
  const r = await ergebnisAblegen('u1', 'j1', 0, ab(GROSS), { b2, abruf: sb.abruf, warten: ohneWarten })
  assert.deepEqual(log.map(z => z.split(':').slice(0, 3).join(':')), [
    'b2:hochladen:tresor-supabase/worker/u1/j1/0.png',
    'sb:schreiben:u1/j1/0.webp',
    'sb:lesen:u1/j1/0.webp',
  ])
  assert.ok(log[0]!.endsWith(`:image/png:${GROSS.length}`), 'das ORIGINAL geht nach Backblaze, unverändert')
  assert.ok(log[2]!.endsWith(':frisch'), 'am Zwischenspeicher vorbei')
  assert.equal(infos[0]!.webp_sha256, sha256(sb.abgelegt.get('u1/j1/0.webp')!), 'Fassungs-Prüfsumme hängt am Original')
  assert.equal(r.pfad, 'u1/j1/0.webp')
  assert.equal(r.original, 'tresor-supabase/worker/u1/j1/0.png')
  assert.deepEqual(r.masse, { breite: 2048, hoehe: 1024 }, 'was in Supabase liegt')
  assert.deepEqual(r.originalMasse, { breite: 3000, hoehe: 1500 }, 'was in Backblaze liegt')
})

test('Backblaze antwortet nicht → KEIN WebP, volle Größe wie bisher', async () => {
  const { b2, log } = b2Attrappe({ wirft: new Error('B2 antwortet nicht') })
  const sb = supabaseAttrappe(log)
  const r = await ergebnisAblegen('u1', 'j1', 0, ab(GROSS), { b2, abruf: sb.abruf, warten: ohneWarten })
  assert.equal(log.some(z => z.includes('.webp')), false)
  assert.equal(r.original, null)
  assert.match(r.hinweis, /voller Größe/)
})

test('ohne Backblaze → keine B2-Aufrufe, Ablage wie bisher', async () => {
  const log: string[] = []
  const sb = supabaseAttrappe(log)
  const r = await ergebnisAblegen('u1', 'j1', 0, ab(GROSS), { b2: null, abruf: sb.abruf })
  assert.equal(log.some(z => z.startsWith('b2:')), false)
  assert.notEqual(r.pfad, 'u1/j1/0.webp')
})

test('Zurücklesen liefert etwas anderes → Fehler, Auftrag scheitert laut', async () => {
  const { b2, log } = b2Attrappe()
  const sb = supabaseAttrappe(log, { zurueckVerfaelscht: true })
  await assert.rejects(ergebnisAblegen('u1', 'j1', 0, ab(GROSS), { b2, abruf: sb.abruf, warten: ohneWarten }), /Original ist in Backblaze/)
})

test('S2: Zurücklesen scheitert zweimal am Netz, dann klappt es → Ergebnis bleibt', async () => {
  const { b2, log } = b2Attrappe()
  const sb = supabaseAttrappe(log, { lesefehler: 2 })
  const r = await ergebnisAblegen('u1', 'j1', 0, ab(GROSS), { b2, abruf: sb.abruf, warten: ohneWarten })
  assert.equal(r.pfad, 'u1/j1/0.webp')
  assert.equal(log.filter(z => z.startsWith('sb:lesen')).length, 3)
  assert.doesNotMatch(r.hinweis, /nicht möglich/)
})

test('S2: Zurücklesen gar nicht möglich → Ergebnis bleibt, Protokoll sagt es', async () => {
  const { b2, log } = b2Attrappe()
  const sb = supabaseAttrappe(log, { lesefehler: 99 })
  const r = await ergebnisAblegen('u1', 'j1', 0, ab(GROSS), { b2, abruf: sb.abruf, warten: ohneWarten })
  assert.equal(r.pfad, 'u1/j1/0.webp')
  assert.match(r.hinweis, /Rückprüfung nicht möglich/)
})

test('K3: Abbruch während des Backblaze-Uploads → wird weitergereicht, nichts in Supabase', async () => {
  const { b2, log } = b2Attrappe()
  const sb = supabaseAttrappe(log)
  const ac = new AbortController()
  ac.abort()
  await assert.rejects(
    ergebnisAblegen('u1', 'j1', 0, ab(GROSS), { b2, abruf: sb.abruf, signal: ac.signal }),
    (e: Error) => e.name === 'AbortError',
  )
  assert.equal(log.some(z => z.startsWith('sb:')), false)
})

test('S3 (Vorgabe seit 16.09.2026): Vergrößerung → Original nach Backblaze, WebP nach Supabase', async () => {
  const { b2, log } = b2Attrappe()
  const sb = supabaseAttrappe(log)
  const r = await ergebnisAblegen('u1', 'j9', 0, ab(GROSS), { b2, abruf: sb.abruf, warten: ohneWarten, art: 'vergroesserung' })
  assert.equal(r.pfad, 'u1/j9/0.webp')
  assert.equal(r.original, 'tresor-supabase/worker/u1/j9/0.png')
  assert.equal(log[0]!.startsWith('b2:hochladen:'), true, 'Original zuerst')
})

test('S3: Schalter wieder an → Vergrößerung in voller Größe, kein Backblaze', async () => {
  const { b2, log } = b2Attrappe()
  const sb = supabaseAttrappe(log)
  const r = await ergebnisAblegen('u1', 'j1', 0, ab(GROSS), {
    b2, abruf: sb.abruf, art: 'vergroesserung', vergroesserungenVolleGroesse: true,
  })
  assert.equal(log.some(z => z.startsWith('b2:')), false)
  assert.notEqual(r.pfad, 'u1/j1/0.webp')
  assert.match(r.hinweis, /Vergrößerung in voller Größe/)
})

test('S3: Vergrößerung einer Vergrößerung holt ihr Original aus Backblaze', async () => {
  // Erste Vergrößerung ablegen: Original mit Fassungs-Prüfsumme nach Backblaze.
  const erste = b2Attrappe()
  const log: string[] = []
  const sb = supabaseAttrappe(log)
  const r = await ergebnisAblegen('u1', 'up1', 0, ab(GROSS), {
    b2: erste.b2, abruf: sb.abruf, warten: ohneWarten, art: 'vergroesserung',
  })
  // Die zweite Vergrößerung nimmt `r.pfad` als source_path. Backblaze kennt das
  // Original unter demselben Namen, mit derselben Dateiinfo wie beim Ablegen.
  const zweite = b2Attrappe({ original: { name: r.original!, info: erste.infos[0]! } })
  const q = await quelleHolen(r.pfad, 'u1', { b2: zweite.b2, abruf: sb.abruf })
  assert.equal(q.herkunft, 'backblaze')
  assert.deepEqual(zweite.log, [
    'b2:suchen:tresor-supabase/worker/u1/up1/0.',
    'b2:laden:tresor-supabase/worker/u1/up1/0.png',
  ])
})

test('S3: normale Erzeugung wird trotz Schalter verkleinert', async () => {
  const { b2, log } = b2Attrappe()
  const sb = supabaseAttrappe(log)
  const r = await ergebnisAblegen('u1', 'j1', 0, ab(GROSS), { b2, abruf: sb.abruf, warten: ohneWarten, art: 'erzeugung' })
  assert.equal(r.pfad, 'u1/j1/0.webp')
})

// ── 4. Ausgangsbild zum Vergrößern ──────────────────────────────────────────

const FASSUNG = Buffer.from('WEBP-FASSUNG')
const ORIGINAL_PASSEND = { name: 'tresor-supabase/worker/u1/j1/0.png', info: { webp_sha256: sha256(FASSUNG) } }

test('B1: Original gehört zu genau dieser Fassung → aus Backblaze', async () => {
  const { b2, log } = b2Attrappe({ original: ORIGINAL_PASSEND })
  const sb = supabaseAttrappe(log, { vorhanden: { 'u1/j1/0.webp': FASSUNG } })
  const q = await quelleHolen('u1/j1/0.webp', 'u1', { b2, abruf: sb.abruf })
  assert.equal(q.herkunft, 'backblaze')
  assert.equal(Buffer.from(q.daten).toString(), 'ORIGINAL')
  assert.equal(q.hinweis, null)
})

test('B1: Original gehört zu einer ANDEREN Fassung → Supabase, mit Hinweis', async () => {
  const { b2, log } = b2Attrappe({ original: { name: ORIGINAL_PASSEND.name, info: { webp_sha256: sha256(Buffer.from('ALT')) } } })
  const sb = supabaseAttrappe(log, { vorhanden: { 'u1/j1/0.webp': FASSUNG } })
  const q = await quelleHolen('u1/j1/0.webp', 'u1', { b2, abruf: sb.abruf })
  assert.equal(q.herkunft, 'supabase')
  assert.equal(Buffer.from(q.daten).toString(), 'WEBP-FASSUNG')
  assert.match(q.hinweis!, /anderen Fassung/)
  assert.equal(log.some(z => z.startsWith('b2:laden')), false)
})

test('B1 (Critics Szenario): Neuversuch im Rückfall als 0.jpg → Backblaze wird gar nicht gefragt', async () => {
  const { b2, log } = b2Attrappe({ original: ORIGINAL_PASSEND })
  const sb = supabaseAttrappe(log)
  const q = await quelleHolen('u1/j1/0.jpg', 'u1', { b2, abruf: sb.abruf })
  assert.equal(q.herkunft, 'supabase')
  assert.equal(log.some(z => z.startsWith('b2:')), false)
})

test('B1: Original ohne Fassungs-Prüfsumme → nicht verwendet', async () => {
  const { b2, log } = b2Attrappe({ original: { name: ORIGINAL_PASSEND.name, info: {} } })
  const sb = supabaseAttrappe(log, { vorhanden: { 'u1/j1/0.webp': FASSUNG } })
  const q = await quelleHolen('u1/j1/0.webp', 'u1', { b2, abruf: sb.abruf })
  assert.equal(q.herkunft, 'supabase')
  assert.equal(log.some(z => z.startsWith('b2:laden')), false)
})

test('S1: Tageslimit beim Laden → Supabase-Fassung, Hinweis „Tageslimit"', async () => {
  const { b2, log } = b2Attrappe({
    original: ORIGINAL_PASSEND,
    ladenWirft: new B2Fehler('B2-Download x: HTTP 403 download_cap_exceeded', 403, 'download_cap_exceeded'),
  })
  const sb = supabaseAttrappe(log, { vorhanden: { 'u1/j1/0.webp': FASSUNG } })
  const q = await quelleHolen('u1/j1/0.webp', 'u1', { b2, abruf: sb.abruf })
  assert.equal(q.herkunft, 'supabase')
  assert.equal(q.hinweis, 'Original nicht erreichbar (Tageslimit), Quelle: 2048er-Fassung')
})

test('S1: eine andere 403 heißt nicht „Tageslimit", sondern nennt ihren Code', async () => {
  const { b2, log } = b2Attrappe({
    original: ORIGINAL_PASSEND,
    ladenWirft: new B2Fehler('B2-Download x: HTTP 403 unauthorized', 403, 'unauthorized'),
  })
  const sb = supabaseAttrappe(log, { vorhanden: { 'u1/j1/0.webp': FASSUNG } })
  const q = await quelleHolen('u1/j1/0.webp', 'u1', { b2, abruf: sb.abruf })
  assert.equal(q.herkunft, 'supabase')
  assert.equal(q.hinweis, 'Backblaze antwortet 403 (unauthorized), Quelle: 2048er-Fassung')
})

test('S1: Suche in Backblaze scheitert (Netz) → Supabase-Fassung, kein Absturz', async () => {
  const { b2, log } = b2Attrappe({ suchenWirft: new Error('fetch failed') })
  const sb = supabaseAttrappe(log, { vorhanden: { 'u1/j1/0.webp': FASSUNG } })
  const q = await quelleHolen('u1/j1/0.webp', 'u1', { b2, abruf: sb.abruf })
  assert.equal(q.herkunft, 'supabase')
  assert.match(q.hinweis!, /2048er-Fassung/)
})

test('Vergrößern: fremder Ordner → abgelehnt, bevor Backblaze gefragt wird', async () => {
  const { b2, log } = b2Attrappe({ original: ORIGINAL_PASSEND })
  const sb = supabaseAttrappe(log)
  await assert.rejects(quelleHolen('u2/j1/0.webp', 'u1', { b2, abruf: sb.abruf }), /eigenen Ordner/)
  assert.deepEqual(log, [])
})

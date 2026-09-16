/**
 * Wächter über das Backblaze-Archiv.
 *
 * Geprüft wird gegen einen nachgebauten B2-Server — nicht gegen das echte
 * Bucket. Es geht um genau die Regeln, die beim Umzug einmal gekostet haben:
 * neue Upload-Adresse nach einem Fehler, Bestätigung von SHA-1 und Länge,
 * Halt bei Lebenszyklusregeln, Prüfsumme beim Herunterladen — dazu die
 * Fassungs-Prüfsumme am Original (Critic B1), der Fehlercode beim Tageslimit
 * (S1) und der Abbruch (K3).
 *
 * Läuft mit: npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

process.env.PROXY_URL ??= 'http://127.0.0.1:8317'
process.env.PROXY_TOKEN ??= 'test'
process.env.SUPABASE_URL ??= 'https://beispiel.supabase.co'
process.env.SUPABASE_SERVICE_KEY ??= 'test'

const { b2Verbindung, originalName, originalPraefix, B2Fehler } = await import('./b2.ts')
const { b2Einrichtung } = await import('./config.ts')

const sha1 = (d: Uint8Array) => createHash('sha1').update(d).digest('hex')
const json = (daten: unknown, status = 200) =>
  new Response(JSON.stringify(daten), { status, headers: { 'content-type': 'application/json' } })

type UploadAntwort = 'ok' | 503 | 'falscheSha' | 'falscheLaenge'

function b2Server(opt: {
  lebenszyklus?: boolean; uploads?: UploadAntwort[]
  download?: 'passt' | 'falscheSha' | 'tageslimit'
} = {}) {
  const aufrufe: string[] = []
  const koepfe: Record<string, string>[] = []
  let uploadNr = 0
  let urlNr = 0
  const abruf = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url)
    if (u.endsWith('/b2_authorize_account')) {
      aufrufe.push('authorize')
      return json({
        accountId: 'A', authorizationToken: 'T',
        apiInfo: { storageApi: { apiUrl: 'https://api.b2', downloadUrl: 'https://dl.b2' } },
      })
    }
    if (u.endsWith('/b2_list_buckets')) {
      aufrufe.push('list_buckets')
      return json({ buckets: [{ bucketId: 'B', lifecycleRules: opt.lebenszyklus ? [{ daysFromHidingToDeleting: 1 }] : [] }] })
    }
    if (u.endsWith('/b2_get_upload_url')) {
      urlNr++
      aufrufe.push(`get_upload_url#${urlNr}`)
      return json({ uploadUrl: `https://up.b2/${urlNr}`, authorizationToken: `U${urlNr}` })
    }
    if (u.startsWith('https://up.b2/')) {
      const art = opt.uploads?.[uploadNr++] ?? 'ok'
      aufrufe.push(`upload@${u.slice(-1)}:${art}`)
      koepfe.push(init!.headers as Record<string, string>)
      if (art === 503) return json({ code: 'service_unavailable' }, 503)
      const rumpf = init!.body as Uint8Array
      assert.equal((init!.headers as Record<string, string>)['X-Bz-Content-Sha1'], sha1(rumpf), 'SHA-1 wird mitgeschickt')
      return json({
        fileId: 'F',
        contentSha1: art === 'falscheSha' ? '0'.repeat(40) : sha1(rumpf),
        contentLength: art === 'falscheLaenge' ? rumpf.length + 1 : rumpf.length,
      })
    }
    if (u.endsWith('/b2_list_file_names')) {
      aufrufe.push('list_file_names')
      const { prefix } = JSON.parse(String(init!.body)) as { prefix: string }
      return json({ files: [
        { fileName: `${prefix}png`, action: 'upload', uploadTimestamp: 2, fileInfo: { webp_sha256: 'abc123' } },
        { fileName: `${prefix}alt.png`, action: 'hide', uploadTimestamp: 3, fileInfo: {} },
      ] })
    }
    if (u.startsWith('https://dl.b2/file/')) {
      aufrufe.push('download')
      if (opt.download === 'tageslimit') return json({ code: 'download_cap_exceeded', status: 403 }, 403)
      const d = Buffer.from('ORIGINALBYTES')
      return new Response(new Uint8Array(d), { headers: {
        'x-bz-content-sha1': opt.download === 'falscheSha' ? '0'.repeat(40) : sha1(d),
        'content-length': String(d.length),
      } })
    }
    throw new Error(`unerwarteter Aufruf ${u}`)
  }) as typeof fetch
  return { abruf, aufrufe, koepfe }
}

const ohneWarten = async () => {}
const ZUGANG = { keyId: 'k', appKey: 'geheim', bucket: 'tresor' }

test('Namen: Original unter tresor-supabase/worker/<user>/<job>/<index>.<endung>', () => {
  assert.equal(originalName('u1', 'j1', 3, 'png'), 'tresor-supabase/worker/u1/j1/3.png')
  assert.equal(originalPraefix('u1/j1/3.webp'), 'tresor-supabase/worker/u1/j1/3.')
  assert.equal(originalPraefix('u1/referenzen/abc.png'), null, 'Referenzen sind keine Ergebnisse')
  assert.equal(originalPraefix('u1/j1/../3.png'), null)
})

test('Hochladen: anmelden, Upload-Adresse holen, hochladen, Bestätigung passt', async () => {
  const s = b2Server()
  const b2 = b2Verbindung(ZUGANG, s.abruf, ohneWarten)
  const r = await b2.hochladen('tresor-supabase/worker/u1/j1/0.png', Buffer.from('PNGDATEN'), 'image/png')
  assert.equal(r.sha1, sha1(Buffer.from('PNGDATEN')))
  assert.deepEqual(s.aufrufe, ['authorize', 'list_buckets', 'get_upload_url#1', 'upload@1:ok'])
})

test('Hochladen: die Fassungs-Prüfsumme geht als B2-Dateiinfo mit', async () => {
  const s = b2Server()
  await b2Verbindung(ZUGANG, s.abruf, ohneWarten)
    .hochladen('x/0.png', Buffer.from('A'), 'image/png', { info: { webp_sha256: 'f00d' } })
  assert.equal(s.koepfe[0]!['X-Bz-Info-webp_sha256'], 'f00d')
})

test('nach einem Fehler wird eine NEUE Upload-Adresse geholt', async () => {
  const s = b2Server({ uploads: [503, 'ok'] })
  const b2 = b2Verbindung(ZUGANG, s.abruf, ohneWarten)
  await b2.hochladen('x/0.png', Buffer.from('A'), 'image/png')
  assert.deepEqual(s.aufrufe, ['authorize', 'list_buckets', 'get_upload_url#1', 'upload@1:503', 'get_upload_url#2', 'upload@2:ok'])
})

test('falsche Prüfsumme in der Bestätigung → wirft sofort, kein zweiter Versuch', async () => {
  const s = b2Server({ uploads: ['falscheSha', 'ok'] })
  const b2 = b2Verbindung(ZUGANG, s.abruf, ohneWarten)
  await assert.rejects(b2.hochladen('x/0.png', Buffer.from('A'), 'image/png'), /andere Prüfsumme/)
  assert.equal(s.aufrufe.filter(a => a.startsWith('upload@')).length, 1)
})

test('falsche Länge in der Bestätigung → gilt als nicht gesichert', async () => {
  const s = b2Server({ uploads: ['falscheLaenge'] })
  const b2 = b2Verbindung(ZUGANG, s.abruf, ohneWarten)
  await assert.rejects(b2.hochladen('x/0.png', Buffer.from('ABC'), 'image/png'), /Länge/)
})

test('Abbruch durch den Bediener → sofort, ohne Upload, ohne Wiederholung', async () => {
  const s = b2Server()
  const ac = new AbortController()
  ac.abort()
  await assert.rejects(
    b2Verbindung(ZUGANG, s.abruf, ohneWarten).hochladen('x/0.png', Buffer.from('A'), 'image/png', { signal: ac.signal }),
    (e: Error) => e.name === 'AbortError',
  )
  assert.equal(s.aufrufe.some(a => a.startsWith('upload@')), false)
})

test('Lebenszyklusregeln im Bucket → Anmeldung verweigert', async () => {
  const s = b2Server({ lebenszyklus: true })
  const b2 = b2Verbindung(ZUGANG, s.abruf, ohneWarten)
  await assert.rejects(b2.anmelden(), /Lebenszyklusregeln/)
  await assert.rejects(b2.hochladen('x/0.png', Buffer.from('A'), 'image/png'), /Lebenszyklusregeln/)
  assert.equal(s.aufrufe.some(a => a.startsWith('upload@')), false, 'nichts hochgeladen')
})

test('Original suchen: nur hochgeladene Dateien, samt Dateiinfo', async () => {
  const s = b2Server()
  const b2 = b2Verbindung(ZUGANG, s.abruf, ohneWarten)
  assert.deepEqual(await b2.originalSuchen('tresor-supabase/worker/u1/j1/0.'), {
    name: 'tresor-supabase/worker/u1/j1/0.png', info: { webp_sha256: 'abc123' },
  })
})

test('Herunterladen prüft die Prüfsumme', async () => {
  const gut = b2Server()
  assert.equal((await b2Verbindung(ZUGANG, gut.abruf, ohneWarten).herunterladen('x/0.png')).toString(), 'ORIGINALBYTES')
  const falsch = b2Server({ download: 'falscheSha' })
  await assert.rejects(b2Verbindung(ZUGANG, falsch.abruf, ohneWarten).herunterladen('x/0.png'), /Prüfsumme/)
})

test('Tageslimit beim Herunterladen → B2Fehler mit Code download_cap_exceeded', async () => {
  const s = b2Server({ download: 'tageslimit' })
  await assert.rejects(b2Verbindung(ZUGANG, s.abruf, ohneWarten).herunterladen('x/0.png'), (e: unknown) =>
    e instanceof B2Fehler && e.status === 403 && e.code === 'download_cap_exceeded')
})

test('Einrichtung: vollständig, bewusst aus, halb eingetragen', () => {
  assert.deepEqual(b2Einrichtung({ b2KeyId: 'k', b2AppKey: 'a', b2Bucket: 'b' }), { an: true, fehlt: [] })
  assert.deepEqual(b2Einrichtung({ b2KeyId: '', b2AppKey: '', b2Bucket: '' }),
    { an: false, fehlt: ['B2_KEY_ID', 'B2_APP_KEY', 'B2_BUCKET'], teilweise: false })
  assert.deepEqual(b2Einrichtung({ b2KeyId: 'k', b2AppKey: '', b2Bucket: 'b' }),
    { an: false, fehlt: ['B2_APP_KEY'], teilweise: true })
})

/**
 * Wächter über den lokalen Weg (neuer PC).
 *
 * Drei Dinge dürfen nie kippen:
 *  1. Ein `lokal:`-Modell erreicht den Proxy NIE, ein Proxy-Modell nie den neuen PC.
 *  2. Das Geheimnis steht in keiner Meldung.
 *  3. Das Aufräumen auf dem neuen PC (DELETE) geschieht auch nach einem Fehler.
 *
 * Gegenstelle ist ein kleiner Nachbau des Arbeiters auf localhost.
 *
 * Läuft mit: npm test
 */

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

const GEHEIM = 'sehr-geheimes-token-123'
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 7)])

type Anfrage = { methode: string; pfad: string; token: string | undefined; rumpf: string }
const arbeiterAnfragen: Anfrage[] = []
let proxyTreffer = 0
let modus: 'ok' | 'fehler' | 'schlechterName' = 'ok'

function server(behandle: (a: Anfrage, res: http.ServerResponse) => void): Promise<http.Server> {
  return new Promise(ok => {
    const s = http.createServer((req, res) => {
      const teile: Buffer[] = []
      req.on('data', c => teile.push(c))
      req.on('end', () => behandle({
        methode: req.method ?? '', pfad: req.url ?? '',
        token: req.headers['x-fuchs-token'] as string | undefined,
        rumpf: Buffer.concat(teile).toString(),
      }, res))
    })
    s.listen(0, '127.0.0.1', () => ok(s))
  })
}

const json = (res: http.ServerResponse, code: number, o: unknown) => {
  res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o))
}

let arbeiter: http.Server
let proxy: http.Server

before(async () => {
  arbeiter = await server((a, res) => {
    arbeiterAnfragen.push(a)
    if (a.token !== GEHEIM) return json(res, 401, { fehler: 'nein' })
    if (a.methode === 'POST' && a.pfad === '/auftrag') return json(res, 200, { id: 'abcdef012345' })
    if (a.methode === 'GET' && a.pfad === '/auftrag/abcdef012345') {
      if (modus === 'fehler') return json(res, 200, { zustand: 'fehlgeschlagen', fehler: `kaputt ${GEHEIM}` })
      return json(res, 200, { zustand: 'fertig', ergebnisse: [{ name: modus === 'schlechterName' ? '../x.png' : 'bild-1.png' }] })
    }
    if (a.methode === 'GET' && a.pfad === '/auftrag/abcdef012345/bild/bild-1.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' }); return void res.end(PNG)
    }
    if (a.methode === 'DELETE') return json(res, 200, {})
    return json(res, 404, {})
  })
  proxy = await server((_a, res) => { proxyTreffer++; json(res, 500, {}) })

  process.env.PROXY_URL = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`
  process.env.PROXY_TOKEN = 'test'
  process.env.SUPABASE_URL = 'https://beispiel.supabase.co'
  process.env.SUPABASE_SERVICE_KEY = 'test'
  process.env.ARBEITER_URL = `http://127.0.0.1:${(arbeiter.address() as AddressInfo).port}/`
  process.env.ARBEITER_TOKEN = GEHEIM
})
after(() => { arbeiter.close(); proxy.close() })

function auftrag(model: string, extra: Record<string, unknown> = {}) {
  return {
    id: 'j1', user_id: 'u1', status: 'running', attempts: 1, prompt: 'eine Katze', model, size: '1024x1024',
    aspect_ratio: 'landscape_16_9', input_fidelity: null, variants: 1, reference_urls: [], reference_roles: [],
    job_type: 'generate', source_path: null, scale: null, upscaler: null, ziel_klasse: null, external_ref: null,
    anchor_job_id: null, scene_meta: null, result_paths: [], ...extra,
  } as never
}

test('Formate: Schlüssel des Trésor werden zu Pixelmassen, Unbekanntes bleibt dem Arbeiter überlassen', async () => {
  const { masseFuerFormat } = await import('./lokal.ts')
  assert.deepEqual(masseFuerFormat('landscape_16_9'), [1344, 768])
  assert.deepEqual(masseFuerFormat('portrait_4_5'), [896, 1120])
  assert.deepEqual(masseFuerFormat('cinematic_21_9'), [1568, 672])
  assert.equal(masseFuerFormat(null), undefined)
  assert.equal(masseFuerFormat('quatsch'), undefined)
  for (const [b, h] of Object.values({ a: [1344, 768], b: [896, 1120], c: [1568, 672] })) {
    assert.equal(b % 16, 0); assert.equal(h % 16, 0)
  }
})

test('Vorsilbe: nur `lokal:` zählt, und der Name dahinter wird geprüft', async () => {
  const { istLokalesModell, lokalesModellPruefen } = await import('./lokal.ts')
  assert.equal(istLokalesModell('lokal:qwen21'), true)
  assert.equal(istLokalesModell('gpt-image-2.5-sunburst'), false)
  assert.equal(istLokalesModell(null), false)
  assert.equal(lokalesModellPruefen('lokal:klein9b'), 'klein9b')
  assert.throws(() => lokalesModellPruefen('lokal:../etc'), /kein lokales Bildmodell/)
  assert.throws(() => lokalesModellPruefen('lokal:constructor'), /kein lokales Bildmodell/)
})

test('lokales Modell geht an den neuen PC und nie an den Proxy', async () => {
  const { auftragAbarbeiten } = await import('./abarbeiten.ts')
  arbeiterAnfragen.length = 0; proxyTreffer = 0; modus = 'ok'
  // Ablage nach Supabase ist hier nicht erreichbar — der Weg bis dorthin zählt.
  await auftragAbarbeiten(auftrag('lokal:qwen21'), () => {}).catch(() => undefined)
  assert.equal(proxyTreffer, 0, 'ein lokales Modell hat den Proxy erreicht')
  const post = arbeiterAnfragen.find(a => a.methode === 'POST')
  assert.ok(post, 'der neue PC bekam keinen Auftrag')
  const b = JSON.parse(post.rumpf)
  assert.equal(b.modell, 'qwen21')
  assert.equal(b.breite, 1344); assert.equal(b.hoehe, 768)
  assert.equal(b.anzahl, 1)
  assert.deepEqual(b.nachbearbeitung, { hochrechnen: 0, augenfarbe: false, augen_referenz: 0 })
})

test('der Schlüssel geht als Kopfzeile mit, nicht in den Rumpf', async () => {
  assert.ok(arbeiterAnfragen.every(a => a.token === GEHEIM))
  assert.ok(arbeiterAnfragen.every(a => !a.rumpf.includes(GEHEIM)))
})

test('Bild kommt als PNG zurück und der Auftrag wird dort aufgeräumt', async () => {
  const { bildErzeugenLokal } = await import('./lokal.ts')
  arbeiterAnfragen.length = 0; modus = 'ok'
  const daten = await bildErzeugenLokal(auftrag('lokal:klein9b'))
  assert.equal(Buffer.from(daten).length, PNG.length)
  assert.ok(arbeiterAnfragen.some(a => a.methode === 'DELETE'))
})

test('Fehler des neuen PC: Meldung ohne Geheimnis, und trotzdem aufgeräumt', async () => {
  const { bildErzeugenLokal } = await import('./lokal.ts')
  arbeiterAnfragen.length = 0; modus = 'fehler'
  await assert.rejects(bildErzeugenLokal(auftrag('lokal:qwen21')), (f: Error) => {
    assert.match(f.message, /kaputt/)
    assert.ok(!f.message.includes(GEHEIM), 'das Geheimnis steht in der Meldung')
    return true
  })
  assert.ok(arbeiterAnfragen.some(a => a.methode === 'DELETE'), 'nach dem Fehler nicht aufgeräumt')
})

test('ein Bildname aus der Antwort wird nur im bekannten Muster angenommen', async () => {
  const { bildErzeugenLokal } = await import('./lokal.ts')
  arbeiterAnfragen.length = 0; modus = 'schlechterName'
  await assert.rejects(bildErzeugenLokal(auftrag('lokal:qwen21')), /gültigen Bildnamen/)
  assert.ok(!arbeiterAnfragen.some(a => a.pfad.includes('..')))
})

test('Zahl der Referenzen wird vor dem Versand geprüft', async () => {
  const { bildErzeugenLokal } = await import('./lokal.ts')
  arbeiterAnfragen.length = 0
  await assert.rejects(bildErzeugenLokal(auftrag('lokal:sdxl_instantid')), /1 Referenzbild/)
  const fuenf = Array.from({ length: 5 }, (_, i) => `https://beispiel.supabase.co/storage/v1/object/public/x/${i}.png`)
  await assert.rejects(bildErzeugenLokal(auftrag('lokal:qwen21', { reference_urls: fuenf })), /0 bis 4/)
  assert.equal(arbeiterAnfragen.length, 0, 'es ging etwas an den neuen PC, obwohl die Prüfung ablehnen musste')
})

test('Referenzen nur aus dem eigenen Speicher', async () => {
  const { bildErzeugenLokal } = await import('./lokal.ts')
  arbeiterAnfragen.length = 0
  await assert.rejects(
    bildErzeugenLokal(auftrag('lokal:qwen21', { reference_urls: ['http://192.168.178.1/x.png'] })),
    /eigenen Speicher/,
  )
  assert.equal(arbeiterAnfragen.length, 0)
})

test('ein unbekanntes lokales Modell erreicht den neuen PC nicht', async () => {
  const { bildErzeugenLokal } = await import('./lokal.ts')
  arbeiterAnfragen.length = 0
  await assert.rejects(bildErzeugenLokal(auftrag('lokal:gibtsnicht')), /kein lokales Bildmodell/)
  assert.equal(arbeiterAnfragen.length, 0)
})

test('Gegenrichtung: ein Proxy- oder Gemini-Modell erreicht den neuen PC nie', async () => {
  const { auftragAbarbeiten } = await import('./abarbeiten.ts')
  for (const m of ['gpt-image-2.5-sunburst', 'gpt-image-2', 'gemini-3.1-flash-image']) {
    arbeiterAnfragen.length = 0
    await auftragAbarbeiten(auftrag(m, m.startsWith('gemini') ? { ziel_klasse: '2K' } : {}), () => {}).catch(() => undefined)
    assert.equal(arbeiterAnfragen.length, 0, `${m} hat den neuen PC erreicht`)
  }
})

test('ohne Format gilt die Groesse des Auftrags, nicht das Hochformat des Arbeiters', async () => {
  const { auftragAbarbeiten } = await import('./abarbeiten.ts')
  modus = 'ok'
  arbeiterAnfragen.length = 0
  await auftragAbarbeiten(auftrag('lokal:qwen21', { aspect_ratio: null, size: '1024x1024' }), () => {}).catch(() => undefined)
  const b = JSON.parse(arbeiterAnfragen.find(a => a.methode === 'POST')!.rumpf)
  assert.equal(b.breite, 1024); assert.equal(b.hoehe, 1024)
})

test('zu langer Prompt wird vor dem Versand abgelehnt', async () => {
  const { bildErzeugenLokal } = await import('./lokal.ts')
  arbeiterAnfragen.length = 0
  await assert.rejects(bildErzeugenLokal(auftrag('lokal:qwen21', { prompt: 'x'.repeat(6001) })), /höchstens 6000/)
  assert.equal(arbeiterAnfragen.length, 0)
})

test('falscher Schluessel wird sofort gemeldet, nicht nach Wiederholungen', async () => {
  const { bildErzeugenLokal } = await import('./lokal.ts')
  const { config } = await import('./config.ts')
  const alt = config.arbeiterToken
  ;(config as { arbeiterToken: string }).arbeiterToken = 'falsch-falsch'
  try {
    const t = Date.now()
    await assert.rejects(bildErzeugenLokal(auftrag('lokal:qwen21')), /Schlüssel/)
    assert.ok(Date.now() - t < 5000)
  } finally { (config as { arbeiterToken: string }).arbeiterToken = alt }
})

test('Pixelgroesse aus `size`: nur Zulaessiges', async () => {
  const { masseAusSize } = await import('./lokal.ts')
  assert.deepEqual(masseAusSize('1344x768'), [1344, 768])
  assert.equal(masseAusSize('1345x768'), undefined)
  assert.deepEqual(masseAusSize('1776x2656'), [1776, 2656], 'Stufe Maximal')
  assert.equal(masseAusSize('2816x2816'), undefined, 'über 5 Megapixel')
  assert.equal(masseAusSize('1024x1024'), undefined, 'gpt-Größe zählt nicht')
  assert.equal(masseAusSize('4096x4096'), undefined)
  assert.equal(masseAusSize('quatsch'), undefined)
})

test('Krea 2 geht ohne Referenz an den neuen PC und mit Referenz nicht', async () => {
  const { bildErzeugenLokal } = await import('./lokal.ts')
  modus = 'ok'
  arbeiterAnfragen.length = 0
  const fuenf = ['https://beispiel.supabase.co/storage/v1/object/public/x/0.png']
  await assert.rejects(bildErzeugenLokal(auftrag('lokal:krea2', { reference_urls: fuenf })), /0 Referenzbild/)
  assert.equal(arbeiterAnfragen.length, 0)
  const d = await bildErzeugenLokal(auftrag('lokal:krea2', { size: '1344x768' }))
  assert.ok(d.byteLength > 100)
  assert.equal(JSON.parse(arbeiterAnfragen.find(a => a.methode === 'POST')!.rumpf).modell, 'krea2')
})

test('Der Schalter Krea-Gewichte reist in scene_meta und geht nur bei Krea 2 an den neuen PC', async () => {
  const { bildErzeugenLokal } = await import('./lokal.ts')
  modus = 'ok'
  for (const [modell, meta, soll] of [
    ['lokal:krea2', { lokal: { krea_gewichte: true } }, true],
    ['lokal:krea2', { lokal: { krea_gewichte: 'ja' } }, undefined],
    ['lokal:krea2', null, undefined],
    ['lokal:qwen21', { lokal: { krea_gewichte: true } }, undefined],
  ] as const) {
    arbeiterAnfragen.length = 0
    await bildErzeugenLokal(auftrag(modell, { scene_meta: meta }))
    assert.equal(JSON.parse(arbeiterAnfragen.find(a => a.methode === 'POST')!.rumpf).krea_gewichte, soll, modell + JSON.stringify(meta))
  }
})

test('5K: das Bild geht in voller Groesse als quelle hin, der Modus als auf_5k', async () => {
  const { bildHochrechnen5k } = await import('./lokal.ts')
  modus = 'ok'
  for (const m of ['scharf', 'zwei_stufen'] as const) {
    arbeiterAnfragen.length = 0
    const quelle = PNG.buffer.slice(PNG.byteOffset, PNG.byteOffset + PNG.byteLength) as ArrayBuffer
    const d = await bildHochrechnen5k(quelle, m)
    assert.ok(d.byteLength > 100)
    const b = JSON.parse(arbeiterAnfragen.find(a => a.methode === 'POST')!.rumpf)
    assert.equal(b.modell, 'hochrechnen')
    assert.equal(b.nachbearbeitung.auf_5k, m)
    assert.equal(Buffer.from(b.quelle.base64, 'base64').length, PNG.length, 'nicht verkleinert, nicht verändert')
    assert.ok(arbeiterAnfragen.some(a => a.methode === 'DELETE'), 'aufgeräumt')
  }
})

test('5K: ein zu grosses Ausgangsbild wird vor dem Versand abgelehnt', async () => {
  const { bildHochrechnen5k } = await import('./lokal.ts')
  arbeiterAnfragen.length = 0
  await assert.rejects(bildHochrechnen5k(new ArrayBuffer(41 * 1024 * 1024), 'scharf'), /zu groß/)
  assert.equal(arbeiterAnfragen.length, 0)
})

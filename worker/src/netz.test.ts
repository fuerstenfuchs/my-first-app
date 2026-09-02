/**
 * Wächter über die zwei Handgriffe, die jede Anbindung braucht.
 *
 * WARUM ES DIESEN TEST GIBT: Der Fehler `signal ?? AbortSignal.timeout(...)`
 * wurde in diesem Projekt ZWEIMAL gemacht — erst in `fal.ts`, dort gefunden,
 * behoben und mit einem ausführlichen Kommentar versehen; dann trotzdem noch
 * einmal in `gemini.ts`, weil beim Schreiben einer neuen Datei niemand den
 * Kommentar in einer anderen aufschlägt.
 *
 * Er sieht harmlos aus und funktioniert im guten Fall tadellos. Auffallen
 * würde er erst, wenn eine Gegenstelle einmal nicht antwortet — und dann als
 * Stille, die aussieht wie Geduld.
 *
 * Läuft mit: npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.PROXY_URL ??= 'http://127.0.0.1:8317'
process.env.PROXY_TOKEN ??= 'test'
process.env.SUPABASE_URL ??= 'https://beispiel.supabase.co'
process.env.SUPABASE_SERVICE_KEY ??= 'test'

const { mitFrist, uebersetzeFehler, bildart } = await import('./netz.ts')

test('mitFrist bricht auch dann ab, wenn ein Signal übergeben wurde', async () => {
  const eigenes = new AbortController()
  const kombiniert = mitFrist(eigenes.signal, 30)

  assert.equal(kombiniert.aborted, false, 'darf nicht sofort abbrechen')
  await new Promise(f => setTimeout(f, 90))

  // DAS ist der Kern: Mit `signal ?? timeout(...)` wäre das hier false, weil
  // die Zeitgrenze nie erzeugt worden wäre.
  assert.equal(kombiniert.aborted, true, 'die Zeitgrenze muss auch mit Signal greifen')
  assert.equal((kombiniert.reason as Error).name, 'TimeoutError')
})

test('mitFrist reicht den Abbruch von außen durch, als AbortError', () => {
  const eigenes = new AbortController()
  const kombiniert = mitFrist(eigenes.signal, 60_000)
  eigenes.abort()
  assert.equal(kombiniert.aborted, true)
  assert.equal((kombiniert.reason as Error).name, 'AbortError')
})

test('mitFrist funktioniert auch ohne übergebenes Signal', async () => {
  const nur = mitFrist(undefined, 30)
  await new Promise(f => setTimeout(f, 90))
  assert.equal(nur.aborted, true)
})

test('uebersetzeFehler unterscheidet Zeitgrenze, Abbruch und Netzfehler', () => {
  const rein = (t: string) => t
  const zeit = uebersetzeFehler(
    Object.assign(new Error('x'), { name: 'TimeoutError' }), undefined, 5000, 'Dienst', rein)
  assert.match(zeit.message, /nach 5s nicht geantwortet/)

  const ab = new DOMException('Abgebrochen', 'AbortError')
  assert.equal(uebersetzeFehler(ab, undefined, 1000, 'Dienst', rein), ab, 'AbortError bleibt er selbst')

  // Der Fall, an dem index.ts sonst einen Versuch verbrennt: undici wirft beim
  // Abbruch während des Lesens einen TypeError, nicht einen AbortError.
  const c = new AbortController()
  c.abort()
  const getarnt = uebersetzeFehler(new TypeError('terminated'), c.signal, 1000, 'Dienst', rein)
  assert.equal(getarnt.name, 'AbortError', 'ein Abbruch darf seinen Namen nicht verlieren')

  const netz = uebersetzeFehler(new TypeError('fetch failed'), undefined, 1000, 'Dienst', rein)
  assert.equal(netz.name, 'Error')
  assert.match(netz.message, /Dienst nicht erreichbar/)
})

test('uebersetzeFehler entfernt Geheimnisse aus der Meldung', () => {
  const ohne = (t: string) => t.split('geheim123').join('***')
  const f = uebersetzeFehler(new TypeError('connect geheim123 failed'), undefined, 1000, 'Dienst', ohne)
  assert.ok(!f.message.includes('geheim123'), 'der Schlüssel darf nicht in der Meldung stehen')
})

test('bildart erkennt die Formate und lehnt alles andere ab', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
  assert.equal(bildart(png)?.endung, 'png')
  assert.equal(bildart(png)?.typ, 'image/png')
  assert.equal(bildart(jpg)?.endung, 'jpg')
  assert.equal(bildart(jpg)?.typ, 'image/jpeg')

  // Eine HTML-Fehlerseite mit HTTP 200 — der Fall, in dem Stille wie Erfolg
  // aussieht: sie landete sonst als „Bild" in der Ablage.
  assert.equal(bildart(Buffer.from('<!DOCTYPE html><html><body>oops')), null)
  assert.equal(bildart(Buffer.from('kurz')), null, 'zu kurz ist kein Bild')
})

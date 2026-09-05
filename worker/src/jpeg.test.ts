import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { alsJpeg } from './jpeg.ts'

/**
 * Die Ausnahme ist wichtiger als der Regelfall: Ein freigestelltes Bild, das
 * beim Umwandeln einen schwarzen Grund bekommt, ist ein LAUTLOSER Verlust —
 * die Datei ist gültig, kleiner, und niemand merkt es, bis Mark das Bild
 * benutzen will.
 */

/*
  DAS PRUEFBILD MUSS AUSSEHEN WIE EIN FOTO — beide Extreme sind hier falsch,
  und beide habe ich beim Bauen ausprobiert:

  * ein gleichmaessiges Muster presst PNG auf 8 kB; das JPEG war GROESSER, und
    `alsJpeg` behielt zu Recht das PNG.
  * reines Zufallsrauschen kann UMGEKEHRT auch JPEG nicht pressen — 158 kB
    JPEG gegen 34 kB PNG, dieselbe Ausnahme greift wieder.

  Ein Foto liegt dazwischen: oertlich glatt (dafuer das Weichzeichnen), aber
  ueber die ganze Flaeche vielfaeltig (dafuer das Rauschen darunter). Genau
  dort spielt JPEG seinen Vorteil aus, und genau darum geht es in PROJ-69.
*/
let saat = 12345
const zufall = () => (saat = (saat * 1103515245 + 12345) & 0x7fffffff) % 256

async function fotoRoh(kanaele: 3 | 4): Promise<Buffer> {
  const breite = 600, hoehe = 400
  const roh = Buffer.alloc(breite * hoehe * kanaele)
  for (let i = 0; i < roh.length; i++) {
    // Der Alphakanal bleibt voll deckend — sonst waere es kein Foto mehr,
    // sondern der Transparenzfall, den ein eigener Test abdeckt.
    roh[i] = (kanaele === 4 && i % 4 === 3) ? 255 : zufall()
  }
  return sharp(roh, { raw: { width: breite, height: hoehe, channels: kanaele } })
    .blur(4)
    .png()
    .toBuffer()
}

/** Ein deckendes Foto ohne Alphakanal. */
const foto = () => fotoRoh(3)

test('ein deckendes PNG wird zu JPEG und wird kleiner', async () => {
  const vorher = await foto()
  const { daten, grund } = await alsJpeg(vorher)
  const { format } = await sharp(daten).metadata()
  assert.equal(format, 'jpeg', 'sollte JPEG sein, war: ' + format + ' — ' + grund)
  assert.ok(daten.length < vorher.length, `kleiner erwartet: ${daten.length} vs ${vorher.length}`)
})

test('ein PNG mit durchsichtigen Stellen bleibt PNG', async () => {
  // Halb durchsichtig: genau der Fall, den JPEG schwarz machen würde.
  const mitLoch = await sharp({
    create: { width: 100, height: 100, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 0.5 } },
  }).png().toBuffer()
  const { daten, umgewandelt, grund } = await alsJpeg(mitLoch)
  const { format } = await sharp(daten).metadata()
  assert.equal(format, 'png', 'Transparenz muss PNG bleiben — ' + grund)
  assert.deepEqual(daten, mitLoch, 'die Daten sollen unverändert durchgereicht werden')
  assert.equal(umgewandelt, false)
  // AUF DEN ZWEIG festnageln, nicht nur aufs Ergebnis. Vier Wege fuehren zu
  // „unveraendert" — es muss dieser sein. (Nachgemessen: dieses Bild ist als
  // PNG 474 B, als JPEG 361 B; der Groessen-Rueckfall greift hier also NICHT
  // und kann die Transparenzpruefung nicht verdecken.)
  assert.match(grund, /durchsichtig/)
})

test('ein PNG MIT Alphakanal, aber ohne echte Transparenz, wird umgewandelt', async () => {
  // Der Fall, den eine Prüfung „hat Alphakanal?" falsch behandeln würde:
  // gpt-image-2 liefert PNG oft mit Alphakanal, in dem alles deckend ist.
  const deckend = await fotoRoh(4)
  const { daten, grund } = await alsJpeg(deckend)
  assert.equal((await sharp(daten).metadata()).format, 'jpeg',
    'deckender Alphakanal ist keine Transparenz — ' + grund)
})

test('ein JPEG wird nicht noch einmal umgewandelt', async () => {
  const j = await sharp({ create: { width: 50, height: 50, channels: 3, background: '#334455' } })
    .jpeg().toBuffer()
  const { daten, umgewandelt, grund } = await alsJpeg(j)
  assert.deepEqual(daten, j, 'unverändert erwartet — ' + grund)
  assert.equal(umgewandelt, false)
  assert.match(grund, /schon JPEG/)
})

test('kaputte Daten werden unveraendert durchgereicht, nicht verworfen', async () => {
  const muell = Buffer.from('das ist kein Bild')
  const { daten, umgewandelt, grund, fehler } = await alsJpeg(muell)
  assert.deepEqual(daten, muell)
  assert.equal(umgewandelt, false)
  // DER AUSFALL MUSS SICHTBAR SEIN. Faellt `sharp` aus, geht ab sofort jedes
  // Bild wieder als PNG hoch. Ohne diese Zusicherung koennte die Meldung
  // stillschweigend verschwinden, und PROJ-69 saehe erledigt aus, waehrend es
  // nichts tut.
  assert.ok(fehler instanceof Error, 'der Fehler muss durchgereicht werden')
  assert.match(grund, /fehlgeschlagen/)
})

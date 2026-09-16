/**
 * Wächter über die EXIF-Drehung beim rechnerischen Vergrößern (Critic, 15.09.2026).
 *
 * Seit Vergrößerungen ihr Original aus Backblaze holen, kann die Quelle ein
 * Foto mit EXIF-Drehung sein. Geprüft wird an PIXELN, nicht an Maßen: Mit
 * `fit: 'fill'` kämen die Maße auch ohne Drehung richtig heraus — nur läge das
 * Bild dann quer und verzerrt.
 *
 * Läuft mit: npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { bildVergroessern } from './upscale.ts'

test('EXIF-Drehung 6 wird vor dem Vergrößern angewandt', async () => {
  // 40×20, linke Hälfte rot, rechte blau. Drehung 6 heißt: zum Anzeigen 90° im
  // Uhrzeigersinn drehen — die linke Spalte wird dann zur OBERSTEN Zeile.
  const breite = 40
  const hoehe = 20
  const roh = Buffer.alloc(breite * hoehe * 3)
  for (let y = 0; y < hoehe; y++) {
    for (let x = 0; x < breite; x++) {
      const i = (y * breite + x) * 3
      if (x < breite / 2) roh[i] = 255
      else roh[i + 2] = 255
    }
  }
  const jpeg = await sharp(roh, { raw: { width: breite, height: hoehe, channels: 3 } })
    .jpeg({ quality: 100 })
    .withMetadata({ orientation: 6 })
    .toBuffer()

  const e = await bildVergroessern(jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength) as ArrayBuffer, 2)
  assert.deepEqual(e.vorher, { breite: 20, hoehe: 40 }, 'Maße der Quelle nach der Drehung')
  assert.deepEqual(e.nachher, { breite: 40, hoehe: 80 })

  const { data, info } = await sharp(Buffer.from(e.daten)).raw().toBuffer({ resolveWithObject: true })
  assert.deepEqual([info.width, info.height], [40, 80])
  const pixel = (x: number, y: number) => {
    const i = (y * info.width + x) * info.channels
    return { r: data[i]!, b: data[i + 2]! }
  }
  // Oben rechts rot, unten rechts blau — ohne Drehung wäre die rechte Seite
  // oben wie unten blau.
  assert.ok(pixel(35, 5).r > 200 && pixel(35, 5).b < 60, `oben rechts rot erwartet, war ${JSON.stringify(pixel(35, 5))}`)
  assert.ok(pixel(35, 75).b > 200 && pixel(35, 75).r < 60, `unten rechts blau erwartet, war ${JSON.stringify(pixel(35, 75))}`)
})

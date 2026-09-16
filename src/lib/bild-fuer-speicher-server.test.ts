import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { bildFuerSpeicherServer } from './bild-fuer-speicher-server'

/**
 * Die Server-Hilfe mit ECHTEM `sharp` — keine Attrappe.
 *
 * Die Bilder werden hier erzeugt: Rauschen, damit PNG groß wird (wie Fotos
 * und KI-Bilder), und Maße, an denen jede Regel greift.
 */

async function rauschPng(breite: number, hoehe: number, kanaele: 3 | 4, alpha?: (x: number) => number) {
  const roh = Buffer.alloc(breite * hoehe * kanaele)
  for (let y = 0; y < hoehe; y++) {
    for (let x = 0; x < breite; x++) {
      const i = (y * breite + x) * kanaele
      roh[i] = (x * 7 + y * 3 + ((x * y) % 17) * 9) & 0xff
      roh[i + 1] = ((x ^ y) * 5) & 0xff
      roh[i + 2] = (Math.floor(Math.sin(x * 0.3 + y * 0.7) * 120) + 128) & 0xff
      if (kanaele === 4) roh[i + 3] = alpha ? alpha(x) : 255
    }
  }
  return new Uint8Array(await sharp(roh, { raw: { width: breite, height: hoehe, channels: kanaele } }).png().toBuffer())
}

describe('bildFuerSpeicherServer (echtes sharp)', () => {
  it('großes PNG → WebP, längste Seite 2048, Maße stimmen', async () => {
    const png = await rauschPng(3000, 1500, 3)
    expect(png.length).toBeGreaterThan(300 * 1024)
    const r = await bildFuerSpeicherServer(png, 'png')
    expect(r.umgewandelt).toBe(true)
    expect(r).toMatchObject({ typ: 'image/webp', endung: 'webp' })
    const m = await sharp(r.daten).metadata()
    expect([m.format, m.width, m.height]).toEqual(['webp', 2048, 1024])
    expect(r.daten.length).toBeLessThanOrEqual(png.length * 0.7)
  }, 60_000)

  it('echte Transparenz bleibt erhalten', async () => {
    const png = await rauschPng(1600, 1000, 4, x => (x < 800 ? 0 : 255))
    const r = await bildFuerSpeicherServer(png, 'png')
    expect(r.umgewandelt).toBe(true)
    expect((await sharp(r.daten).metadata()).hasAlpha).toBe(true)
  }, 60_000)

  it('Datei unter 300 KB bleibt unverändert', async () => {
    const klein = new Uint8Array(await sharp({
      create: { width: 400, height: 400, channels: 3, background: { r: 200, g: 100, b: 50 } },
    }).png().toBuffer())
    expect(klein.length).toBeLessThan(300 * 1024)
    const r = await bildFuerSpeicherServer(klein, 'png')
    expect(r).toMatchObject({ umgewandelt: false, typ: 'image/png', endung: 'png' })
    expect(r.daten).toBe(klein)
  })

  it('APNG bleibt unverändert, ohne dass sharp es anfasst', async () => {
    const kopf = Buffer.from(
      '89504e470d0a1a0a0000000d494844520000000000000000000000000000000000000000086163544c000000000000000000000000000000004944415400000000',
      'hex',
    )
    const apng = new Uint8Array(Buffer.concat([kopf, Buffer.alloc(400 * 1024)]))
    const r = await bildFuerSpeicherServer(apng, 'png')
    expect(r).toMatchObject({ umgewandelt: false, endung: 'png' })
    expect(r.grund).toContain('APNG')
  })

  it('kein Bild → unverändert, Endung aus dem Namen', async () => {
    const r = await bildFuerSpeicherServer(new Uint8Array(500 * 1024), 'MOV')
    expect(r).toMatchObject({ umgewandelt: false, endung: 'mov' })
  })
})

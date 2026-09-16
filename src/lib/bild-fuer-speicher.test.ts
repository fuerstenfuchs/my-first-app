import { describe, it, expect, vi, afterEach } from 'vitest'
import { bildFuerSpeicher, browserUmgebung, kopfMasse, HOECHSTPIXEL, type BildUmgebung } from './bild-fuer-speicher'
import { bildHochladen, type HochladeZugang } from './bild-hochladen'

/**
 * Die Entscheidungen der Browser-Hilfe — ohne Canvas.
 *
 * Canvas und `createImageBitmap` gibt es in der Testumgebung nicht. Geprüft
 * wird deshalb, WAS die Hilfe mit dem entscheidet, was eine Umgebung liefert:
 * wann sie überhaupt dekodiert, mit welchen Maßen und welcher Qualität sie
 * kodieren lässt, und wann sie beim Original bleibt. Die Canvas-Umgebung selbst
 * (`browserUmgebung`) ist dünn und wird im Browser geprüft.
 */

const KB = 1024
function mitKopf(kopf: number[], groesse: number, typ: string): Blob {
  const a = new Uint8Array(groesse)
  a.set(kopf)
  return new Blob([a], { type: typ })
}
const PNG_KOPF = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]
const png = (groesse: number) => mitKopf(PNG_KOPF, groesse, 'image/png')
const webp = (groesse: number) =>
  mitKopf([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20], groesse, 'image/webp')

function umgebung(breite: number, hoehe: number, ergebnis: () => Blob | null | Promise<Blob | null>) {
  const kodieren = vi.fn(async () => ergebnis())
  const freigeben = vi.fn()
  const dekodieren = vi.fn(async () => ({ breite, hoehe, kodieren, freigeben }))
  return { umgebung: { dekodieren } satisfies BildUmgebung, dekodieren, kodieren, freigeben }
}

describe('bildFuerSpeicher', () => {
  it('großes PNG → WebP, auf 2048 verkleinert, Qualität 82', async () => {
    const u = umgebung(4096, 2048, () => webp(100 * KB))
    const r = await bildFuerSpeicher(png(1000 * KB), { umgebung: u.umgebung })
    expect(r.umgewandelt).toBe(true)
    expect(r.typ).toBe('image/webp')
    expect(r.endung).toBe('webp')
    expect(u.kodieren).toHaveBeenCalledWith(2048, 1024, 82)
    expect(u.freigeben).toHaveBeenCalledTimes(1)
  })

  it('WebP spart keine 30 % → das Original bleibt, samt Endung', async () => {
    const original = png(1000 * KB)
    const u = umgebung(2000, 1000, () => webp(701 * KB))
    const r = await bildFuerSpeicher(original, { umgebung: u.umgebung })
    expect(r.umgewandelt).toBe(false)
    expect(r.blob).toBe(original)
    expect(r.endung).toBe('png')
    expect(r.typ).toBe('image/png')
  })

  it('der Browser liefert statt WebP ein PNG → das Original bleibt', async () => {
    const u = umgebung(3000, 2000, () => png(50 * KB))
    const r = await bildFuerSpeicher(png(1000 * KB), { umgebung: u.umgebung })
    expect(r.umgewandelt).toBe(false)
  })

  it('nicht dekodierbar (HEIC-artig) → Original, ohne Fehler', async () => {
    const dekodieren = vi.fn(async () => { throw new Error('unsupported') })
    const r = await bildFuerSpeicher(png(1000 * KB), { umgebung: { dekodieren } })
    expect(r.umgewandelt).toBe(false)
    expect(r.endung).toBe('png')
  })

  it('Kodieren wirft → Original, und das Bild wird trotzdem freigegeben', async () => {
    const u = umgebung(3000, 2000, () => { throw new Error('kaputt') })
    const r = await bildFuerSpeicher(png(1000 * KB), { umgebung: u.umgebung })
    expect(r.umgewandelt).toBe(false)
    expect(u.freigeben).toHaveBeenCalledTimes(1)
  })

  it('APNG → wird gar nicht erst dekodiert', async () => {
    const apng = mitKopf([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...new Array(17).fill(0),
      0, 0, 0, 8, 0x61, 0x63, 0x54, 0x4c, ...new Array(12).fill(0),
    ], 1000 * KB, 'image/png')
    const u = umgebung(4096, 4096, () => webp(10 * KB))
    const r = await bildFuerSpeicher(apng, { umgebung: u.umgebung })
    expect(r.umgewandelt).toBe(false)
    expect(u.dekodieren).not.toHaveBeenCalled()
  })

  it('GIF, großes WebP und Dateien unter 300 KB → gar nicht erst dekodiert', async () => {
    const u = umgebung(4096, 4096, () => webp(10 * KB))
    const gif = mitKopf([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, ...new Array(10).fill(0)], 1000 * KB, 'image/gif')
    for (const datei of [gif, webp(5000 * KB), png(299 * KB)]) {
      const r = await bildFuerSpeicher(datei, { umgebung: u.umgebung })
      expect(r.umgewandelt).toBe(false)
      expect(r.blob).toBe(datei)
    }
    expect(u.dekodieren).not.toHaveBeenCalled()
  })

  it('ein Video geht unverändert durch — Endung aus dem Namen, Typ aus der Datei', async () => {
    const u = umgebung(1, 1, () => null)
    const video = new Blob([new Uint8Array(2000 * KB)], { type: 'video/mp4' })
    const r = await bildFuerSpeicher(video, { nameEndung: 'MP4', umgebung: u.umgebung })
    expect(r).toMatchObject({ umgewandelt: false, endung: 'mp4', typ: 'video/mp4' })
    expect(u.dekodieren).not.toHaveBeenCalled()
  })
})

// ─── S4/S5 (Critic, 15.09.2026): Drehung und große Handyfotos ────────────────

/** PNG-Kopf mit echten Maßen im IHDR-Block. */
function pngMit(breite: number, hoehe: number, groesse = 1000 * KB): Blob {
  const kopf = new Uint8Array(33)
  kopf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  new DataView(kopf.buffer).setUint32(16, breite)
  new DataView(kopf.buffer).setUint32(20, hoehe)
  const a = new Uint8Array(groesse)
  a.set(kopf)
  return new Blob([a], { type: 'image/png' })
}

/** JPEG-Kopf: optional APP1/EXIF mit Drehung, dann SOF0 mit Maßen. */
function jpegKopf(breite: number, hoehe: number, drehung?: number, kleinesEndian = false): Uint8Array {
  const teile: number[] = [0xff, 0xd8]
  if (drehung) {
    const w16 = (n: number) => (kleinesEndian ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff])
    const w32 = (n: number) => (kleinesEndian ? [n & 0xff, (n >> 8) & 0xff, 0, 0] : [0, 0, (n >> 8) & 0xff, n & 0xff])
    const tiff = [...(kleinesEndian ? [0x49, 0x49] : [0x4d, 0x4d]), ...w16(42), ...w32(8),
      ...w16(1), ...w16(0x0112), ...w16(3), ...w32(1), ...w16(drehung), 0, 0, ...w32(0)]
    const nutz = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]
    teile.push(0xff, 0xe1, (nutz.length + 2) >> 8, (nutz.length + 2) & 0xff, ...nutz)
  }
  teile.push(0xff, 0xc0, 0, 17, 8, hoehe >> 8, hoehe & 0xff, breite >> 8, breite & 0xff, 3, ...new Array(9).fill(0))
  return Uint8Array.from(teile)
}

describe('kopfMasse — Maße aus dem Dateikopf, ohne zu dekodieren', () => {
  it('PNG aus dem IHDR-Block', async () => {
    expect(kopfMasse(new Uint8Array(await pngMit(8160, 6120, 64).arrayBuffer()))).toEqual({ breite: 8160, hoehe: 6120 })
  })
  it('JPEG ohne Drehung', () => {
    expect(kopfMasse(jpegKopf(4000, 3000))).toEqual({ breite: 4000, hoehe: 3000 })
  })
  it('JPEG mit EXIF-Drehung 6 (hochkant fotografiert): Breite und Höhe vertauscht', () => {
    expect(kopfMasse(jpegKopf(4000, 3000, 6))).toEqual({ breite: 3000, hoehe: 4000 })
    expect(kopfMasse(jpegKopf(4000, 3000, 8, true))).toEqual({ breite: 3000, hoehe: 4000 })
  })
  it('JPEG mit Drehung 3 (auf dem Kopf): nicht vertauscht', () => {
    expect(kopfMasse(jpegKopf(4000, 3000, 3))).toEqual({ breite: 4000, hoehe: 3000 })
  })
  it('kaputter Kopf → null', () => {
    expect(kopfMasse(Uint8Array.from([0xff, 0xd8, 0x12, 0x34, 0, 0]))).toBeNull()
    expect(kopfMasse(new Uint8Array(40))).toBeNull()
  })

  // ── Sollte 3 (Critic, 15.09.2026): Kopf-Fälle aus echten JPEG-Dateien ──

  /** Ein Segment: Marke, Länge (inkl. der 2 Längenbytes), Inhalt. */
  const segment = (marke: number, inhalt: number[]) =>
    [0xff, marke, (inhalt.length + 2) >> 8, (inhalt.length + 2) & 0xff, ...inhalt]
  const sof = (marke: number, breite: number, hoehe: number) =>
    segment(marke, [8, hoehe >> 8, hoehe & 0xff, breite >> 8, breite & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1])
  const jpeg = (...teile: number[][]) => Uint8Array.from([0xff, 0xd8, ...teile.flat()])

  it('DQT und DHT vor dem SOF werden übersprungen', () => {
    const dqt = segment(0xdb, new Array(65).fill(1))
    const dht = segment(0xc4, new Array(30).fill(2))
    expect(kopfMasse(jpeg(dqt, dht, sof(0xc0, 1920, 1080)))).toEqual({ breite: 1920, hoehe: 1080 })
  })

  it('DHT (0xC4) wird trotz seiner Marke im SOF-Bereich nicht als SOF gelesen', () => {
    const dhtMitMassen = segment(0xc4, [0, 0x11, 0x22, 0x33, 0x44, ...new Array(20).fill(0)])
    expect(kopfMasse(jpeg(dhtMitMassen, sof(0xc0, 800, 600)))).toEqual({ breite: 800, hoehe: 600 })
  })

  it('SOF2 (progressiv) liefert die Maße', () => {
    expect(kopfMasse(jpeg(segment(0xdb, [0, 1, 2]), sof(0xc2, 6000, 4000)))).toEqual({ breite: 6000, hoehe: 4000 })
  })

  it('Füllbytes FF FF vor einer Marke', () => {
    expect(kopfMasse(jpeg([0xff, 0xff, 0xff], sof(0xc0, 640, 480)))).toEqual({ breite: 640, hoehe: 480 })
  })

  it('abgeschnittener SOF → null, kein Absturz', () => {
    const ganz = jpeg(sof(0xc0, 640, 480))
    expect(kopfMasse(ganz.slice(0, 2 + 6))).toBeNull()
  })

  it('Datei endet mitten in einem Segment → null, kein Absturz', () => {
    const dqt = segment(0xdb, new Array(200).fill(1))
    expect(kopfMasse(jpeg(dqt).slice(0, 50))).toBeNull()
  })

  it('IFD-Offset hinter dem Dateiende → Drehung ignoriert, Maße aus dem SOF', () => {
    const exif = segment(0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0,
      0x4d, 0x4d, 0, 42, 0x7f, 0xff, 0xff, 0xff])
    expect(kopfMasse(jpeg(exif, sof(0xc0, 4000, 3000)))).toEqual({ breite: 4000, hoehe: 3000 })
  })
})

describe('bildFuerSpeicher — Drehung und Größe', () => {
  it('bekannte Maße: gleich in Zielgröße dekodieren, dann 1:1 kodieren', async () => {
    const u = umgebung(2048, 1536, () => webp(100 * KB))
    const r = await bildFuerSpeicher(pngMit(8160, 6120), { umgebung: u.umgebung })
    expect(u.dekodieren).toHaveBeenCalledWith(expect.any(Blob), { breite: 2048, hoehe: 1536 })
    expect(u.kodieren).toHaveBeenCalledWith(2048, 1536, 82)
    expect(r.umgewandelt).toBe(true)
  })

  it('Maße nach dem Dekodieren passen nicht (Drehung anders angewandt) → Original', async () => {
    const u = umgebung(1536, 2048, () => webp(100 * KB))
    const r = await bildFuerSpeicher(pngMit(8160, 6120), { umgebung: u.umgebung })
    expect(r.umgewandelt).toBe(false)
    expect(u.kodieren).not.toHaveBeenCalled()
    expect(u.freigeben).toHaveBeenCalledTimes(1)
  })

  it('Höhe weicht um 1 px ab (Rundung des Browsers) → wird angenommen', async () => {
    const u = umgebung(2048, 1537, () => webp(100 * KB))
    const r = await bildFuerSpeicher(pngMit(8160, 6120), { umgebung: u.umgebung })
    expect(r.umgewandelt).toBe(true)
  })

  it('Breite stimmt, Höhe weicht um 2 px ab → Original (Drehung/Verzerrung)', async () => {
    const u = umgebung(2048, 1538, () => webp(100 * KB))
    const r = await bildFuerSpeicher(pngMit(8160, 6120), { umgebung: u.umgebung })
    expect(r.umgewandelt).toBe(false)
    expect(u.kodieren).not.toHaveBeenCalled()
  })

  it('Drehung vom Browser ignoriert: hochkant erwartet, quer dekodiert → Original', async () => {
    // Kopf: 4000×3000 mit Drehung 6 → gedreht 3000×4000 → Ziel 1536×2048.
    // Ein Browser, der die Drehung ignoriert, skaliert 4000×3000 auf Breite
    // 1536 und liefert 1536×1152.
    const jpeg = new Uint8Array(1000 * KB)
    jpeg.set(jpegKopf(4000, 3000, 6))
    const u = umgebung(1536, 1152, () => webp(100 * KB))
    const r = await bildFuerSpeicher(new Blob([jpeg], { type: 'image/jpeg' }), { umgebung: u.umgebung })
    expect(u.dekodieren).toHaveBeenCalledWith(expect.any(Blob), { breite: 1536, hoehe: 2048 })
    expect(r.umgewandelt).toBe(false)
  })

  it('PNG mit eXIf-Block → keine Vorab-Maße, voll dekodiert', async () => {
    const a = new Uint8Array(await pngMit(8160, 6120).arrayBuffer())
    // Nach IHDR (Ende bei Byte 33) ein eXIf-Block mit 4 Bytes Inhalt.
    a.set([0, 0, 0, 4, 0x65, 0x58, 0x49, 0x66, 0, 0, 0, 0, 0, 0, 0, 0], 33)
    expect(kopfMasse(a.slice(0, 64))).toBeNull()
    const u = umgebung(8160, 6120, () => webp(100 * KB))
    await bildFuerSpeicher(new Blob([a], { type: 'image/png' }), { umgebung: u.umgebung })
    expect(u.dekodieren).toHaveBeenCalledWith(expect.any(Blob), null)
  })

  it('kleines Bild mit bekannten Maßen: voll dekodieren, Maße müssen trotzdem stimmen', async () => {
    const u = umgebung(1600, 1200, () => webp(100 * KB))
    await bildFuerSpeicher(pngMit(1600, 1200), { umgebung: u.umgebung })
    expect(u.dekodieren).toHaveBeenCalledWith(expect.any(Blob), null)
  })

  it(`über ${HOECHSTPIXEL / 1e6} MP → gar nicht erst dekodiert`, async () => {
    const u = umgebung(1, 1, () => webp(1))
    const r = await bildFuerSpeicher(pngMit(16000, 8000), { umgebung: u.umgebung })
    expect(r.umgewandelt).toBe(false)
    expect(u.dekodieren).not.toHaveBeenCalled()
  })
})

describe('browserUmgebung — was an createImageBitmap geht', () => {
  const ursprung = globalThis.createImageBitmap
  afterEach(() => { globalThis.createImageBitmap = ursprung })

  it('fordert die EXIF-Drehung ausdrücklich an, ohne und mit Zielgröße', async () => {
    const aufrufe: unknown[] = []
    globalThis.createImageBitmap = vi.fn(async (_b: unknown, optionen?: unknown) => {
      aufrufe.push(optionen)
      return { width: 10, height: 10, close: () => {} }
    }) as unknown as typeof createImageBitmap
    await browserUmgebung().dekodieren(new Blob(['x']), null)
    await browserUmgebung().dekodieren(new Blob(['x']), { breite: 2048, hoehe: 1536 })
    // Nur die Breite — die Höhe muss der Browser aus dem gedrehten Bild
    // berechnen, sonst verrät sie keine falsch angewandte Drehung.
    expect(aufrufe).toEqual([
      { imageOrientation: 'from-image' },
      { imageOrientation: 'from-image', resizeWidth: 2048, resizeQuality: 'high' },
    ])
  })
})

describe('bildHochladen', () => {
  function zugang(fehler: string | null = null) {
    const hochgeladen: { bucket: string; pfad: string; typ: string; groesse: number; upsert: boolean }[] = []
    const z: HochladeZugang = {
      storage: {
        from: bucket => ({
          upload: async (pfad, daten, optionen) => {
            hochgeladen.push({ bucket, pfad, typ: optionen.contentType, groesse: daten.size, upsert: optionen.upsert })
            return { error: fehler ? { message: fehler } : null }
          },
          getPublicUrl: pfad => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${pfad}` } }),
        }),
      },
    }
    return { z, hochgeladen }
  }

  it('Pfad bekommt die Endung des ERGEBNISSES, Typ passt dazu', async () => {
    const { z, hochgeladen } = zugang()
    const u = umgebung(4096, 4096, () => webp(100 * KB))
    const datei = new File([await png(1000 * KB).arrayBuffer()], 'foto.PNG', { type: 'image/png' })
    const r = await bildHochladen(z, {
      bucket: 'character-images', pfadFuer: e => `u1/v1/abc.${e}`, datei, umgebung: u.umgebung,
    })
    expect(r).toMatchObject({ ok: true, pfad: 'u1/v1/abc.webp' })
    expect(hochgeladen).toEqual([{ bucket: 'character-images', pfad: 'u1/v1/abc.webp', typ: 'image/webp', groesse: 100 * KB, upsert: false }])
  })

  it('kleine Datei: Endung aus den Bytes, nicht aus dem Namen', async () => {
    const { z, hochgeladen } = zugang()
    const datei = new File([await png(100 * KB).arrayBuffer()], 'bild.jpg', { type: 'image/jpeg' })
    await bildHochladen(z, { bucket: 'prompt-covers', pfadFuer: e => `u1/x.${e}`, datei, upsert: true })
    expect(hochgeladen[0]).toMatchObject({ pfad: 'u1/x.png', typ: 'image/png', upsert: true })
  })

  it('Fehler beim Hochladen wird zurückgegeben, nicht geworfen', async () => {
    const { z } = zugang('Payload too large')
    const r = await bildHochladen(z, { bucket: 'b', pfadFuer: e => `u1/x.${e}`, datei: png(10 * KB) })
    expect(r).toMatchObject({ ok: false, fehler: 'Payload too large', pfad: 'u1/x.png' })
  })
})

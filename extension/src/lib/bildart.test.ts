import { describe, it, expect } from 'vitest'
import {
  typAusBytes, fuerAnalyseGeeignet, vorgehenFuer, base64Aus, ANALYSE_TYPEN,
} from './bildart'

/** Eine Signatur mit Füllung auf mindestens 12 Bytes. */
function sig(...bytes: number[]): Uint8Array {
  const a = new Uint8Array(16)
  a.set(bytes)
  return a
}

/** `....ftyp` plus Marke — der Rahmen, den AVIF und HEIC teilen. */
function ftyp(marke: string): Uint8Array {
  const a = new Uint8Array(16)
  a.set([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70])          // Länge + 'ftyp'
  a.set([...marke].map(z => z.charCodeAt(0)), 8)
  return a
}

describe('typAusBytes', () => {
  it('erkennt JPEG, PNG, GIF und BMP an der Signatur', () => {
    expect(typAusBytes(sig(0xff, 0xd8, 0xff))).toBe('image/jpeg')
    expect(typAusBytes(sig(0x89, 0x50, 0x4e, 0x47))).toBe('image/png')
    expect(typAusBytes(sig(0x47, 0x49, 0x46, 0x38))).toBe('image/gif')
    expect(typAusBytes(sig(0x42, 0x4d))).toBe('image/bmp')
  })

  it('erkennt WEBP nur mit RIFF UND der Marke dahinter', () => {
    const echt = sig(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50)
    expect(typAusBytes(echt)).toBe('image/webp')
    // RIFF allein ist auch eine WAV-Datei — die ist kein Bild.
    const nurRiff = sig(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45)
    expect(typAusBytes(nurRiff)).toBeNull()
  })

  it('unterscheidet AVIF und HEIC im gemeinsamen Rahmen', () => {
    expect(typAusBytes(ftyp('avif'))).toBe('image/avif')
    expect(typAusBytes(ftyp('avis'))).toBe('image/avif')
    expect(typAusBytes(ftyp('heic'))).toBe('image/heic')
    expect(typAusBytes(ftyp('mif1'))).toBe('image/heic')
  })

  it('nennt SVG und HTML kein Bild — beide kommen hier oft an', () => {
    const svg  = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">')
    const html = new TextEncoder().encode('<!DOCTYPE html><html><body>404')
    expect(typAusBytes(svg)).toBeNull()
    expect(typAusBytes(html)).toBeNull()
  })

  it('gibt bei zu wenig Bytes auf, statt zu raten', () => {
    expect(typAusBytes(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull()
  })
})

describe('fuerAnalyseGeeignet', () => {
  it('kennt genau die vier Typen, die die Dienste annehmen', () => {
    for (const t of ANALYSE_TYPEN) expect(fuerAnalyseGeeignet(t)).toBe(true)
    expect(ANALYSE_TYPEN).toHaveLength(4)
  })

  it('lehnt AVIF, HEIC und BMP ab — genau daran ist es gescheitert', () => {
    expect(fuerAnalyseGeeignet('image/avif')).toBe(false)
    expect(fuerAnalyseGeeignet('image/heic')).toBe(false)
    expect(fuerAnalyseGeeignet('image/bmp')).toBe(false)
    expect(fuerAnalyseGeeignet(null)).toBe(false)
  })
})

describe('vorgehenFuer', () => {
  /*
   * DER FALL VOM 04.09.2026. Vorher stand im Code
   *   const mediaType = blob.type || 'image/jpeg'
   * Ein AVIF-Bild ohne gemeldeten Typ ging damit als „image/jpeg" hinaus, und
   * Anthropic antwortete „Image format image/jpeg not supported" — was sich
   * liest, als koenne der Dienst kein JPEG.
   */
  it('schickt ein echtes JPEG unveraendert weiter', () => {
    expect(vorgehenFuer(sig(0xff, 0xd8, 0xff))).toEqual({ art: 'direkt', typ: 'image/jpeg' })
  })

  it('wandelt AVIF um, statt es als JPEG auszugeben', () => {
    expect(vorgehenFuer(ftyp('avif'))).toEqual({ art: 'umwandeln', von: 'image/avif' })
  })

  it('wandelt auch HEIC und BMP um', () => {
    expect(vorgehenFuer(ftyp('heic')).art).toBe('umwandeln')
    expect(vorgehenFuer(sig(0x42, 0x4d)).art).toBe('umwandeln')
  })

  it('nennt eine Fehlerseite beim Namen, statt sie durchzureichen', () => {
    const html = new TextEncoder().encode('<!DOCTYPE html><html><body>404 Not Found')
    expect(vorgehenFuer(html)).toEqual({ art: 'kein-bild' })
  })
})

describe('base64Aus', () => {
  it('kodiert richtig', () => {
    expect(base64Aus(new TextEncoder().encode('Hallo'))).toBe('SGFsbG8=')
  })

  it('kommt mit grossen Bildern zurecht', () => {
    // In Stuecken kodiert, weil `String.fromCharCode(...bytes)` bei einem
    // 8-MB-Bild am Argumentlimit scheitern wuerde.
    const gross = new Uint8Array(300_000).fill(65)
    const b64 = base64Aus(gross)
    expect(b64.length).toBeGreaterThan(390_000)
    expect(atob(b64).length).toBe(300_000)
  })
})

import { describe, it, expect } from 'vitest'
import {
  typAusBytes, istAnalyseTyp, ersteBytesAusBase64, analyseTypBestimmen, ANALYSE_TYPEN,
} from './bildtyp'

const b64Aus = (bytes: number[]) => {
  const a = new Uint8Array(16)
  a.set(bytes)
  return btoa(String.fromCharCode(...a))
}
const JPEG = b64Aus([0xff, 0xd8, 0xff, 0xe0])
const PNG  = b64Aus([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const AVIF = b64Aus([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66])
const HEIC = b64Aus([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])

describe('typAusBytes', () => {
  it('liest die gängigen Signaturen', () => {
    expect(typAusBytes(ersteBytesAusBase64(JPEG))).toBe('image/jpeg')
    expect(typAusBytes(ersteBytesAusBase64(PNG))).toBe('image/png')
    expect(typAusBytes(ersteBytesAusBase64(AVIF))).toBe('image/avif')
    expect(typAusBytes(ersteBytesAusBase64(HEIC))).toBe('image/heic')
  })
})

describe('ersteBytesAusBase64', () => {
  it('holt die ersten Bytes, ohne das ganze Bild zu entpacken', () => {
    // Ein Megabyte Base64 — es dürfen nur die ersten Bytes angefasst werden.
    const gross = JPEG.slice(0, 8) + 'A'.repeat(1_000_000)
    const bytes = ersteBytesAusBase64(gross)
    expect(bytes.length).toBeLessThanOrEqual(16)
    expect(bytes[0]).toBe(0xff)
  })

  it('kommt mit Zeilenumbrüchen im Base64 zurecht', () => {
    const umgebrochen = JPEG.slice(0, 4) + '\n' + JPEG.slice(4)
    expect(typAusBytes(ersteBytesAusBase64(umgebrochen))).toBe('image/jpeg')
  })

  it('gibt bei Unsinn leer zurück statt zu werfen', () => {
    expect(ersteBytesAusBase64('!!!nicht base64!!!').length).toBe(0)
  })
})

describe('analyseTypBestimmen', () => {
  it('nimmt den ECHTEN Typ, auch wenn etwas anderes gemeldet wird', () => {
    // Der Kern der Sache: Die Signatur gewinnt gegen das Etikett.
    const b = analyseTypBestimmen(PNG, 'image/jpeg')
    expect(b).toEqual({ ok: true, typ: 'image/png' })
  })

  /*
   * DER FALL VOM 04.09.2026.
   * Vorher stand in SIEBEN Routen:
   *   return (ALLOWED_MIME.has(base) ? base : 'image/jpeg')
   * Ein AVIF wurde damit in „image/jpeg" UMBENANNT und so an Anthropic
   * geschickt. Antwort: „Image format image/jpeg not supported" — eine Meldung,
   * die aussieht, als läge es an JPEG.
   */
  it('benennt AVIF NICHT in JPEG um, sondern lehnt ehrlich ab', () => {
    const b = analyseTypBestimmen(AVIF, 'image/jpeg')
    expect(b.ok).toBe(false)
    if (b.ok) throw new Error('unerwartet ok')
    expect(b.erkannt).toBe('image/avif')
    expect(b.grund).toContain('image/avif')
    expect(b.grund).toContain('JPEG, PNG, GIF und WEBP')
  })

  it('lehnt HEIC genauso ab', () => {
    const b = analyseTypBestimmen(HEIC)
    expect(b.ok).toBe(false)
    if (b.ok) throw new Error('unerwartet ok')
    expect(b.erkannt).toBe('image/heic')
  })

  it('nennt eine Fehlerseite beim Namen', () => {
    const html = btoa('<!DOCTYPE html><html><body>404 Not Found</body></html>')
    const b = analyseTypBestimmen(html, 'image/jpeg')
    expect(b.ok).toBe(false)
    if (b.ok) throw new Error('unerwartet ok')
    expect(b.erkannt).toBeNull()
    expect(b.grund).toContain('Fehlerseite')
  })

  it('glaubt dem gemeldeten Typ nur bei zu WENIG Bytes, und nur wenn er erlaubt ist', () => {
    // Zu kurz für eine Signatur — dann ist das Etikett die einzige Auskunft,
    // und es zählt nur, wenn es zu den vier erlaubten gehört.
    const kurz = btoa('abc')
    expect(analyseTypBestimmen(kurz, 'image/webp')).toEqual({ ok: true, typ: 'image/webp' })
    expect(analyseTypBestimmen(kurz, 'image/avif').ok).toBe(false)
    expect(analyseTypBestimmen(kurz, 'application/octet-stream').ok).toBe(false)
    expect(analyseTypBestimmen(kurz).ok).toBe(false)
  })

  it('nimmt den Typ auch mit angehängtem Zeichensatz an', () => {
    const kurz = btoa('abc')
    expect(analyseTypBestimmen(kurz, 'image/png; charset=binary'))
      .toEqual({ ok: true, typ: 'image/png' })
  })

  it('kennt genau vier erlaubte Typen', () => {
    expect(ANALYSE_TYPEN).toHaveLength(4)
    for (const t of ANALYSE_TYPEN) expect(istAnalyseTyp(t)).toBe(true)
    expect(istAnalyseTyp('image/avif')).toBe(false)
    expect(istAnalyseTyp(null)).toBe(false)
  })
})

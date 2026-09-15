import { describe, it, expect } from 'vitest'
import { dateinameFuerBild, dateinameMitEndung } from './bild-download'

/**
 * Seit 15.09.2026 kann ein Ergebnis unter `0.png` WebP enthalten — Mark hat
 * entschieden, große Bilder an derselben Adresse durch WebP zu ersetzen. Der
 * Name aus dem Pfad ist deshalb nur ein Vorschlag; die Endung setzt der
 * Download nach einem Blick auf die Bytes.
 */
describe('dateinameMitEndung', () => {
  it('ersetzt die Endung aus dem Pfad durch die echte', () => {
    expect(dateinameMitEndung('tresor-2026-09-15-1200-szene-1.png', 'webp'))
      .toBe('tresor-2026-09-15-1200-szene-1.webp')
  })
  it('lässt den Namen stehen, wenn nichts erkannt wurde', () => {
    expect(dateinameMitEndung('tresor-2026-09-15-1200.png', '')).toBe('tresor-2026-09-15-1200.png')
  })
  it('hängt an, wenn der Name keine Endung hat', () => {
    expect(dateinameMitEndung('tresor', 'jpg')).toBe('tresor.jpg')
  })
  it('zusammen mit dateinameFuerBild: Pfad .png, Bytes WebP → .webp', () => {
    const vorschlag = dateinameFuerBild('2026-09-15T12:00:00', 0, 1, 'Szene', 'u1/j1/0.png')
    expect(vorschlag.endsWith('.png')).toBe(true)
    expect(dateinameMitEndung(vorschlag, 'webp').endsWith('-szene.webp')).toBe(true)
  })
})

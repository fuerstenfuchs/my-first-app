import { describe, it, expect } from 'vitest'
import { zielMasse, lohntSich, istBewegt, kandidat } from './speicher-regeln'
import beispiele from './speicher-regeln-beispiele.json'

/**
 * Die Regeln gegen die gemeinsamen Beispiele.
 *
 * Dieselbe Datei prüft der Arbeiter (`worker/src/speicher.test.ts`) gegen
 * seine Anwendung der Regeln. Stimmen die Beispiele hier und dort, legt jeder
 * Weg ein Bild gleich ab — Browser, Erweiterung, Server und Arbeiter.
 */

const bytes = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], h => parseInt(h, 16))

describe('zielMasse', () => {
  it.each(beispiele.masse)('$name: $breite×$hoehe', ({ breite, hoehe, ziel }) => {
    expect(zielMasse(breite, hoehe)).toEqual(ziel)
  })
  it('ungültige Maße werfen, statt still ein 1×1-Bild zu bauen', () => {
    expect(() => zielMasse(0, 100)).toThrow()
    expect(() => zielMasse(Number.NaN, 100)).toThrow()
  })
})

describe('lohntSich', () => {
  it.each(beispiele.ersparnis)('$name', ({ alt, neu, lohnt }) => {
    expect(lohntSich(alt, neu)).toBe(lohnt)
  })
})

describe('kandidat', () => {
  it.each(beispiele.kandidaten)('$name', ({ typ, groesse, ja }) => {
    expect(kandidat(typ, groesse).ja).toBe(ja)
  })
})

describe('istBewegt', () => {
  it.each(beispiele.bewegt)('$name', ({ hex, bewegt }) => {
    expect(istBewegt(bytes(hex))).toBe(bewegt)
  })
})

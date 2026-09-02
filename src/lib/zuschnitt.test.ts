import { describe, it, expect } from 'vitest'
import {
  VERHAELTNISSE, GANZES_BILD, istGanzesBild, inPixel, zentriertesFenster,
} from './zuschnitt'

/**
 * Die Zusagen des Zuschnitts — festgenagelt, nicht kommentiert.
 *
 * WARUM ES DIESE DATEI GIBT: Zweimal in diesem Projekt hat die Kopfzeile der
 * Werkbank andere Maße behauptet, als die gespeicherte Datei bekam. Beim ersten
 * Mal, weil die Quellmaße kopiert wurden; beim zweiten Mal, weil dieselbe
 * Funktion an einer Stelle mit und an einer ohne `verhaeltnis` gerufen wurde.
 * Beide Male fiel es erst im Browser auf. Dieselbe Lehre wie bei `netz.ts`: Eine
 * Regel, die man einhalten MUSS, gehört nicht in einen Kommentar, sondern an
 * eine Stelle, die rot wird, wenn jemand sie bricht.
 */

/** Maße, die in diesem Projekt tatsächlich vorkommen. */
const BILDER: Array<[number, number]> = [
  [1122, 1402],  // Marks Porträt, an dem die Fehler auffielen
  [1536, 864],   // Filmformat 16:9
  [1024, 1024],  // quadratisch
  [4000, 800],   // extrem quer
  [800, 4000],   // extrem hoch
  [7, 3],        // winzig — hier tut Rundung am meisten weh
]

const MIT_WERT = VERHAELTNISSE.filter(v => v.wert !== null)

describe('zentriertesFenster', () => {
  it('bleibt in jedem Format und bei jedem Bild vollständig im Bild', () => {
    for (const [b, h] of BILDER) {
      for (const v of MIT_WERT) {
        const a = zentriertesFenster(b, h, v.wert as number)
        const wo = `${b}x${h} @ ${v.key}`
        expect(a.x, wo).toBeGreaterThanOrEqual(0)
        expect(a.y, wo).toBeGreaterThanOrEqual(0)
        expect(a.x + a.breite, wo).toBeLessThanOrEqual(1 + 1e-9)
        expect(a.y + a.hoehe, wo).toBeLessThanOrEqual(1 + 1e-9)
      }
    }
  })

  it('sitzt mittig', () => {
    const a = zentriertesFenster(1122, 1402, 16 / 9)
    expect(a.x).toBeCloseTo(0, 10)
    expect(a.y * 2 + a.hoehe).toBeCloseTo(1, 10)
  })

  it('liefert bei unsinnigen Maßen das ganze Bild statt NaN', () => {
    expect(zentriertesFenster(0, 100, 1)).toEqual(GANZES_BILD)
    expect(zentriertesFenster(100, 0, 1)).toEqual(GANZES_BILD)
    expect(zentriertesFenster(100, 100, 0)).toEqual(GANZES_BILD)
    expect(zentriertesFenster(100, 100, NaN)).toEqual(GANZES_BILD)
  })
})

describe('inPixel', () => {
  it('läuft nie über den Bildrand hinaus', () => {
    for (const [b, h] of BILDER) {
      for (const v of MIT_WERT) {
        const p = inPixel(zentriertesFenster(b, h, v.wert as number), b, h, v.wert as number)
        const wo = `${b}x${h} @ ${v.key}`
        expect(p.x, wo).toBeGreaterThanOrEqual(0)
        expect(p.y, wo).toBeGreaterThanOrEqual(0)
        expect(p.x + p.breite, wo).toBeLessThanOrEqual(b)
        expect(p.y + p.hoehe, wo).toBeLessThanOrEqual(h)
      }
    }
  })

  it('liefert nie ein Fenster von null Pixeln — sonst wirft der Canvas', () => {
    const winzig = { x: 0.5, y: 0.5, breite: 0.0001, hoehe: 0.0001 }
    for (const [b, h] of BILDER) {
      const p = inPixel(winzig, b, h)
      expect(p.breite, `${b}x${h}`).toBeGreaterThanOrEqual(1)
      expect(p.hoehe, `${b}x${h}`).toBeGreaterThanOrEqual(1)
    }
  })

  it('trifft das verlangte Verhältnis auf einen Pixel genau', () => {
    for (const [b, h] of BILDER) {
      for (const v of MIT_WERT) {
        const soll = v.wert as number
        const p = inPixel(zentriertesFenster(b, h, soll), b, h, soll)
        // Auf einen Bildpunkt genau — mehr geht bei ganzzahligen Maßen nicht.
        expect(Math.abs(p.hoehe - p.breite / soll), `${b}x${h} @ ${v.key}`)
          .toBeLessThanOrEqual(1)
      }
    }
  })

  /**
   * DER FEHLER VOM 02.09.2026, festgenagelt.
   *
   * Die Kopfzeile rief `inPixel` OHNE Verhältnis, Zuschnitt und gemeldete Maße
   * MIT. Bei 1122x1402 im Format „Original" nach automatischem Zuschnitt waren
   * das 1192 gegen 1197 Bildpunkte: Die Kopfzeile versprach eine Zahl, die
   * Datei bekam eine andere. Dieser Test hält fest, DASS die beiden Aufrufe
   * verschieden rechnen — deshalb darf es im Dialog nur noch eine Rechnung
   * geben, deren Ergebnis überall hingereicht wird.
   */
  it('rechnet mit und ohne Verhältnis nachweislich verschieden', () => {
    const a = { x: 0.072, y: 0.075, breite: 0.854167, hoehe: 0.85 }
    const ohne = inPixel(a, 1122, 1402)
    const mit  = inPixel(a, 1122, 1402, 1122 / 1402)
    expect(ohne.breite).toBe(mit.breite)
    expect(ohne.hoehe).not.toBe(mit.hoehe)
  })
})

describe('istGanzesBild', () => {
  it('erkennt das ganze Bild', () => {
    expect(istGanzesBild(GANZES_BILD)).toBe(true)
  })

  it('nimmt einen von Hand fast ganz aufgezogenen Rahmen als ganzes Bild', () => {
    // Toleranz: Ein Zug auf 99,9 % ist gemeint als „alles".
    expect(istGanzesBild({ x: 0, y: 0, breite: 0.999, hoehe: 0.999 })).toBe(true)
  })

  it('erkennt einen echten Zuschnitt als solchen', () => {
    expect(istGanzesBild(zentriertesFenster(1122, 1402, 16 / 9))).toBe(false)
    expect(istGanzesBild({ x: 0.1, y: 0, breite: 0.9, hoehe: 1 })).toBe(false)
  })
})

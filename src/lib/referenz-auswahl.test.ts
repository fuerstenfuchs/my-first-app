import { describe, it, expect } from 'vitest'
import { rangVon, nachNutzen, standardReferenz } from './referenz-auswahl'
import type { RefImage } from '@/lib/reference-images'

const b = (label: string, url = label.toLowerCase() + '.png'): RefImage => ({ url, label })

/** Die sieben Varianten, die PROJ-50 bei jedem Charakter anlegt. */
const CHARAKTER = [
  b('Kopf'), b('Körper'), b('Referenzsheet'), b('Ausdrücke'),
  b('Sonstige'), b('Outfit'), b('Calvanize'),
]

describe('rangVon', () => {
  it('setzt das Referenzsheet an die Spitze', () => {
    expect(rangVon('Referenzsheet')).toBe(0)
    expect(rangVon('Kombi')).toBe(1)
    expect(rangVon('Körper')).toBe(2)
    expect(rangVon('Kopf')).toBe(4)
  })

  it('vergleicht ohne Rücksicht auf Gross- und Kleinschreibung', () => {
    expect(rangVon('REFERENZSHEET')).toBe(0)
    expect(rangVon('referenzsheet')).toBe(0)
  })

  it('erkennt es auch als Teil eines längeren Namens', () => {
    // Marks Varianten heissen nicht immer exakt so — „Referenzsheet 16:9"
    // oder „Referenzsheet (neu)" muessen genauso gewinnen.
    expect(rangVon('Referenzsheet 16:9')).toBe(0)
    expect(rangVon('Outfit Kombi vorne')).toBe(1)
  })

  it('kommt mit „Koerper" ohne Umlaut zurecht', () => {
    expect(rangVon('Koerper Original')).toBe(2)
  })

  it('gibt allem Unbenannten denselben hinteren Rang', () => {
    expect(rangVon('Sonstige')).toBe(9)
    expect(rangVon('Calvanize')).toBe(9)
    expect(rangVon('')).toBe(9)
  })
})

describe('nachNutzen', () => {
  it('holt das Referenzsheet nach vorn', () => {
    expect(nachNutzen(CHARAKTER)[0]!.label).toBe('Referenzsheet')
  })

  it('behält innerhalb desselben Rangs die ursprüngliche Reihenfolge', () => {
    // „Sonstige", „Outfit" und „Calvanize" haben alle Rang 9 — ihre Ordnung
    // kommt aus der Datenbank (sort_order) und darf nicht zerwuerfelt werden.
    const hinten = nachNutzen(CHARAKTER).filter(x => rangVon(x.label) === 9)
    expect(hinten.map(x => x.label)).toEqual(['Ausdrücke', 'Sonstige', 'Outfit', 'Calvanize'])
  })

  it('sortiert die volle Reihenfolge wie erwartet', () => {
    expect(nachNutzen(CHARAKTER).map(x => x.label))
      .toEqual(['Referenzsheet', 'Körper', 'Kopf', 'Ausdrücke', 'Sonstige', 'Outfit', 'Calvanize'])
  })

  it('lässt die Liste in Ruhe, wenn nichts einzuordnen ist', () => {
    const nur = [b('Sonstige'), b('Ausdrücke')]
    expect(nachNutzen(nur).map(x => x.label)).toEqual(['Sonstige', 'Ausdrücke'])
  })

  it('verändert die übergebene Liste nicht', () => {
    const vorher = CHARAKTER.map(x => x.label)
    nachNutzen(CHARAKTER)
    expect(CHARAKTER.map(x => x.label)).toEqual(vorher)
  })

  it('kommt mit einer leeren Liste zurecht', () => {
    expect(nachNutzen([])).toEqual([])
  })
})

describe('standardReferenz', () => {
  it('wählt das Referenzsheet — genau das war Marks Bitte', () => {
    expect(standardReferenz(CHARAKTER)?.label).toBe('Referenzsheet')
  })

  it('wählt das Kombi-Blatt der Outfit-Kette', () => {
    const outfit = [b('Vorne'), b('Rückseite'), b('Details'), b('Kombi')]
    expect(standardReferenz(outfit)?.label).toBe('Kombi')
  })

  /*
   * DIE WICHTIGSTE ZEILE.
   * Ohne Auswahl nimmt der Scene Builder das TITELBILD des Bausteins
   * (`ref?.url ?? asset.cover_image_url`) — ein bewusst gewaehltes Bild.
   * Irgendein erstes Bild aus der Liste vorzuwaehlen waere schlechter als das,
   * und es ginge in eine BEZAHLTE Erzeugung.
   */
  it('wählt NICHTS, wenn es kein Referenzsheet gibt', () => {
    expect(standardReferenz([b('Kopf'), b('Sonstige')])).toBeNull()
    expect(standardReferenz([b('Sonstige')])).toBeNull()
    expect(standardReferenz([])).toBeNull()
  })

  it('wählt auch kein Körperbild — das ist nicht das ganze Blatt', () => {
    // Rang 2 ist gut genug zum Vorsortieren, aber nicht gut genug, um das
    // Titelbild zu verdraengen.
    expect(standardReferenz([b('Körper'), b('Kopf')])).toBeNull()
  })
})

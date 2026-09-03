import { describe, it, expect } from 'vitest'
import {
  STANDARD_VARIANTEN,
  fehlendeStandardVarianten,
  istStandardVariante,
} from './charakter-varianten'
import { VARIANTEN_NAME } from './referenzkette'

describe('STANDARD_VARIANTEN', () => {
  it('sind sieben, in Marks abgestimmter Reihenfolge', () => {
    expect(STANDARD_VARIANTEN).toEqual([
      'Kopf', 'Körper', 'Referenzsheet', 'Ausdrücke', 'Sonstige', 'Outfit', 'Calvanize',
    ])
  })

  // Der Gegenbeweis zur Begründung im Kopf der Datei: Würden die ersten drei
  // Namen hier neu getippt, fiele ein Umbenennen in `referenzkette.ts` nicht
  // auf — und die Kette legte eine zweite, gleichbedeutende Variante an.
  it('übernehmen die ersten drei Namen unverändert aus der Referenzkette', () => {
    expect(STANDARD_VARIANTEN.slice(0, 3)).toEqual([
      VARIANTEN_NAME.kopf, VARIANTEN_NAME.koerper, VARIANTEN_NAME.referenzsheet,
    ])
  })

  it('enthält keinen Namen doppelt', () => {
    const klein = STANDARD_VARIANTEN.map(n => n.toLowerCase())
    expect(new Set(klein).size).toBe(STANDARD_VARIANTEN.length)
  })
})

describe('fehlendeStandardVarianten', () => {
  it('nennt bei einem frischen Charakter alle sieben', () => {
    expect(fehlendeStandardVarianten([])).toEqual(STANDARD_VARIANTEN)
  })

  it('nennt nichts, wenn alle sieben da sind — auch bei anderer Schreibweise', () => {
    const vorhanden = ['kopf', 'KÖRPER', ' Referenzsheet ', 'ausdrücke', 'Sonstige', 'outfit', 'CALVANIZE']
    expect(fehlendeStandardVarianten(vorhanden)).toEqual([])
  })

  it('nennt genau den Rest, wenn eine Teilmenge da ist', () => {
    expect(fehlendeStandardVarianten(['Kopf', 'Outfit'])).toEqual([
      'Körper', 'Referenzsheet', 'Ausdrücke', 'Sonstige', 'Calvanize',
    ])
  })

  it('liefert die feste Reihenfolge, nicht die der Eingabe', () => {
    expect(fehlendeStandardVarianten(['Sonstige'])).toEqual([
      'Kopf', 'Körper', 'Referenzsheet', 'Ausdrücke', 'Outfit', 'Calvanize',
    ])
  })

  it('lässt sich von fremden Varianten nicht beirren', () => {
    // „Körperfoto" ist eine EIGENE Variante der Referenzkette und darf nicht
    // als „Körper" durchgehen — sonst bliebe das Körper-Fach ungebaut.
    const fehlt = fehlendeStandardVarianten(['Körperfoto', 'Gesichtsdetails'])
    expect(fehlt).toEqual(STANDARD_VARIANTEN)
  })
})

describe('istStandardVariante', () => {
  it('erkennt die Namen unabhängig von Schreibweise und Leerzeichen', () => {
    expect(istStandardVariante(' ausdrücke ')).toBe(true)
    expect(istStandardVariante('Kopf')).toBe(true)
  })

  it('sagt bei allem anderen nein', () => {
    expect(istStandardVariante('Gesichtsausdruck')).toBe(false)
    expect(istStandardVariante('Körperfoto')).toBe(false)
    expect(istStandardVariante('')).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import {
  findeVariante,
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
    // „Körper Original" ist Marks eigenes Ausgangsbild und darf NICHT als
    // „Körper" durchgehen — sonst bliebe das Körper-Fach ungebaut und die
    // Kette hielte ihren Körper-Schritt für erledigt.
    const fehlt = fehlendeStandardVarianten(['Körper Original', 'Kopf Original', 'Gesichtsdetails'])
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
    expect(istStandardVariante('Körper Original')).toBe(false)
    expect(istStandardVariante('Kopf Original')).toBe(false)
    expect(istStandardVariante('')).toBe(false)
  })
})

describe('findeVariante', () => {
  const faecher = [
    { id: 'a', name: 'Kopf' },
    { id: 'b', name: ' Körper ' },
    { id: 'c', name: 'Referenzsheet' },
  ]

  it('findet das Fach zum Namen', () => {
    expect(findeVariante(faecher, 'Kopf')?.id).toBe('a')
  })

  it('kuemmert sich nicht um Leerzeichen und Grossschreibung', () => {
    /*
      DENSELBEN VERGLEICH BENUTZT DIE KETTE (`varianteHolen`). Ein genauerer
      wuerde neben „ Körper " ein zweites Fach „Körper" anlegen — und danach
      liegen die Blaetter desselben Charakters in zwei Faechern, ohne dass
      irgendetwas meldet.
    */
    expect(findeVariante(faecher, 'körper')?.id).toBe('b')
    expect(findeVariante(faecher, '  KÖRPER')?.id).toBe('b')
  })

  it('gibt undefined, wenn es das Fach nicht gibt', () => {
    expect(findeVariante(faecher, 'Gesichtsdetails')).toBeUndefined()
  })

  it('kommt mit fehlenden Namen zurecht', () => {
    // Aus der Datenbank kam `name` schon als null zurueck.
    expect(findeVariante([{ id: 'x', name: null }], 'Kopf')).toBeUndefined()
    expect(findeVariante([], 'Kopf')).toBeUndefined()
  })
})

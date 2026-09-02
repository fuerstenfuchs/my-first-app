import { describe, it, expect } from 'vitest'
import { ANALYSE_PROMPT, ANALYSE_ANGABEN, jsonAusAntwort, type AnalyseArt } from './analyse-prompts'

/**
 * Die Analyse-Prompts und das Herausschälen der Antwort.
 *
 * WARUM GETESTET: `jsonAusAntwort` ersetzt sechs handgeschriebene Kopien
 * derselben zwei Zeilen, die vorher in jeder Analyse-Route einzeln standen.
 * Sechs Kopien fielen nicht auf, solange sie gleich waren — eine gemeinsame
 * Funktion fällt auf, sobald sie bricht. Und ein Prompt, der versehentlich
 * leer wird, ändert die Analyse still: Das Modell bekäme dann gar keine
 * Anweisung und antwortete irgendetwas.
 */

const ARTEN: AnalyseArt[] = [
  'character', 'fashion', 'location', 'outfit', 'pose',
  'kamera', 'licht', 'bild', 'bildPlatzhalter',
]

describe('ANALYSE_PROMPT', () => {
  it('hat für jede Art einen Prompt, und keiner ist leer', () => {
    for (const art of ARTEN) {
      expect(ANALYSE_PROMPT[art], art).toBeTypeOf('string')
      // Die kürzeste Vorlage hat rund 1000 Zeichen. Alles darunter wäre ein
      // Unfall beim Herausziehen, kein bewusst kurzer Prompt.
      expect(ANALYSE_PROMPT[art].length, art).toBeGreaterThan(500)
    }
  })

  it('trägt keine offene Einsetzung — die wäre beim Umzug entstanden', () => {
    for (const art of ARTEN) {
      expect(ANALYSE_PROMPT[art], art).not.toContain('${')
    }
  })

  it('die Fassung mit Platzhalter verlangt [Person], die normale nicht', () => {
    expect(ANALYSE_PROMPT.bildPlatzhalter).toContain('[Person]')
    expect(ANALYSE_PROMPT.bild).not.toContain('[Person]')
  })

  it('zu jeder Art gibt es Angaben', () => {
    for (const art of ARTEN) {
      const a = ANALYSE_ANGABEN[art]
      expect(a, art).toBeDefined()
      expect(a.nutzerText.length, art).toBeGreaterThan(0)
      expect(a.maxWorte, art).toBeGreaterThan(0)
      expect(['json', 'text'], art).toContain(a.ausgabe)
    }
  })
})

describe('jsonAusAntwort', () => {
  it('nimmt blankes JSON', () => {
    expect(jsonAusAntwort('{"name":"Test"}')).toEqual({ name: 'Test' })
  })

  it('nimmt JSON in einem Zaun mit Sprachangabe', () => {
    expect(jsonAusAntwort('```json\n{"name":"Test"}\n```')).toEqual({ name: 'Test' })
  })

  it('nimmt JSON in einem Zaun ohne Sprachangabe', () => {
    expect(jsonAusAntwort('```\n{"name":"Test"}\n```')).toEqual({ name: 'Test' })
  })

  it('überliest einen einleitenden Satz — den setzen Modelle gern davor', () => {
    expect(jsonAusAntwort('Here is the JSON:\n{"name":"Test"}')).toEqual({ name: 'Test' })
  })

  it('überliest auch einen Nachsatz', () => {
    expect(jsonAusAntwort('{"name":"Test"}\n\nHope this helps!')).toEqual({ name: 'Test' })
  })

  it('kommt mit verschachtelten Objekten und Feldern zurecht', () => {
    const roh = '```json\n{"name":"A","tags":["x","y"],"tief":{"a":1}}\n```'
    expect(jsonAusAntwort(roh)).toEqual({ name: 'A', tags: ['x', 'y'], tief: { a: 1 } })
  })

  it('wirft bei Text ohne JSON — besser als still ein leeres Objekt', () => {
    expect(() => jsonAusAntwort('I cannot analyze this image.')).toThrow()
  })
})

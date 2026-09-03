import { describe, it, expect } from 'vitest'
import {
  passtZurSuche, kategorien, kategorieLabel, auswahlSpalten, baustein,
  type SuchbarerEintrag,
} from './bausteine'

/**
 * Prüfsteine aus Marks echten Daten (Stand 03.09.2026).
 *
 * Erfundene Beispiele hätten hier nichts bewiesen: Der Fehler war, dass die
 * Suche als zusammenhängende Zeichenkette im Namen suchte — und Marks Namen
 * sind beschreibende Sätze. Genau diese Namen stehen deshalb hier.
 */
const POSE: SuchbarerEintrag = {
  name: 'Arme verschränkt, Blick nach unten, sitzend',
  category: 'sitzen',
  description: null,
  tags: [],
}

const STADION: SuchbarerEintrag = {
  name: 'BORUSSIA-PARK – Mönchengladbach',
  category: 'stadien_deutschland',
  description: 'Heimstadion von Borussia Mönchengladbach, 54.000 Plätze.',
  tags: ['bundesliga'],
}

const STRAND: SuchbarerEintrag = {
  name: 'Küstenabschnitt Nord',
  category: 'natur',
  description: 'Feiner heller Sand, Dünen im Hintergrund, früher Morgen.',
  tags: ['aussen', 'wasser'],
}

describe('passtZurSuche', () => {
  it('findet über Wörter in beliebiger Reihenfolge — der eigentliche Auslöser', () => {
    // Das ist der Prüfstein: „sitzend arme" stand vorher nirgends als
    // zusammenhängende Zeichenkette, die alte Suche fand nichts.
    expect(passtZurSuche(POSE, 'sitzend arme')).toBe(true)
  })

  it('findet den BORUSSIA-PARK über „gladbach"', () => {
    // Teiltreffer INNERHALB eines Wortes muss bleiben — „gladbach" steckt
    // mitten in „Mönchengladbach".
    expect(passtZurSuche(STADION, 'gladbach')).toBe(true)
  })

  it('findet ein Wort, das nur in der Beschreibung steht', () => {
    expect(STRAND.name.toLowerCase()).not.toContain('dünen')
    expect(passtZurSuche(STRAND, 'dünen')).toBe(true)
  })

  it('findet nichts, wenn eines von zwei Wörtern fehlt', () => {
    // ALLE Wörter müssen vorkommen. „stehend" gibt es bei dieser Pose nicht.
    expect(passtZurSuche(POSE, 'arme stehend')).toBe(false)
  })

  it('gibt bei leerer Suche alles zurück', () => {
    expect(passtZurSuche(POSE, '')).toBe(true)
    expect(passtZurSuche(POSE, '   ')).toBe(true)
  })

  it('ignoriert Groß- und Kleinschreibung', () => {
    expect(passtZurSuche(STADION, 'BORUSSIA park')).toBe(true)
  })

  it('sucht auch über Kategorie und Schlagworte', () => {
    expect(passtZurSuche(STADION, 'bundesliga')).toBe(true)
    expect(passtZurSuche(STADION, 'stadien')).toBe(true)
  })

  it('findet Umlaute auch in der Ersatzschreibung', () => {
    expect(passtZurSuche(STADION, 'moenchengladbach')).toBe(true)
    expect(passtZurSuche(STRAND, 'duenen')).toBe(true)
  })

  it('kommt mit fehlenden Zusatzfeldern zurecht', () => {
    // Charaktere haben keine Kategorie, Archetypen keine `description`.
    const nur: SuchbarerEintrag = { name: 'Elena' }
    expect(passtZurSuche(nur, 'elena')).toBe(true)
    expect(passtZurSuche(nur, 'natur')).toBe(false)
  })
})

describe('kategorien', () => {
  const liste: SuchbarerEintrag[] = [
    ...Array.from({ length: 3 }, () => STADION),
    STRAND,
    { name: 'Waldlichtung', category: 'natur' },
    { name: 'Ohne Kategorie', category: null },
  ]

  it('zählt und stellt die häufigste nach vorn', () => {
    expect(kategorien(liste)).toEqual([
      { wert: 'stadien_deutschland', anzahl: 3 },
      { wert: 'natur', anzahl: 2 },
    ])
  })

  it('lässt leere Kategorien weg', () => {
    expect(kategorien(liste).map(k => k.wert)).not.toContain('')
  })

  it('sortiert Gleichstand alphabetisch, damit die Knöpfe nicht wandern', () => {
    const gleich: SuchbarerEintrag[] = [
      { name: 'a', category: 'zebra' },
      { name: 'b', category: 'apfel' },
    ]
    expect(kategorien(gleich).map(k => k.wert)).toEqual(['apfel', 'zebra'])
  })
})

describe('kategorieLabel', () => {
  it('macht den technischen Wert lesbar, ohne ihn zu ändern', () => {
    expect(kategorieLabel('stadien_deutschland')).toBe('Stadien Deutschland')
    expect(kategorieLabel('natur')).toBe('Natur')
  })

  it('kennt die eine Kategorie, deren Schlüssel einen Umlaut ersetzt', () => {
    expect(kategorieLabel('gebaeude')).toBe('Gebäude')
  })
})

describe('auswahlSpalten', () => {
  it('holt bei Posen Beschreibung, Kategorie und Schlagworte', () => {
    expect(auswahlSpalten(baustein('posen')))
      .toBe('id, name, cover_image_url, description, category, tags')
  })

  it('holt bei Charakteren KEINE Kategorie — die Spalte gibt es dort nicht', () => {
    expect(auswahlSpalten(baustein('charaktere'))).not.toContain('category')
  })

  it('benennt bei Prompts den Titel und bei Archetypen die Kurzbeschreibung um', () => {
    expect(auswahlSpalten(baustein('prompts'))).toContain('name:title')
    expect(auswahlSpalten(baustein('charakter-archetypen')))
      .toContain('description:short_description')
    // Und dort NICHT die Spalte, die es nicht gibt.
    expect(auswahlSpalten(baustein('charakter-archetypen')))
      .not.toMatch(/(^|, )description(,|$)/)
  })
})

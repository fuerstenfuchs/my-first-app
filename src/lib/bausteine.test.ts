import { describe, it, expect } from 'vitest'
import {
  passtZurSuche, kategorien, kategorieLabel, chipListe, auswahlSpalten, baustein,
  pruefeBildgroesse,
  type SuchbarerEintrag,
} from './bausteine'
import { OUTFIT_KATEGORIE_LABELS } from './outfit-kategorien'

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
    // Charaktere haben zum Beispiel keine Kategorie.
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

  it('benennt bei Prompts den Titel um', () => {
    expect(auswahlSpalten(baustein('prompts'))).toContain('name:title')
    // Und NICHT die Spalte, die es dort nicht gibt.
    expect(auswahlSpalten(baustein('prompts'))).not.toMatch(/(^|, )title(,|$)/)
  })

  /**
   * Der Alias-Weg für den FLIESSTEXT hat seit PROJ-52 keinen echten Nutzer mehr
   * — die Archetypen mit ihrer `short_description` waren er. Er bleibt trotzdem
   * geprüft: Sonst fiele beim nächsten Baustein mit abweichendem Spaltennamen
   * erst in Supabase auf, dass eine falsche Spalte die GANZE Abfrage scheitern
   * lässt.
   */
  it('biegt einen abweichenden Beschreibungs-Spaltennamen per Alias gerade', () => {
    const erfunden = { ...baustein('charaktere'), suchFelder: { beschreibung: 'kurztext' } }
    expect(auswahlSpalten(erfunden)).toContain('description:kurztext')
    expect(auswahlSpalten(erfunden)).not.toMatch(/(^|, )description(,|$)/)
  })
})

describe('pruefeBildgroesse', () => {
  const MB = 1024 * 1024

  it('lässt Marks tatsächlichen Fall vom 03.09.2026 durch — 28,1 MB, seit der Anhebung erlaubt', () => {
    // 6784×3712, SeedVR2 4×, gemessen: 29 484 500 Bytes.
    expect(pruefeBildgroesse(29_484_500, baustein('charaktere'))).toBeNull()
  })

  it('hätte denselben Fall VOR der Anhebung abgelehnt — hält die alte Grenze als Beleg fest', () => {
    const alteGrenze = 20 // MB, bis 03.09.2026 in Supabase
    const mb = 29_484_500 / MB
    expect(mb).toBeGreaterThan(alteGrenze)
  })

  it('lässt ein normal großes Bild klar durch', () => {
    expect(pruefeBildgroesse(3 * MB, baustein('locations'))).toBeNull()
  })

  it('lehnt ab, wenn es über der Grenze liegt, und nennt beide Zahlen', () => {
    const meldung = pruefeBildgroesse(51 * MB, baustein('outfits'))
    expect(meldung).toContain('51.0 MB')
    expect(meldung).toContain('50 MB')
    expect(meldung).toContain('Outfits')
  })

  it('lässt genau die Grenze noch durch — erst DARÜBER wird abgelehnt', () => {
    expect(pruefeBildgroesse(50 * MB, baustein('posen'))).toBeNull()
    expect(pruefeBildgroesse(50 * MB + 1, baustein('posen'))).not.toBeNull()
  })

  it('prüft Prompts nicht — der Eimer hat kein Limit in der Tabelle', () => {
    expect(pruefeBildgroesse(90 * MB, baustein('prompts'))).toBeNull()
  })
})

/**
 * PROJ-46, zweiter Schritt: dieselbe Suche und dieselben Chips auch im Scene
 * Builder und auf den Baustein-Seiten.
 */
describe('chipListe', () => {
  const alle: SuchbarerEintrag[] = [
    { name: 'Borussia-Park', category: 'stadien_deutschland' },
    { name: 'Signal Iduna Park', category: 'stadien_deutschland' },
    { name: 'Allianz Arena', category: 'stadien_deutschland' },
    { name: 'Wald im Nebel', category: 'natur' },
    { name: 'Bergsee', category: 'natur' },
  ]

  it('nimmt die AUSWAHL aus allen und die ZAHL aus den gesuchten', () => {
    const gesucht = alle.filter(e => passtZurSuche(e, 'park'))
    expect(chipListe(alle, gesucht)).toEqual([
      { wert: 'stadien_deutschland', anzahl: 2 },
      { wert: 'natur', anzahl: 0 },
    ])
  })

  /**
   * Der Kern der Sache. Käme die Auswahl aus den gesuchten Einträgen, wäre
   * „natur" beim Tippen von „park" verschwunden — und wer die Kategorie vorher
   * angeklickt hatte, könnte sie nicht mehr abwählen: Die Liste bliebe leer,
   * ohne dass irgendetwas sagt warum.
   */
  it('behält einen Chip mit null Treffern, sonst ließe er sich nicht abwählen', () => {
    const gesucht = alle.filter(e => passtZurSuche(e, 'park'))
    expect(chipListe(alle, gesucht).map(k => k.wert)).toContain('natur')
  })

  it('zeigt gar keine Chips, wenn es nur eine Kategorie gibt', () => {
    // Genau der Fall der Mimik im Scene Builder: alles liegt in „alle".
    const eine: SuchbarerEintrag[] = [
      { name: 'Lächeln', category: 'alle' },
      { name: 'Ernst', category: 'alle' },
    ]
    expect(chipListe(eine, eine)).toEqual([])
  })

  it('zeigt gar keine Chips, wo es keine Kategorie gibt', () => {
    const ohne: SuchbarerEintrag[] = [{ name: 'Anna' }, { name: 'Ben' }]
    expect(chipListe(ohne, ohne)).toEqual([])
  })

  it('behält die Reihenfolge aus `kategorien` — häufigste zuerst', () => {
    expect(chipListe(alle, []).map(k => k.wert))
      .toEqual(['stadien_deutschland', 'natur'])
  })
})

describe('kategorieLabel mit gepflegter Liste', () => {
  /**
   * Der Prüfbefund vom 03.09.2026: Dieselbe Outfit-Kategorie stand in der App
   * in drei Schreibweisen — roh, „Komplett" und „Komplett-Look". Die Ableitung
   * aus dem Schlüssel kann das nicht wissen; die Liste des Bereichs schon.
   */
  it('nimmt die Beschriftung des Bereichs, wo es eine gibt', () => {
    expect(kategorieLabel('komplett', OUTFIT_KATEGORIE_LABELS)).toBe('Komplett-Look')
  })

  it('fällt ohne Liste auf die Ableitung zurück', () => {
    expect(kategorieLabel('komplett')).toBe('Komplett')
  })

  it('lässt einen Wert, der in der Liste fehlt, ableiten', () => {
    // Marks eigene Kategorien (PROJ-34) stehen in keiner festen Liste.
    expect(kategorieLabel('stadien_deutschland', OUTFIT_KATEGORIE_LABELS))
      .toBe('Stadien Deutschland')
  })

  it('gibt dem Outfit-Baustein die Liste mit — sonst wirkt sie nirgends', () => {
    expect(baustein('outfits').kategorieLabels?.komplett).toBe('Komplett-Look')
    expect(baustein('locations').kategorieLabels).toBeUndefined()
  })
})

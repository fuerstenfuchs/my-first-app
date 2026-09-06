import { describe, it, expect } from 'vitest'
import {
  gruppenReferenzen, gruppenZuordnung, gruppenPrompt, warnung, AUFBAUTEN,
  type Beteiligt,
} from './gruppen-referenz'
import { promptFuerAuftrag } from './image-generation'
import type { Character } from '@/hooks/use-characters'
import type { Outfit } from '@/hooks/use-outfits'

/**
 * Die ganze Idee dieses Blattes ist die ZUORDNUNG. Geht sie verloren, ist es
 * ein hübsches Bild ohne Nutzen — und der Fehler fällt erst auf, wenn im
 * fertigen Bild die Jacke bei der falschen Person hängt.
 */
const p = (id: string, bild: string | null = `https://x/${id}.jpg`) =>
  ({ id, name: `Person ${id}`, cover_image_url: bild }) as unknown as Character
const o = (id: string, bild: string | null = `https://x/o${id}.jpg`) =>
  ({ id, name: `Outfit ${id}`, cover_image_url: bild }) as unknown as Outfit

const ZWEI: Beteiligt[] = [
  { charakter: p('a'), outfit: o('1') },
  { charakter: p('b'), outfit: o('2') },
]
/* Ab drei gilt ein anderer Aufbau — siehe `zweiSpalten` gegen `zweiReihen`. */
const DREI: Beteiligt[] = [...ZWEI, { charakter: p('c'), outfit: o('3') }]

describe('gruppenReferenzen', () => {
  it('setzt Person und Kleidung direkt hintereinander', () => {
    // Stuenden erst alle Personen und dann alle Outfits, muesste das Modell
    // ueber vier Bilder hinweg zaehlen. Nebeneinander haelt die Verbindung.
    expect(gruppenReferenzen(ZWEI).map(r => r.rolle))
      .toEqual(['character', 'outfit', 'character', 'outfit'])
  })

  it('laesst Personen ohne Outfit einfach weg statt zu verrutschen', () => {
    const r = gruppenReferenzen([{ charakter: p('a'), outfit: null }, ZWEI[1]])
    expect(r.map(x => x.rolle)).toEqual(['character', 'character', 'outfit'])
  })

  it('ueberspringt einen Charakter ohne Bild', () => {
    const r = gruppenReferenzen([{ charakter: p('a', null), outfit: o('1') }])
    expect(r.map(x => x.rolle)).toEqual(['outfit'])
  })
})

describe('gruppenZuordnung', () => {
  it('gibt genau so viele Zeilen wie Bilder — sonst verschiebt sich alles', () => {
    for (const leute of [ZWEI, [ZWEI[0]], [...ZWEI, { charakter: p('c'), outfit: null }]]) {
      expect(gruppenZuordnung(leute)).toHaveLength(gruppenReferenzen(leute).length)
    }
  })

  it('bindet jedes Kleidungsstueck an SEINE Person', () => {
    const z = gruppenZuordnung(ZWEI)
    expect(z[1]).toContain('CLOTHES OF PERSON 1')
    expect(z[1]).toContain('put them on PERSON 1')
    expect(z[3]).toContain('CLOTHES OF PERSON 2')
    expect(z[3]).toContain('put them on PERSON 2')
  })

  it('verankert jede Person an einem Platz in der Reihe', () => {
    // Der Positionsanker traegt bei Bildmodellen mehr als jede Beschreibung.
    const z = gruppenZuordnung([...ZWEI, { charakter: p('c'), outfit: null }])
    expect(z[0]).toContain('leftmost')
    expect(z[4]).toContain('rightmost')
  })

  it('nennt keine Namen', () => {
    // Ein Name zieht Annahmen ueber Geschlecht, Alter und Herkunft nach sich,
    // die dem Referenzfoto widersprechen koennen.
    const z = gruppenZuordnung(ZWEI).join(' ')
    expect(z).not.toContain('Person a')
    expect(z).not.toContain('Outfit 1')
  })
})

describe('gruppenPrompt', () => {
  it('nennt die Anzahl mehrfach — gegen zusaetzliche halbe Personen am Rand', () => {
    const t = gruppenPrompt(ZWEI)
    expect(t).toContain('exactly two people')
    expect(t).toContain('no one else anywhere on the sheet')
    // Mindestens dreimal — einmal reicht bei Bildmodellen erfahrungsgemaess nicht.
    expect(t.split('two').length - 1).toBeGreaterThanOrEqual(3)
  })

  it('nimmt bei ZWEI Personen zwei Spalten statt zwei Reihen', () => {
    /*
      Marks Einwand am zweiten Blatt: „Da kann man wirklich den Kopf groesser
      machen. Da ist viel zu viel Platz verschenkt."

      Nachgerechnet: Ein Kopf wird so gross wie das Kleinere von Reihenhoehe
      und Blattbreite/Personenzahl. Bei zwei Personen sind das 410 gegen 768
      Pixel — die Hoehe begrenzt, die halbe Breite liegt brach. Zwei Spalten
      drehen das um.
    */
    const t = gruppenPrompt(ZWEI)
    expect(t).toContain('TWO EQUAL HALVES')
    expect(t).toContain('LEFT HALF = PERSON 1')
    expect(t).toContain('RIGHT HALF = PERSON 2')
    expect(t).toMatch(/close to the top[^]*bottom edges of the sheet/)
    // Und ausdruecklich NICHT der Reihenaufbau.
    expect(t).not.toContain('TOP ROW')
  })

  it('bleibt ab DREI Personen bei zwei Reihen', () => {
    // Dort fuellt die Reihe die Breite von selbst; eine Spalte je Person
    // waere zu schmal.
    const t = gruppenPrompt(DREI)
    expect(t).toMatch(/TOP ROW[^]*full body/)
    expect(t).toMatch(/BOTTOM ROW[^]*head-and-shoulders close-ups/)
    expect(t).toContain('The face below position 1 is PERSON 1')
    expect(t).toMatch(/Same person, same order, in both rows/)
    expect(t).not.toContain('TWO EQUAL HALVES')
  })

  it('verlangt in BEIDEN Aufbauten, das Blatt auszunutzen', () => {
    for (const t of [gruppenPrompt(ZWEI), gruppenPrompt(DREI)]) {
      expect(t).toContain('FILL THE SHEET')
      expect(t).toMatch(/Do not leave wide empty margins/)
    }
  })

  it('haelt die Personen bei drei und mehr auseinander', () => {
    // Im Shooting sollen sich Silhouetten ueberlappen. Hier ist das Gegenteil
    // richtig: Das Modell muss spaeter jede Person einzeln herauslesen.
    const t = gruppenPrompt(DREI)
    expect(t).toMatch(/do NOT touch/)
    expect(t).toMatch(/silhouettes do NOT overlap/)
  })

  it('haelt die beiden bei zwei Personen durch die Blatthaelften auseinander', () => {
    const t = gruppenPrompt(ZWEI)
    expect(t).toMatch(/Nothing crosses the middle/)
    expect(t).toMatch(/neither person appears in the other half/)
  })

  it('haelt Groessenverhaeltnisse fest', () => {
    expect(gruppenPrompt(ZWEI)).toMatch(/true relative heights/)
    expect(gruppenPrompt(ZWEI)).toMatch(/do not make them all the same/)
  })

  it('verbietet den Kleidungstausch ausdruecklich', () => {
    expect(gruppenPrompt(ZWEI)).toMatch(/Do not swap, mix or blend clothing/)
  })

  it('gibt den Haenden eine Aufgabe', () => {
    // Freie Haende sind bei Bildmodellen die zuverlaessigste Fehlerquelle.
    expect(gruppenPrompt(ZWEI)).toMatch(/hands fully visible, fingers relaxed and clearly/)
  })

  it('bleibt ein Werkzeug: neutraler Grund, kein Ort, keine Schrift', () => {
    const t = gruppenPrompt(ZWEI)
    expect(t).toMatch(/light grey studio background/)
    expect(t).toMatch(/No set, no props, no location/)
    expect(t).toMatch(/No names, no labels, no numbers/)
  })
})

describe('zusammen mit promptFuerAuftrag', () => {
  it('ersetzt die allgemeinen Rollenzeilen durch die benannten', () => {
    const refs = gruppenReferenzen(ZWEI)
    const fertig = promptFuerAuftrag(
      gruppenPrompt(ZWEI), null, refs.map(r => r.rolle), gruppenZuordnung(ZWEI),
    )
    // Genau das ist der Kern: KEIN nacktes „Image 2 = OUTFIT" mehr.
    expect(fertig).not.toMatch(/Image 2 = OUTFIT —/)
    expect(fertig).toContain('Image 2 = THE CLOTHES OF PERSON 1')
    expect(fertig).toContain('Image 4 = THE CLOTHES OF PERSON 2')
  })

  it('faellt ohne eigene Zeilen auf das alte Verhalten zurueck', () => {
    const fertig = promptFuerAuftrag('Text', null, ['character', 'outfit'])
    expect(fertig).toContain('Image 1 = CHARACTER')
    expect(fertig).toContain('Image 2 = OUTFIT')
  })
})

describe('warnung', () => {
  it('schweigt bis drei', () => {
    expect(warnung(2)).toBeNull()
    expect(warnung(3)).toBeNull()
  })
  it('warnt ab vier und deutlicher bei fuenf', () => {
    expect(warnung(4)).toContain('Aufstellung')
    expect(warnung(5)).toContain('Grenze')
  })
})

describe('Aufbau „Köpfe oben, Körper darunter"', () => {
  it('aendert den bisherigen Aufbau NICHT', () => {
    // Mark: „Wir halten das mal so bei, dass wir es immer wieder abrufen
    // koennen, also nicht verwerfen oder loeschen."
    expect(gruppenPrompt(ZWEI)).toContain('TWO EQUAL HALVES')
    expect(gruppenPrompt(ZWEI, 'automatisch')).toContain('TWO EQUAL HALVES')
    expect(gruppenPrompt(DREI, 'automatisch')).toMatch(/TOP ROW[^]*full body/)
  })

  it('setzt die Koepfe nach oben und die Koerper darunter', () => {
    const t = gruppenPrompt(DREI, 'kopf_und_koerper')
    expect(t).toMatch(/TOP ROW[^]*head-and-shoulders close-ups/)
    expect(t).toMatch(/BOTTOM ROW[^]*from the shoulders down to the/)
    expect(t).toContain('THE FACE APPEARS ONLY ONCE ON THIS SHEET')
  })

  it('verlangt einen ANSCHNITT, keine kopflose Person', () => {
    /*
      Die wichtigste Zeile des ganzen Aufbaus. „Eine Person ohne Kopf" ist fuer
      ein Bildmodell eine anatomische Aussage; die Ergebnisse reichen von „malt
      den Kopf trotzdem" bis zu etwas, das niemand sehen will. Gemeint ist ein
      Bildausschnitt — und das muss dastehen.
    */
    const t = gruppenPrompt(DREI, 'kopf_und_koerper')
    expect(t).toContain('CROPPED, NOT HEADLESS')
    expect(t).toMatch(/Do not draw a person without a head/)
    expect(t).toMatch(/crop the picture, nothing else/)
  })

  it('bindet Koerper und Gesicht ueber die Reihenfolge', () => {
    expect(gruppenPrompt(DREI, 'kopf_und_koerper'))
      .toContain('The body below position 1 belongs to the face above position 1')
  })

  it('gilt fuer zwei Personen genauso, wenn man ihn waehlt', () => {
    const t = gruppenPrompt(ZWEI, 'kopf_und_koerper')
    expect(t).toContain('exactly two people')
    expect(t).toContain('CROPPED, NOT HEADLESS')
    expect(t).not.toContain('TWO EQUAL HALVES')
  })

  it('behaelt in JEDEM Aufbau die gemeinsamen Regeln', () => {
    for (const a of AUFBAUTEN.map(x => x.id)) {
      for (const leute of [ZWEI, DREI]) {
        const t = gruppenPrompt(leute, a)
        expect(t).toContain('FILL THE SHEET')
        expect(t).toMatch(/Do not swap, mix or blend clothing/)
        expect(t).toMatch(/No names, no labels, no numbers/)
        expect(t).toMatch(/light grey studio background/)
      }
    }
  })

  it('bietet genau zwei Aufbauten mit Erklaerung an', () => {
    expect(AUFBAUTEN).toHaveLength(2)
    for (const a of AUFBAUTEN) {
      expect(a.label.length).toBeGreaterThan(3)
      expect(a.hinweis.length).toBeGreaterThan(20)
    }
  })
})

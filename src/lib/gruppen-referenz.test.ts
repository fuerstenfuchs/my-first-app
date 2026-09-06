import { describe, it, expect } from 'vitest'
import {
  gruppenReferenzen, gruppenZuordnung, gruppenPrompt, warnung,
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
    expect(t).toContain('two faces visible')
    expect(t).toContain('no one else')
  })

  it('verlangt Abstand statt Ueberlappung', () => {
    // Im Shooting sollen sich Silhouetten ueberlappen. Hier ist das Gegenteil
    // richtig: Das Modell muss spaeter jede Person einzeln herauslesen.
    const t = gruppenPrompt(ZWEI)
    expect(t).toMatch(/do NOT touch/)
    expect(t).toMatch(/silhouettes do NOT overlap/)
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

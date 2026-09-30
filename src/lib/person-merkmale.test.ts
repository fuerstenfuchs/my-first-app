import { describe, it, expect } from 'vitest'
import {
  bereinigeHautzeichen, hautzeichenText, lesePersonMerkmale, STELLEN,
} from './person-merkmale'
import { koerperMerkmaleText, kettenPrompt } from './referenzkette'
import { baueAuftraege, type PersonenbildEingabe } from './personenbild'
import { MERKMAL_FELDER, feldFuer } from './koerper-felder'
import { bereinigeMerkmale } from './koerper-nutzer-presets'
import { MUSKEL_REIHE, KARTEN_REIHE, kartenNummer, modusVon, gesetzteRegionen } from './koerper-regionen'

const EIGEN = 'https://gsfrbxdesarlhfijmguu.supabase.co'
const EINGABE: PersonenbildEingabe = {
  personId: 'c1', personName: 'Ben',
  personQuellen: [{ url: `${EIGEN}/storage/v1/object/public/prompt-media/s.png`, art: 'sheet' }],
  outfitId: 'o1', outfitName: 'Kurze Hose', outfitBild: `${EIGEN}/storage/v1/object/public/prompt-media/k.png`,
  koerperBild: null, koerperAuswahl: {}, formate: ['vorn'], modell: 'gpt-image-2.5-sunburst', durchlaufId: 'l',
}

describe('Hautzeichen', () => {
  it('werfen unbekannte Stellen, leere Texte und Nicht-Listen weg', () => {
    expect(bereinigeHautzeichen('quatsch')).toEqual([])
    expect(bereinigeHautzeichen([
      { stelle: 'oberschenkel_l', text: '  Drache  ' },
      { stelle: 'nirgends', text: 'x' },
      { stelle: 'hals', text: '   ' },
      null,
    ])).toEqual([{ stelle: 'oberschenkel_l', text: 'Drache' }])
  })
  it('lesen Geschlecht und Zeichen aus den Metadaten, ohne andere Angaben zu brauchen', () => {
    const m = lesePersonMerkmale({ gruppe: { anzahl: 2 }, geschlecht: 'mann', hautzeichen: [{ stelle: 'hals', text: 'Narbe' }] })
    expect(m.geschlecht).toBe('mann')
    expect(m.hautzeichen).toHaveLength(1)
    expect(lesePersonMerkmale(null)).toEqual({ hautzeichen: [], geschlecht: null })
    expect(lesePersonMerkmale({ geschlecht: 'x' }).geschlecht).toBeNull()
  })
  it('ergeben ohne Einträge keinen Block, mit Einträgen die Stelle auf Englisch und die Regel „auch wenn verdeckt“', () => {
    expect(hautzeichenText([])).toBeNull()
    const t = hautzeichenText([{ stelle: 'oberschenkel_l', text: 'dragon tattoo' }])!
    expect(t).toContain("the person's left thigh: dragon tattoo")
    expect(t).toMatch(/OVERRIDE the reference images/)
    expect(t).toMatch(/covered by clothing or bare without the mark/)
  })
  it('haben für jede Stelle eine englische Bezeichnung', () => {
    for (const s of STELLEN) expect(s.en.length).toBeGreaterThan(2)
  })
  it('gehen in JEDEN Kettenschritt und in jedes Personenbild', () => {
    const block = hautzeichenText([{ stelle: 'oberschenkel_l', text: 'dragon tattoo' }])
    for (const schritt of ['kopf', 'koerper', 'referenzsheet'] as const) {
      expect(kettenPrompt(schritt, 'BASIS', { hatKoerperfoto: false, hautzeichen: block })).toContain('left thigh: dragon tattoo')
      expect(kettenPrompt(schritt, 'BASIS', { hatKoerperfoto: false })).not.toContain('SKIN MARKS OF THIS PERSON')
    }
    const a = baueAuftraege({ ...EINGABE, hautzeichen: [{ stelle: 'oberschenkel_l', text: 'dragon tattoo' }] })
    expect(a[0].prompt).toContain('left thigh: dragon tattoo')
    expect(baueAuftraege(EINGABE)[0].prompt).not.toContain('SKIN MARKS OF THIS PERSON')
    // Der Vorrangsatz nennt die Hautzeichen als Zusatz zur Personenreferenz (Critic T2)
    expect(a[0].prompt).toMatch(/SKIN MARKS lines below, if any, are added on top/)
  })
  it('ändern den Körpermodus nicht: allein stehen sie nicht als „Körperzeilen“ da', () => {
    const a = baueAuftraege({ ...EINGABE, hautzeichen: [{ stelle: 'hals', text: 'Narbe' }] })
    expect(a[0].prompt).not.toContain('ADDITIONAL BODY CHARACTERISTICS')
  })
})

describe('Muskeldefinition', () => {
  it('hat neun Felder mit je sechs Stufen von „nicht sichtbar“ bis „extrem“', () => {
    const felder = MERKMAL_FELDER.filter(f => f.schluessel.startsWith('muskel'))
    expect(felder).toHaveLength(9)
    for (const f of felder) expect(f.optionen.map(o => o.wert)).toEqual(['nicht_sichtbar', 'kaum', 'leicht', 'deutlich', 'stark', 'extrem'])
  })
  it('hat für jede Stufe jedes Feldes einen Prompt-Text (keine Zeile „undefined“)', () => {
    for (const f of MERKMAL_FELDER.filter(x => x.schluessel.startsWith('muskel'))) {
      for (const o of f.optionen) {
        const t = koerperMerkmaleText({ [f.schluessel]: o.wert })
        expect(t).toBeTruthy()
        expect(t).not.toContain('undefined')
      }
    }
  })
  it('bleibt in Presets erhalten und wirft Fremdes hinaus', () => {
    expect(bereinigeMerkmale({ muskel_brust: 'extrem', muskel_arme: 'riesig' })).toEqual({ muskel_brust: 'extrem' })
  })
  it('hat eine eigene Karte mit eigener Nummerierung 1…9', () => {
    expect(MUSKEL_REIHE).toHaveLength(9)
    expect(KARTEN_REIHE).toHaveLength(12)
    expect(kartenNummer('muskel')).toBe(1)
    expect(kartenNummer('muskel_waden')).toBe(9)
    expect(kartenNummer('wade')).toBe(12)
    expect(modusVon('muskel_bauch')).toBe('muskeln')
    expect(gesetzteRegionen({ bau: 'schlank', muskel: 'stark' }).map(r => r.schluessel)).toEqual(['bau', 'muskel'])
  })
})

describe('Männer und Frauen', () => {
  it('sagen beim Bauch etwas anderes, bei Stufe „sehr weich“', () => {
    const frau = koerperMerkmaleText({ bauch: 'sehr_weich' }, 'frau')!
    const mann = koerperMerkmaleText({ bauch: 'sehr_weich' }, 'mann')!
    expect(mann).toContain('beer-belly')
    expect(frau).not.toContain('beer-belly')
    expect(koerperMerkmaleText({ bauch: 'sehr_weich' })).toBe(frau)
  })
  it('nennen bei Männern die Oberweite Brustkorb', () => {
    expect(koerperMerkmaleText({ oberweite: 'sehr_gross' }, 'mann')).toContain('barrel-shaped')
    const f = MERKMAL_FELDER.find(x => x.schluessel === 'oberweite')!
    expect(feldFuer(f, 'mann').label).toBe('Brustkorb')
    expect(feldFuer(f, 'frau').label).toBe('Oberweite')
    expect(feldFuer(f, 'mann').optionen.map(o => o.wert)).toEqual(f.optionen.map(o => o.wert))
  })
  it('ändern andere Regionen nicht', () => {
    expect(koerperMerkmaleText({ becken: 'ausladend' }, 'mann')).toBe(koerperMerkmaleText({ becken: 'ausladend' }, 'frau'))
  })
  it('gehen ins Personenbild', () => {
    const a = baueAuftraege({ ...EINGABE, geschlecht: 'mann', koerperAuswahl: { bauch: 'sehr_weich' } })
    expect(a[0].prompt).toContain('beer-belly')
  })
})

describe('Widerspruchsfreiheit der Muskelzeilen (Critic K1)', () => {
  it('die Massentexte enthalten keine Definitionswörter mehr, die einer Muskelzeile widersprechen könnten', () => {
    const massen = koerperMerkmaleText({
      bauch: 'sehr_flach', wade: 'kraeftig', oberschenkel: 'kraeftig', arme: 'kraeftig', bau: 'sportlich',
    })!
    expect(massen).not.toMatch(/muscul|toned|defined|definition/i)
  })
  it('der Gesamtwert gibt den Regionen ausdrücklich Vorrang', () => {
    const t = koerperMerkmaleText({ muskel: 'nicht_sichtbar', muskel_arme: 'extrem' })!
    expect(t).toMatch(/unless a muscle line below names a body area differently/)
    expect(t).not.toMatch(/anywhere on the body/)
  })
})

describe('Karte und Geschlecht (Critic C1)', () => {
  it('die Chips der gesetzten Regionen nennen bei Männern Brustkorb und Kleinen Bauch/Bierbauch', () => {
    const r = gesetzteRegionen({ oberweite: 'sehr_gross', bauch: 'sehr_weich' }, 'mann')
    expect(r.map(x => x.label)).toContain('Brustkorb')
    expect(r.find(x => x.schluessel === 'bauch')!.stufe).toBe('Bierbauch')
    expect(gesetzteRegionen({ oberweite: 'sehr_gross' }).map(x => x.label)).toContain('Oberweite')
  })
})

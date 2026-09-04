import { describe, it, expect } from 'vitest'
import {
  REIHEN_ORDNUNG, REIHE_VORBELEGUNG, sortiereEinstellungen, baueReihe,
  reiheMeta, reihenAnsage, einstellungLabel,
} from './einstellungsreihe'
import { SHOT_TYPES, type ShotTypeKey } from './scene-builder-options'
import { buildPrompt, type Scene } from './szene-prompt'

/** Eine Szene, die alles trägt, was NICHT variieren darf. */
const SZENE: Scene = {
  scene_type: 'indoor',
  time_of_day: null,
  season: null,
  weather: null,
  light_source: 'fensterlicht',
  light_style: 'rembrandt',
  light_modifiers: [],
  shot_type: 'portrait',
  camera_angle: 'low_angle',
  lens: '85mm',
  depth_of_field: 'shallow_dof',
  aspect_ratio: 'landscape_16_9',
  character: null,
  outfit: null,
  location: null,
  pose: null,
  expression: null,
  camera: null,
  style: null,
  grading: null,
  background: null,
}

describe('REIHEN_ORDNUNG', () => {
  it('geht von weit nach nah, nicht umgekehrt', () => {
    expect(REIHEN_ORDNUNG[0]).toBe('establishing_shot')
    expect(REIHEN_ORDNUNG[REIHEN_ORDNUNG.length - 1]).toBe('extreme_closeup')
  })

  it('enthält jede vorhandene Einstellungsgröße genau einmal', () => {
    expect(REIHEN_ORDNUNG).toHaveLength(SHOT_TYPES.length)
    expect(new Set(REIHEN_ORDNUNG).size).toBe(SHOT_TYPES.length)
    for (const s of SHOT_TYPES) expect(REIHEN_ORDNUNG).toContain(s.key)
  })

  it('lässt SHOT_TYPES unangetastet — .reverse() arbeitet in place', () => {
    expect(SHOT_TYPES[0].key).toBe('extreme_closeup')
  })
})

describe('REIHE_VORBELEGUNG', () => {
  it('sind die fünf Größen aus der Spezifikation', () => {
    expect(REIHE_VORBELEGUNG).toEqual([
      'establishing_shot', 'full_body', 'half_body', 'closeup', 'extreme_closeup',
    ])
  })

  it('besteht nur aus bekannten Einstellungsgrößen', () => {
    for (const k of REIHE_VORBELEGUNG) expect(REIHEN_ORDNUNG).toContain(k)
  })

  it('ist bereits filmisch sortiert', () => {
    expect(sortiereEinstellungen(REIHE_VORBELEGUNG)).toEqual(REIHE_VORBELEGUNG)
  })
})

describe('sortiereEinstellungen', () => {
  it('bringt die Klickreihenfolge in filmische Ordnung', () => {
    expect(sortiereEinstellungen(['closeup', 'establishing_shot', 'half_body']))
      .toEqual(['establishing_shot', 'half_body', 'closeup'])
  })

  it('wirft Doppelte weg', () => {
    expect(sortiereEinstellungen(['closeup', 'closeup', 'closeup'])).toEqual(['closeup'])
  })

  it('wirft Unbekanntes weg', () => {
    expect(sortiereEinstellungen(['schulterblick' as ShotTypeKey, 'closeup']))
      .toEqual(['closeup'])
  })

  it('leere Auswahl bleibt leer', () => {
    expect(sortiereEinstellungen([])).toEqual([])
  })
})

describe('baueReihe', () => {
  it('erzeugt je gewählter Einstellung genau einen Eintrag', () => {
    const reihe = baueReihe(SZENE, ['closeup', 'establishing_shot'])
    expect(reihe).toHaveLength(2)
    expect(reihe.map(e => e.shot_type)).toEqual(['establishing_shot', 'closeup'])
  })

  it('nummeriert 1..n in filmischer Reihenfolge', () => {
    const reihe = baueReihe(SZENE, ['extreme_closeup', 'wide_shot', 'half_body'])
    expect(reihe.map(e => e.nr)).toEqual([1, 2, 3])
    expect(reihe.every(e => e.gesamt === 3)).toBe(true)
    expect(reihe.map(e => e.shot_type)).toEqual(['wide_shot', 'half_body', 'extreme_closeup'])
  })

  it('erzeugt für jede Einstellung einen ANDEREN Prompt', () => {
    const reihe = baueReihe(SZENE, REIHE_VORBELEGUNG)
    const prompts = new Set(reihe.map(e => e.prompt))
    expect(prompts.size).toBe(reihe.length)
  })

  it('trägt den Textbaustein der jeweiligen Einstellungsgröße', () => {
    const reihe = baueReihe(SZENE, ['closeup', 'wide_shot'])
    const weit = reihe.find(e => e.shot_type === 'wide_shot')!
    const nah  = reihe.find(e => e.shot_type === 'closeup')!
    // Der Kamerasatz wird als Satz gross geschrieben — deshalb ohne Rücksicht
    // auf Gross-/Kleinschreibung vergleichen.
    expect(weit.prompt.toLowerCase()).toContain('wide shot with strong environmental context')
    expect(nah.prompt.toLowerCase()).toContain('close-up portrait framing')
    expect(weit.prompt.toLowerCase()).not.toContain('close-up portrait framing')
  })

  it('ändert AUSSER der Einstellungsgröße nichts an der Szene', () => {
    // Der Vergleichsprompt entsteht durch denselben einen Austausch — wäre in
    // `baueReihe` etwas anderes mitgeändert (Objektiv, Licht, Format), liefe
    // dieser Vergleich auseinander.
    for (const key of REIHE_VORBELEGUNG) {
      const [e] = baueReihe(SZENE, [key])
      expect(e.prompt).toBe(buildPrompt({ ...SZENE, shot_type: key }))
    }
  })

  it('lässt die übergebene Szene unverändert', () => {
    const kopie = JSON.parse(JSON.stringify(SZENE))
    baueReihe(SZENE, REIHE_VORBELEGUNG)
    expect(JSON.parse(JSON.stringify(SZENE))).toEqual(kopie)
    expect(SZENE.shot_type).toBe('portrait')
  })

  it('leere Auswahl ergibt keine Reihe', () => {
    expect(baueReihe(SZENE, [])).toEqual([])
  })

  it('behält das Format der Szene über die ganze Reihe', () => {
    // Ein Wechsel des Seitenverhältnisses mitten in der Reihe wäre keine
    // Reihe mehr. Der Formatsatz muss deshalb in jedem Prompt derselbe sein.
    const reihe = baueReihe(SZENE, REIHE_VORBELEGUNG)
    for (const e of reihe) expect(e.prompt).toContain('16:9')
  })

  it('gibt den Anzeigenamen aus dem Scene Builder zurück', () => {
    const [e] = baueReihe(SZENE, ['establishing_shot'])
    expect(e.label).toBe('Establishing Shot')
    expect(einstellungLabel('extreme_closeup')).toBe('Extreme Close-Up')
  })
})

describe('reiheMeta', () => {
  it('hängt Kennung, Nummer und Gesamtzahl an die vorhandenen Angaben', () => {
    const [e] = baueReihe(SZENE, ['closeup'])
    const meta = reiheMeta({ name: 'Anna', herkunft: 'scene-builder' }, 'r-1', e)
    expect(meta).toMatchObject({
      name: 'Anna',
      herkunft: 'scene-builder',
      shot_type: 'closeup',
      reihe_id: 'r-1',
      reihe_nr: 1,
      reihe_gesamt: 1,
    })
  })

  it('überschreibt shot_type der Basis mit dem der Einstellung', () => {
    const reihe = baueReihe(SZENE, ['closeup', 'wide_shot'])
    const metas = reihe.map(e => reiheMeta({ shot_type: 'portrait' }, 'r-2', e))
    expect(metas.map(m => m.shot_type)).toEqual(['wide_shot', 'closeup'])
    expect(metas.map(m => m.reihe_nr)).toEqual([1, 2])
    expect(metas.every(m => m.reihe_id === 'r-2')).toBe(true)
  })

  it('lässt die Basis unverändert', () => {
    const basis = { name: 'Anna' }
    const [e] = baueReihe(SZENE, ['closeup'])
    reiheMeta(basis, 'r-3', e)
    expect(basis).toEqual({ name: 'Anna' })
  })
})

describe('reihenAnsage', () => {
  it('nennt die Zahl der Bilder vor dem Klick', () => {
    expect(reihenAnsage(0)).toBe('Keine Einstellung gewählt')
    expect(reihenAnsage(1)).toBe('1 Einstellung = 1 Bild')
    expect(reihenAnsage(5)).toBe('5 Einstellungen = 5 Bilder')
    expect(reihenAnsage(10)).toBe('10 Einstellungen = 10 Bilder')
  })

  it('die Zahl entspricht der tatsächlich gebauten Reihe', () => {
    // Doppelte in der Auswahl dürfen die Ansage nicht aufblähen — sonst nennt
    // der Knopf mehr Bilder, als eingereiht werden (oder umgekehrt).
    const auswahl: ShotTypeKey[] = ['closeup', 'closeup', 'wide_shot']
    const reihe = baueReihe(SZENE, auswahl)
    expect(reihenAnsage(reihe.length)).toBe('2 Einstellungen = 2 Bilder')
  })
})

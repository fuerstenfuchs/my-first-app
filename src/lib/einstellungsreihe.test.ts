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

/**
 * Die zweite Szene traegt genau das, was der ersten fehlt: sie ist DRAUSSEN,
 * jedes Feld ist belegt, und sie steht auf 135mm.
 *
 * WARUM DAS NOETIG WAR: `SZENE` ist innen und hat Charakter, Outfit, Location,
 * Tageszeit und Wetter auf `null`. Ein Fehler, der genau diese Felder
 * unterschlaegt, blieb damit unsichtbar — die Tests waren gruen, weil in der
 * Testszene ohnehin nichts drinstand. Gefunden bei der Pruefung am 04.09.2026.
 *
 * 135mm ist kein beliebiger Wert: zusammen mit `closeup` loest es
 * `CAMERA_COMBO_OVERRIDES` in `szene-prompt.ts` aus. Genau dort brach die
 * Kontinuitaet.
 */
/**
 * Wie in `szene-prompt.test.ts`: die Bausteine sind im Test nur Attrappen mit
 * den Feldern, die `buildPrompt` liest. `Record<string, unknown>` ist der
 * Hausweg dafuer — die vollen Typen (`Character`, `Outfit`, `Location`, …)
 * haben ein Dutzend Felder, die fuer den Prompt-Bau keine Rolle spielen.
 */
const aussen = (felder: Record<string, unknown> = {}): Scene => ({ ...SZENE, ...felder })

/**
 * Die zweite Testszene traegt genau das, was der ersten fehlt: sie ist
 * DRAUSSEN, jedes Feld ist belegt, und sie steht auf 135mm.
 *
 * WARUM DAS NOETIG WAR: `SZENE` ist innen und hat Charakter, Outfit, Location,
 * Tageszeit und Wetter auf `null`. Ein Fehler, der genau diese Felder
 * unterschlaegt, blieb damit unsichtbar — die Tests waren gruen, weil in der
 * Testszene ohnehin nichts drinstand. Gefunden bei der Pruefung am 04.09.2026.
 *
 * 135mm ist kein beliebiger Wert: zusammen mit `closeup` loest es
 * `CAMERA_COMBO_OVERRIDES` in `szene-prompt.ts` aus. Genau dort brach die
 * Kontinuitaet — der Sonderfall verwarf Kamerawinkel, Tiefenschaerfe und
 * Format fuer dieses eine Bild der Reihe.
 */
const AUSSEN_SZENE: Scene = aussen({
  scene_type: 'outdoor',
  time_of_day: 'golden_hour',
  season: 'herbst',
  weather: 'sonnig',
  light_source: null,
  lens: '135mm',
  depth_of_field: 'deep_focus',
  character: { id: 'c1', name: 'Anna', cover_image_url: null },
  outfit:    { id: 'o1', name: 'Mantel', cover_image_url: null },
  location:  { id: 'l1', name: 'Bruecke', cover_image_url: null },
  pose:      { id: 'p1', name: 'Stehend', description: 'standing upright' },
  expression: { id: 'e1', name: 'Neutral', description: 'Calm, neutral expression.' },
})

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

  /*
   * DER TEST OBEN IST TAUTOLOGISCH — er vergleicht `baueReihe` mit demselben
   * Ausdruck, den `baueReihe` selbst rechnet. Er faengt nur Fehler INNERHALB
   * von `baueReihe`. Dass `buildPrompt` im Feld `shot_type` gar nicht oertlich
   * ist, konnte er nie sehen.
   *
   * Die folgenden Tests messen deshalb am Ergebnis: Was nicht die
   * Einstellungsgroesse ist, muss in JEDEM Bild der Reihe woertlich
   * dieselbe Angabe tragen.
   */
  it('traegt Kamerawinkel, Tiefenschaerfe und Format in JEDEM Bild der Reihe', () => {
    const reihe = baueReihe(AUSSEN_SZENE, REIHE_VORBELEGUNG)
    for (const e of reihe) {
      const p = e.prompt.toLowerCase()
      expect(p, `${e.shot_type}: Kamerawinkel fehlt`).toContain('low-angle camera view')
      expect(p, `${e.shot_type}: Tiefenschaerfe fehlt`).toContain('deep focus')
      expect(p, `${e.shot_type}: Format fehlt`).toContain('16:9')
    }
  })

  it('traegt Charakter, Outfit und Location in JEDEM Bild der Reihe', () => {
    const reihe = baueReihe(AUSSEN_SZENE, REIHE_VORBELEGUNG)
    for (const e of reihe) {
      const p = e.prompt.toLowerCase()
      expect(p, `${e.shot_type}: Charakterreferenz fehlt`).toContain('character reference')
      expect(p, `${e.shot_type}: Outfitreferenz fehlt`).toContain('outfit reference')
      expect(p, `${e.shot_type}: Locationreferenz fehlt`).toContain('location reference')
    }
  })

  it('traegt Tageszeit und Wetter unveraendert durch die ganze Reihe', () => {
    // Eine Reihe, die mitten im Schnitt von Abendlicht auf Mittag springt,
    // ist keine Reihe. Draussen sind das echte Felder — drinnen wertet
    // `buildEnvironmentSentence` sie gar nicht aus, deshalb die Aussenszene.
    const reihe = baueReihe(AUSSEN_SZENE, REIHE_VORBELEGUNG)
    for (const e of reihe) {
      const p = e.prompt.toLowerCase()
      expect(p, `${e.shot_type}: Tageszeit fehlt`).toContain('golden-hour')
      expect(p, `${e.shot_type}: Jahreszeit fehlt`).toContain('autumn')
      expect(p, `${e.shot_type}: Wetter fehlt`).toContain('clear sunny sky')
    }
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

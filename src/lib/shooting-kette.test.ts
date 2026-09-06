import { describe, it, expect } from 'vitest'
import { baueShooting, KETTE_VORGABE, kettenAnsage } from './shooting-kette'
import { SHOOTING_SPOTS } from './shooting-spots'
import type { Scene } from './szene-prompt'
import type { Outfit } from '@/hooks/use-outfits'

/**
 * Was diese Kette von vier Einzelbildern unterscheidet, ist ZUSAMMENHANG —
 * und der geht lautlos verloren. Vier Aufträge laufen einzeln; das Modell
 * sieht sie nie nebeneinander. Fällt der Kontinuitätsblock aus einem Prompt,
 * merkt man es erst an den fertigen Bildern, und dann sind sie bezahlt.
 */
const OUTFIT_A = { id: 'a', name: 'Leinenkleid', cover_image_url: 'https://x/a.jpg' } as unknown as Outfit
const OUTFIT_B = { id: 'b', name: 'Lederjacke', cover_image_url: 'https://x/b.jpg' } as unknown as Outfit

const SZENE = {
  scene_type: 'outdoor', time_of_day: 'golden_hour', season: null, weather: null,
  light_source: null, light_style: null, light_modifiers: [],
  shot_type: 'portrait', camera_angle: null, lens: null, depth_of_field: null,
  aspect_ratio: null, character: null, outfit: OUTFIT_A, location: null,
  pose: null, expression: null, camera: null, style: null, grading: null,
  background: null, ground: null, wind: null,
} as unknown as Scene

describe('baueShooting', () => {
  it('liefert vier Plaetze plus Uebergang', () => {
    const k = baueShooting(SZENE)
    expect(k).toHaveLength(5)
    expect(k.map(s => s.key)).toEqual(['weit', 'tiefe', 'uebergang', 'flaeche', 'gegenlicht'])
  })

  it('laesst den Uebergang weg, wenn er abgewaehlt ist', () => {
    const k = baueShooting(SZENE, { ...KETTE_VORGABE, mitUebergang: false })
    expect(k).toHaveLength(4)
    expect(k.map(s => s.key)).not.toContain('uebergang')
    // Und die Zaehlung muss mitgehen, sonst steht „Bild 4 von 5" auf dem letzten.
    expect(k.at(-1)!.nr).toBe(4)
    expect(k.at(-1)!.gesamt).toBe(4)
  })

  it('gibt jedem Schritt eine andere Einstellungsgroesse', () => {
    // Vier gleiche Groessen waeren vier Versuche statt einer Serie.
    const k = baueShooting(SZENE)
    expect(new Set(k.map(s => s.shot_type)).size).toBe(5)
  })

  it('gibt jedem Schritt eine andere Haltung', () => {
    const k = baueShooting(SZENE)
    const posen = k.map(s => s.prompt.split('POSE\n')[1]?.split('\n')[0])
    expect(new Set(posen).size).toBe(5)
  })

  it('nummeriert durchgehend und nennt in JEDEM Prompt die Gesamtzahl', () => {
    const k = baueShooting(SZENE)
    k.forEach((s, i) => {
      expect(s.nr).toBe(i + 1)
      expect(s.gesamt).toBe(5)
      expect(s.prompt).toContain(`picture ${i + 1} of 5`)
    })
  })

  it('haelt die Kontinuitaet in jedem einzelnen Prompt fest', () => {
    // Die Auftraege laufen getrennt — steht es nicht in JEDEM, gilt es nicht.
    for (const s of baueShooting(SZENE)) {
      expect(s.prompt).toContain('ONE photo shoot')
      expect(s.prompt).toMatch(/Same person, same day/)
    }
  })

  it('setzt je Schritt den Baustein seines eigenen Platzes ein', () => {
    for (const s of baueShooting(SZENE)) {
      if (s.key === 'uebergang') continue
      const eigener = SHOOTING_SPOTS.find(sp => sp.key === s.key)!
      expect(s.prompt).toContain(eigener.baustein)
      for (const anderer of SHOOTING_SPOTS) {
        if (anderer.key !== s.key) expect(s.prompt).not.toContain(anderer.baustein)
      }
    }
  })
})

describe('Outfitwechsel', () => {
  it('bleibt ohne zweites Outfit durchgehend beim ersten', () => {
    const k = baueShooting(SZENE)
    expect(k.every(s => s.outfit === OUTFIT_A)).toBe(true)
    expect(k.every(s => s.prompt.includes('outfit stays exactly the same'))).toBe(true)
  })

  it('wechselt erst NACH dem Uebergang, nicht schon waehrend', () => {
    // Der Uebergang ist der Weg dorthin — er traegt noch das erste Outfit.
    const k = baueShooting(SZENE, { ...KETTE_VORGABE, zweitesOutfit: OUTFIT_B })
    expect(k.map(s => s.outfit)).toEqual([OUTFIT_A, OUTFIT_A, OUTFIT_A, OUTFIT_B, OUTFIT_B])
  })

  it('sagt genau den gewechselten Schritten, dass gewechselt wurde', () => {
    const k = baueShooting(SZENE, { ...KETTE_VORGABE, zweitesOutfit: OUTFIT_B })
    const gewechselt = k.filter(s => s.prompt.includes('outfit changes here'))
    expect(gewechselt.map(s => s.key)).toEqual(['flaeche', 'gegenlicht'])
  })

  it('wechselt auch ohne Uebergang zur richtigen Haelfte', () => {
    const k = baueShooting(SZENE, { mitUebergang: false, zweitesOutfit: OUTFIT_B })
    expect(k.map(s => s.outfit)).toEqual([OUTFIT_A, OUTFIT_A, OUTFIT_B, OUTFIT_B])
  })
})

describe('kettenAnsage', () => {
  it('nennt die Zahl mit Einheit', () => {
    expect(kettenAnsage(5)).toContain('5 Bilder')
    expect(kettenAnsage(1)).toContain('Ein Bild')
  })
})

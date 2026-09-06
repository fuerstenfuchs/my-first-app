import { describe, it, expect } from 'vitest'
import { SHOOTING_SPOTS, spotPrompt, type SpotKey } from './shooting-spots'
import type { Location } from '@/hooks/use-locations'

/**
 * Drei Dinge entscheiden, ob eine Platte brauchbar ist — und alle drei gehen
 * lautlos verloren, wenn sie aus dem Prompt fallen:
 *
 *   leer          — eine erfundene Figur muss Mark erst wieder wegraeumen
 *   ein Foto      — ein Raster hat genau das Problem, das die Platten loesen
 *   neutrales Licht — eine Golden-Hour-Platte ist fuer nichts anderes zu haben
 */
const ORT = {
  id: 'x', user_id: 'u', name: 'Hamburger Speicherstadt',
  description: 'Backsteinlager an den Fleeten', category: 'stadt',
  location_type: 'stadtgebiet', tags: [], cover_image_url: 'https://x/y.jpg',
  source_url: null, source_title: null, metadata: {},
  created_at: '', updated_at: '',
} as unknown as Location

describe('SHOOTING_SPOTS', () => {
  it('hat vier Plaetze mit eindeutigen Kennungen', () => {
    expect(SHOOTING_SPOTS).toHaveLength(4)
    const keys = SHOOTING_SPOTS.map(s => s.key)
    expect(new Set(keys).size).toBe(4)
  })

  it('gibt jedem Platz einen eigenen Textbaustein', () => {
    // Zwei gleiche Bausteine ergaeben zwei gleiche Bilder — und Mark haette
    // vier Erzeugungen fuer drei Ergebnisse bezahlt.
    const bausteine = SHOOTING_SPOTS.map(s => s.baustein)
    expect(new Set(bausteine).size).toBe(4)
  })
})

describe('spotPrompt', () => {
  const alle = SHOOTING_SPOTS.map(s => [s.key, spotPrompt(s, ORT)] as [SpotKey, string])

  it.each(alle)('%s: schliesst Personen aus', (_key, p) => {
    expect(p).toMatch(/No person, no model, no silhouette/)
    expect(p).toMatch(/shadow of a person/)
    // Eine Markierung wird beim Bildmodell schnell zur Figur.
    expect(p).toMatch(/Do not mark it with a circle/)
  })

  it.each(alle)('%s: verlangt EIN Foto, kein Blatt', (_key, p) => {
    expect(p).toMatch(/ONE PHOTOGRAPH, NOT A SHEET/)
    expect(p).toMatch(/No grid, no panels, no collage/)
  })

  it.each(alle)('%s: laesst Tageszeit und Licht offen', (_key, p) => {
    expect(p).toMatch(/Soft, even daylight/)
    expect(p).toMatch(/no golden hour/)
    // Der Grund gehoert in den Prompt, nicht nur in den Kommentar.
    expect(p).toMatch(/time of day is chosen later/)
  })

  it.each(alle)('%s: nennt den Ort als Tatsache', (_key, p) => {
    expect(p).toContain('Hamburger Speicherstadt')
    expect(p).toMatch(/established fact, not as a guess/)
  })

  it('setzt den Baustein des jeweiligen Platzes ein, nicht den eines anderen', () => {
    for (const spot of SHOOTING_SPOTS) {
      const p = spotPrompt(spot, ORT)
      expect(p).toContain(spot.baustein)
      for (const anderer of SHOOTING_SPOTS) {
        if (anderer.key !== spot.key) expect(p).not.toContain(anderer.baustein)
      }
    }
  })

  it('kommt ohne Beschreibung aus', () => {
    // Nicht jede Location hat eine — ohne diese Pruefung stuende dort ein
    // baumelnder Gedankenstrich.
    const ohne = { ...ORT, description: null } as Location
    const p = spotPrompt(SHOOTING_SPOTS[0], ohne)
    expect(p).toContain('THE DEPICTED LOCATION IS: Hamburger Speicherstadt.')
    expect(p).not.toContain('— .')
  })
})

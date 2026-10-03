import { describe, it, expect } from 'vitest'
import {
  IM_MENUE, STUFEN, stufenFuer, VERFAHREN_NAME, VERFAHREN_HINWEIS, kostetGeld, kostenSatz, stufeLabel,
} from './upscaling'

describe('Vergrößern: 5K lokal (PROJ-94)', () => {
  it('beide lokalen Wege stehen im Menü, kosten nichts und haben genau eine Stufe 5K', () => {
    for (const v of ['lokal_5k', 'lokal_5k_zwei'] as const) {
      expect(IM_MENUE).toContain(v)
      expect(kostetGeld(v)).toBe(false)
      expect(STUFEN[v]).toEqual([{ art: 'ziel5k', wert: '5K' }])
      expect(stufeLabel(STUFEN[v][0])).toBe('5K')
      expect(VERFAHREN_NAME[v].length).toBeGreaterThan(0)
      expect(VERFAHREN_HINWEIS[v].length).toBeLessThanOrEqual(12)
      expect(kostenSatz(v, STUFEN[v][0])).toMatch(/kostet nichts/)
    }
  })

  it('Lokal · SeedVR2 hat 2×, 3× und 4× und kostet nichts', () => {
    expect(IM_MENUE).toContain('lokal')
    expect(kostetGeld('lokal')).toBe(false)
    expect(STUFEN.lokal.map(stufeLabel)).toEqual(['2×', '3×', '4×'])
    expect(kostenSatz('lokal', STUFEN.lokal[0])).toMatch(/kostet nichts/)
  })

  it('Crystal ist nicht mehr im Menü (zu teuer), die bezahlten Wege bleiben', () => {
    expect(IM_MENUE).not.toContain('crystal')
    expect(IM_MENUE).toContain('seedvr2')
  })

  it('Lokal · SeedVR2 zeigt nur Faktoren, die unter 18 Megapixel bleiben', () => {
    const faktoren = (b: number, h: number) => stufenFuer('lokal', { breite: b, hoehe: h }).map(stufeLabel)
    expect(faktoren(1000, 1000)).toEqual(['2×', '3×', '4×'])    // 16 MP bei 4×
    expect(faktoren(1390, 2048)).toEqual(['2×'])                // 3× wären 25,6 MP
    expect(faktoren(2100, 2100)).toEqual(['2×'])                // 17,6 MP: gerade noch
    expect(faktoren(2200, 2200)).toEqual([])                    // 19,4 MP: nichts
  })

  it('ohne bekannte Größe und bei anderen Verfahren bleibt alles stehen', () => {
    expect(stufenFuer('lokal', null).map(stufeLabel)).toEqual(['2×', '3×', '4×'])
    expect(stufenFuer('seedvr2', { breite: 5000, hoehe: 5000 }).map(stufeLabel)).toEqual(['2×', '3×', '4×'])
    expect(stufenFuer('lokal_5k', { breite: 5000, hoehe: 5000 })).toEqual(STUFEN.lokal_5k)
  })
})

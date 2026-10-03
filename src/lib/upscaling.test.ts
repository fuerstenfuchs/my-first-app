import { describe, it, expect } from 'vitest'
import {
  IM_MENUE, STUFEN, VERFAHREN_NAME, VERFAHREN_HINWEIS, kostetGeld, kostenSatz, stufeLabel,
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

  it('Crystal ist nicht mehr im Menü (zu teuer), die bezahlten Wege bleiben', () => {
    expect(IM_MENUE).not.toContain('crystal')
    expect(IM_MENUE).toContain('seedvr2')
  })
})

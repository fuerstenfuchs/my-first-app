import { describe, it, expect } from 'vitest'
import {
  groesseFuerFormat, formatAnsage, NATIVE_GROESSEN, GROESSE_VORGABE, DURCHLAEUFE,
} from './image-generation'
import { ASPECT_RATIOS } from './scene-builder-options'

describe('Formatzuordnung', () => {
  it('bildet jedes Trésor-Format auf eine Größe ab, die gpt-image-2 kennt', () => {
    // Fällt ein Format durch, würde die Gegenstelle den Auftrag ablehnen —
    // erst nachdem der Arbeiter ihn schon übernommen hat.
    for (const format of ASPECT_RATIOS) {
      const { size } = groesseFuerFormat(format.key)
      expect(NATIVE_GROESSEN, `Format ${format.key}`).toContain(size)
    }
  })

  it('ohne gewähltes Format quadratisch — die einzige Größe ohne Richtungsannahme', () => {
    expect(groesseFuerFormat(null).size).toBe(GROESSE_VORGABE)
    expect(groesseFuerFormat(null).exakt).toBe(true)
  })

  it('markiert nur 1:1 als exakt, alle anderen als angenähert', () => {
    expect(groesseFuerFormat('square_1_1').exakt).toBe(true)
    for (const key of ['landscape_16_9', 'story_9_16', 'portrait_4_5', 'cinematic_21_9'] as const) {
      expect(groesseFuerFormat(key).exakt, `Format ${key}`).toBe(false)
      expect(groesseFuerFormat(key).hinweis, `Format ${key} braucht einen Hinweis`).toBeTruthy()
    }
  })

  it('wählt hochkant für hochkant und quer für quer', () => {
    expect(groesseFuerFormat('story_9_16').size).toBe('1024x1536')
    expect(groesseFuerFormat('portrait_4_5').size).toBe('1024x1536')
    expect(groesseFuerFormat('landscape_16_9').size).toBe('1536x1024')
    expect(groesseFuerFormat('cinematic_21_9').size).toBe('1536x1024')
  })
})

describe('Formatansage für den Prompt', () => {
  // Nötig, weil gpt-image-2 den Größenparameter ignoriert, sobald ein
  // Referenzbild mitgeht (am 01.09.2026 nachgemessen: 1024x1024 angefordert,
  // 1122x1402 zurückbekommen). Dann hilft nur eine Ansage im Prompt.
  it('liefert für jedes Format eine Ansage', () => {
    for (const format of ASPECT_RATIOS) {
      const ansage = formatAnsage(format.key)
      expect(ansage, `Format ${format.key}`).toBeTruthy()
      expect(ansage!.length).toBeGreaterThan(10)
    }
  })

  it('liefert ohne Format keine Ansage', () => {
    expect(formatAnsage(null)).toBeNull()
  })

  it('nennt das Seitenverhältnis wörtlich, damit das Modell es aufgreift', () => {
    expect(formatAnsage('landscape_16_9')).toContain('16:9')
    expect(formatAnsage('story_9_16')).toContain('9:16')
    expect(formatAnsage('cinematic_21_9')).toContain('21:9')
    expect(formatAnsage('portrait_4_5')).toContain('4:5')
    expect(formatAnsage('square_1_1')).toContain('1:1')
  })
})

describe('Durchläufe', () => {
  it('bleibt innerhalb der Schranke der Datenbank (1 bis 4)', () => {
    // image_jobs hat check (variants between 1 and 4) — ein fünfter Wert in der
    // Oberfläche würde beim Speichern abgelehnt.
    expect(Math.min(...DURCHLAEUFE)).toBe(1)
    expect(Math.max(...DURCHLAEUFE)).toBe(4)
  })
})

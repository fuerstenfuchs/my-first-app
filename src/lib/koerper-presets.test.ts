import { describe, it, expect } from 'vitest'
import { KOERPER_PRESETS } from './koerper-presets'
import { istEigenerSpeicher } from './referenzkette'

describe('KOERPER_PRESETS', () => {
  it('hat 24 Presets, je zwei Extreme aus jeder der zwölf Regionen', () => {
    expect(KOERPER_PRESETS.length).toBe(24)
  })

  it('jeder Schlüssel und jede Bild-Adresse ist eindeutig', () => {
    expect(new Set(KOERPER_PRESETS.map(p => p.key)).size).toBe(KOERPER_PRESETS.length)
    expect(new Set(KOERPER_PRESETS.map(p => p.bildUrl)).size).toBe(KOERPER_PRESETS.length)
  })

  it('jedes Preset setzt genau EIN Körpermerkmal', () => {
    // Mischt sich in die bestehende Auswahl ein statt sie zu ersetzen (Mark,
    // 29.09.2026) — ein Preset, das mehrere Felder gleichzeitig setzt, würde
    // beim Einmischen unbemerkt andere, schon gewählte Werte überschreiben.
    for (const p of KOERPER_PRESETS) {
      expect(Object.keys(p.merkmale).length).toBe(1)
    }
  })

  it('jede Bild-Adresse liegt in Marks eigenem Speicher — sonst lehnt der Arbeiter sie ab', () => {
    for (const p of KOERPER_PRESETS) {
      expect(istEigenerSpeicher(p.bildUrl, 'https://gsfrbxdesarlhfijmguu.supabase.co')).toBe(true)
    }
  })
})

import { describe, it, expect } from 'vitest'
import {
  OUTFIT_KATEGORIEN, OUTFIT_KATEGORIE_STANDARD, KATEGORIE_EN,
  alsKategorie, istKleidungsstueck, kategorieEintrag,
} from './outfit-kategorien'

/**
 * Wächter für die Kategorienliste (PROJ-53).
 *
 * WARUM GETESTET: Die acht Kleidungsstück-Schlüssel stehen SO in der Spalte
 * `outfits.category` — sie sind Daten, nicht Beschriftung. Wer hier
 * „kopfbedeckungen" in „huete" umbenennt, bricht keine einzige Typprüfung:
 * Die Einträge verschwinden einfach aus ihrer Kategorie und tauchen nirgends
 * wieder auf. Genau diesen stillen Ausgang macht der Test laut.
 *
 * Gegenprobe beim Bau: Einen Schlüssel testweise geändert und die Reihenfolge
 * vertauscht — beide Male rot.
 */

/** Die Schlüssel, wie sie am 03.09.2026 in der Datenbank stehen. */
const SCHLUESSEL_IN_DER_DATENBANK = [
  'oberteile', 'unterteile', 'kleider', 'jacken',
  'schuhe', 'accessoires', 'kopfbedeckungen', 'sonstiges',
]

describe('OUTFIT_KATEGORIEN', () => {
  it('führt „komplett" an erster Stelle — das sind die bisherigen Outfits', () => {
    expect(OUTFIT_KATEGORIEN[0].key).toBe('komplett')
    expect(OUTFIT_KATEGORIE_STANDARD).toBe('komplett')
  })

  it('trägt die acht Kleidungsstück-Schlüssel unverändert und in alter Reihenfolge', () => {
    expect(OUTFIT_KATEGORIEN.slice(1).map(k => k.key)).toEqual(SCHLUESSEL_IN_DER_DATENBANK)
  })

  it('hat zu jeder Kategorie Beschriftung, Emoji und englische Bezeichnung', () => {
    for (const k of OUTFIT_KATEGORIEN) {
      expect(k.label.length, k.key).toBeGreaterThan(0)
      expect(k.emoji.length, k.key).toBeGreaterThan(0)
      expect(KATEGORIE_EN[k.key], k.key).toBeTypeOf('string')
      expect(KATEGORIE_EN[k.key].length, k.key).toBeGreaterThan(0)
    }
  })

  it('vergibt keinen Schlüssel zweimal', () => {
    const keys = OUTFIT_KATEGORIEN.map(k => k.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('alsKategorie', () => {
  it('lässt einen bekannten Wert durch', () => {
    expect(alsKategorie('jacken')).toBe('jacken')
    expect(alsKategorie('komplett')).toBe('komplett')
  })

  it('macht aus Unbekanntem die Vorgabe statt es durchzureichen', () => {
    // Sonst filtert die Seite auf eine Kategorie, die es in der Leiste nicht
    // gibt — der Eintrag wäre unsichtbar statt falsch einsortiert.
    expect(alsKategorie('gibtsnicht')).toBe('komplett')
    expect(alsKategorie(null)).toBe('komplett')
    expect(alsKategorie(undefined)).toBe('komplett')
  })
})

describe('istKleidungsstueck', () => {
  it('gilt für alle acht Kleidungsstück-Kategorien', () => {
    for (const key of SCHLUESSEL_IN_DER_DATENBANK) {
      expect(istKleidungsstueck(key), key).toBe(true)
    }
  })

  it('gilt NICHT für komplett — dort gibt es das Ghost-Mannequin-Sheet', () => {
    expect(istKleidungsstueck('komplett')).toBe(false)
  })

  it('gilt nicht für fehlende Werte', () => {
    expect(istKleidungsstueck(null)).toBe(false)
    expect(istKleidungsstueck(undefined)).toBe(false)
    expect(istKleidungsstueck('')).toBe(false)
  })
})

describe('kategorieEintrag', () => {
  it('findet den Eintrag zum Schlüssel', () => {
    expect(kategorieEintrag('schuhe').label).toBe('Schuhe')
  })

  it('fällt auf den ersten Eintrag zurück, statt undefined zu liefern', () => {
    // Die Seite liest davon direkt `.emoji` — undefined wäre ein Absturz beim
    // Rendern, und zwar erst bei dem einen Datensatz mit dem krummen Wert.
    expect(kategorieEintrag('gibtsnicht').key).toBe('komplett')
    expect(kategorieEintrag(null).key).toBe('komplett')
  })
})

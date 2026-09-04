import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useBausteinFilter } from './use-baustein-filter'
import type { SuchbarerEintrag } from '@/lib/bausteine'

/**
 * Was hier geprüft wird, ist NICHT die Suche selbst — die steht als reine
 * Funktion in `bausteine.test.ts`. Geprüft wird das, was ohne React nicht geht:
 * dass Suche und Kategorie beim Bereichswechsel zurückfallen.
 *
 * Warum das eine eigene Prüfung verdient: Bliebe „natur" beim Wechsel vom
 * Locations- zum Posen-Reiter stehen, wäre die Kachelliste leer — und zwar
 * ohne jede Fehlermeldung. Man sieht einen leeren Reiter und sucht den Fehler
 * bei den Daten.
 */

type E = SuchbarerEintrag & { id: string }

const LOCATIONS: E[] = [
  { id: '1', name: 'Borussia-Park', category: 'stadien_deutschland' },
  { id: '2', name: 'Wald im Nebel', category: 'natur' },
  { id: '3', name: 'Bergsee', category: 'natur' },
]

const POSEN: E[] = [
  { id: '4', name: 'Arme verschränkt, Blick nach unten, sitzend', category: 'sitzen' },
  { id: '5', name: 'Aufrecht stehend, Hände in den Taschen', category: 'stehend' },
]

describe('useBausteinFilter', () => {
  it('sucht wortweise über die mitgegebenen Felder', () => {
    const { result } = renderHook(() => useBausteinFilter(POSEN, 'posen'))
    act(() => result.current.setSuche('sitzend arme'))
    expect(result.current.gefiltert.map(e => e.id)).toEqual(['4'])
  })

  it('verbindet Suche und Kategorie', () => {
    const { result } = renderHook(() => useBausteinFilter(LOCATIONS, 'locations'))
    act(() => result.current.setKategorie('natur'))
    expect(result.current.gefiltert.map(e => e.id)).toEqual(['2', '3'])
    act(() => result.current.setSuche('berg'))
    expect(result.current.gefiltert.map(e => e.id)).toEqual(['3'])
  })

  it('setzt Suche UND Kategorie beim Bereichswechsel zurück', () => {
    const { result, rerender } = renderHook(
      ({ liste, bereich }: { liste: E[]; bereich: string }) =>
        useBausteinFilter(liste, bereich),
      { initialProps: { liste: LOCATIONS, bereich: 'locations' } },
    )
    act(() => {
      result.current.setSuche('wald')
      result.current.setKategorie('natur')
    })
    expect(result.current.suche).toBe('wald')

    rerender({ liste: POSEN, bereich: 'posen' })

    expect(result.current.suche).toBe('')
    expect(result.current.kategorie).toBeNull()
    // Und die neue Liste ist vollständig sichtbar — nicht leergefiltert von
    // einer Kategorie, die es hier gar nicht gibt.
    expect(result.current.gefiltert).toHaveLength(POSEN.length)
  })

  it('lässt Suche und Kategorie stehen, solange der Bereich derselbe bleibt', () => {
    const { result, rerender } = renderHook(
      ({ liste, bereich }: { liste: E[]; bereich: string }) =>
        useBausteinFilter(liste, bereich),
      { initialProps: { liste: LOCATIONS, bereich: 'locations' } },
    )
    act(() => result.current.setKategorie('natur'))
    // Dieselbe Art, nur neu geladene Daten — etwa nach dem Übernehmen eines
    // Bildes. Der Filter darf dabei nicht wegspringen.
    rerender({ liste: [...LOCATIONS], bereich: 'locations' })
    expect(result.current.kategorie).toBe('natur')
  })
})

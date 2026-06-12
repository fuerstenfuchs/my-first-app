import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCardCarousel } from './use-card-carousel'
import type { PreviewMediaItem } from './use-prompts'

const THREE_IMAGES: PreviewMediaItem[] = [
  { type: 'image', url: 'https://example.com/a.jpg', sort_order: 0 },
  { type: 'image', url: 'https://example.com/b.jpg', sort_order: 1 },
  { type: 'image', url: 'https://example.com/c.jpg', sort_order: 2 },
]

function mockMatchMedia(reducedMotion: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: reducedMotion ? query === '(prefers-reduced-motion: reduce)' : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('useCardCarousel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockMatchMedia(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Initialzustand ────────────────────────────────────────────────────────

  it('startet mit index 0 und inaktivem Carousel', () => {
    const { result } = renderHook(() => useCardCarousel(THREE_IMAGES))
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.isCarouselActive).toBe(false)
  })

  // ── Debounce-Verhalten ────────────────────────────────────────────────────

  it('aktiviert Carousel NICHT bei weniger als 200ms Hover', () => {
    const { result } = renderHook(() => useCardCarousel(THREE_IMAGES))
    act(() => { result.current.onMouseEnter() })
    act(() => { vi.advanceTimersByTime(199) })
    expect(result.current.isCarouselActive).toBe(false)
  })

  it('aktiviert Carousel nach genau 200ms Hover', () => {
    const { result } = renderHook(() => useCardCarousel(THREE_IMAGES))
    act(() => { result.current.onMouseEnter() })
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current.isCarouselActive).toBe(true)
  })

  it('aktiviert Carousel NICHT wenn Maus innerhalb der Debounce-Zeit verlässt', () => {
    const { result } = renderHook(() => useCardCarousel(THREE_IMAGES))
    act(() => { result.current.onMouseEnter() })
    act(() => { vi.advanceTimersByTime(100) })
    act(() => { result.current.onMouseLeave() })
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current.isCarouselActive).toBe(false)
  })

  // ── Kein Carousel bei 0 oder 1 Medium ────────────────────────────────────

  it('aktiviert Carousel NICHT bei 0 Medien', () => {
    const { result } = renderHook(() => useCardCarousel([]))
    act(() => { result.current.onMouseEnter() })
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current.isCarouselActive).toBe(false)
  })

  it('aktiviert Carousel NICHT bei genau 1 Medium', () => {
    const { result } = renderHook(() => useCardCarousel([THREE_IMAGES[0]]))
    act(() => { result.current.onMouseEnter() })
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current.isCarouselActive).toBe(false)
  })

  // ── Auto-Advance ──────────────────────────────────────────────────────────

  it('wechselt Index nach 1500ms', () => {
    const { result } = renderHook(() => useCardCarousel(THREE_IMAGES))
    act(() => { result.current.onMouseEnter() })
    act(() => { vi.advanceTimersByTime(200) })      // Debounce
    act(() => { vi.advanceTimersByTime(1500) })     // Erster Advance
    expect(result.current.currentIndex).toBe(1)
  })

  it('wechselt Index beim zweiten Tick', () => {
    const { result } = renderHook(() => useCardCarousel(THREE_IMAGES))
    act(() => { result.current.onMouseEnter() })
    act(() => { vi.advanceTimersByTime(200 + 3000) }) // Debounce + 2 × 1500ms
    expect(result.current.currentIndex).toBe(2)
  })

  it('springt nach letztem Element zurück auf Index 0', () => {
    const { result } = renderHook(() => useCardCarousel(THREE_IMAGES)) // 3 Elemente
    act(() => { result.current.onMouseEnter() })
    act(() => { vi.advanceTimersByTime(200 + 4500) }) // Debounce + 3 × 1500ms
    expect(result.current.currentIndex).toBe(0)
  })

  // ── onMouseLeave ──────────────────────────────────────────────────────────

  it('setzt Index und isCarouselActive auf 0/false beim Verlassen', () => {
    const { result } = renderHook(() => useCardCarousel(THREE_IMAGES))
    act(() => { result.current.onMouseEnter() })
    act(() => { vi.advanceTimersByTime(200 + 1500) }) // Carousel aktiv, Index = 1
    expect(result.current.currentIndex).toBe(1)
    act(() => { result.current.onMouseLeave() })
    expect(result.current.isCarouselActive).toBe(false)
    expect(result.current.currentIndex).toBe(0)
  })

  it('stoppt Auto-Advance nach onMouseLeave', () => {
    const { result } = renderHook(() => useCardCarousel(THREE_IMAGES))
    act(() => { result.current.onMouseEnter() })
    act(() => { vi.advanceTimersByTime(200 + 1500) }) // Index = 1
    act(() => { result.current.onMouseLeave() })
    act(() => { vi.advanceTimersByTime(5000) })        // viel Zeit verstreichen
    expect(result.current.currentIndex).toBe(0)       // bleibt auf 0 (reset)
  })

  // ── prefers-reduced-motion ────────────────────────────────────────────────

  it('aktiviert isCarouselActive auch mit prefers-reduced-motion', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useCardCarousel(THREE_IMAGES))
    act(() => { result.current.onMouseEnter() })
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current.isCarouselActive).toBe(true) // Punkte werden angezeigt
  })

  it('führt KEINEN Auto-Advance durch bei prefers-reduced-motion', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useCardCarousel(THREE_IMAGES))
    act(() => { result.current.onMouseEnter() })
    act(() => { vi.advanceTimersByTime(200 + 5000) }) // Lange warten
    expect(result.current.currentIndex).toBe(0)       // Index bleibt bei 0
  })

  // ── Erneutes Enter/Leave ──────────────────────────────────────────────────

  it('kann Carousel nach Leave erneut aktivieren', () => {
    const { result } = renderHook(() => useCardCarousel(THREE_IMAGES))
    act(() => { result.current.onMouseEnter() })
    act(() => { vi.advanceTimersByTime(200) })
    act(() => { result.current.onMouseLeave() })
    expect(result.current.isCarouselActive).toBe(false)
    // Zweites Enter
    act(() => { result.current.onMouseEnter() })
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current.isCarouselActive).toBe(true)
  })
})

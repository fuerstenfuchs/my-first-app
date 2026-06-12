import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useQuickCapture } from './use-quick-capture'

function fireKey(key: string, target: EventTarget = document) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true })
  Object.defineProperty(event, 'target', { value: target })
  document.dispatchEvent(event)
  return event
}

function makeElement(tag: string, contentEditable = false): HTMLElement {
  const el = document.createElement(tag)
  if (contentEditable) el.setAttribute('contenteditable', 'true')
  document.body.appendChild(el)
  return el
}

describe('useQuickCapture', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  // ── Initial state ──────────────────────────────────────────────────────────

  it('starts with isOpen = false', () => {
    const { result } = renderHook(() => useQuickCapture())
    expect(result.current.isOpen).toBe(false)
  })

  // ── open() / close() ───────────────────────────────────────────────────────

  it('open() sets isOpen to true', () => {
    const { result } = renderHook(() => useQuickCapture())
    act(() => result.current.open())
    expect(result.current.isOpen).toBe(true)
  })

  it('close() sets isOpen to false', () => {
    const { result } = renderHook(() => useQuickCapture())
    act(() => result.current.open())
    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)
  })

  it('open() is idempotent — calling twice does not toggle', () => {
    const { result } = renderHook(() => useQuickCapture())
    act(() => result.current.open())
    act(() => result.current.open())
    expect(result.current.isOpen).toBe(true)
  })

  // ── Q shortcut ─────────────────────────────────────────────────────────────

  it('Q key opens the modal when no input is focused', () => {
    const { result } = renderHook(() => useQuickCapture())
    act(() => { fireKey('q') })
    expect(result.current.isOpen).toBe(true)
  })

  it('uppercase Q also opens the modal', () => {
    const { result } = renderHook(() => useQuickCapture())
    act(() => { fireKey('Q') })
    expect(result.current.isOpen).toBe(true)
  })

  it('other keys do not open the modal', () => {
    const { result } = renderHook(() => useQuickCapture())
    act(() => { fireKey('a'); fireKey('Enter'); fireKey('Escape') })
    expect(result.current.isOpen).toBe(false)
  })

  // ── Guard: focused input elements ──────────────────────────────────────────

  it('Q is ignored when an INPUT element is the event target', () => {
    const { result } = renderHook(() => useQuickCapture())
    const input = makeElement('input')

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'q', bubbles: true })
      Object.defineProperty(event, 'target', { value: input })
      document.dispatchEvent(event)
    })

    expect(result.current.isOpen).toBe(false)
  })

  it('Q is ignored when a TEXTAREA element is the event target', () => {
    const { result } = renderHook(() => useQuickCapture())
    const textarea = makeElement('textarea')

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'q', bubbles: true })
      Object.defineProperty(event, 'target', { value: textarea })
      document.dispatchEvent(event)
    })

    expect(result.current.isOpen).toBe(false)
  })

  it('Q is ignored when a contentEditable element is the event target', () => {
    const { result } = renderHook(() => useQuickCapture())
    const div = makeElement('div', true)

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'q', bubbles: true })
      Object.defineProperty(event, 'target', { value: div })
      document.dispatchEvent(event)
    })

    expect(result.current.isOpen).toBe(false)
  })

  // ── Guard: modal already open ───────────────────────────────────────────────

  it('Q does nothing if modal is already open', () => {
    const { result } = renderHook(() => useQuickCapture())
    act(() => result.current.open())
    expect(result.current.isOpen).toBe(true)
    // Q while open — should remain open, not toggle
    act(() => { fireKey('q') })
    expect(result.current.isOpen).toBe(true)
  })

  // ── Cleanup ────────────────────────────────────────────────────────────────

  it('removes keydown listener on unmount', () => {
    const { result, unmount } = renderHook(() => useQuickCapture())
    unmount()
    act(() => { fireKey('q') })
    // After unmount, isOpen stays false (listener removed)
    expect(result.current.isOpen).toBe(false)
  })
})

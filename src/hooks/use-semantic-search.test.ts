import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSemanticSearch } from './use-semantic-search'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeSuccessResponse(ids: string[]) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ ids }),
  } as Response)
}

function makeErrorResponse() {
  return Promise.resolve({ ok: false } as Response)
}

describe('useSemanticSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockFetch.mockReset()
    mockFetch.mockImplementation(() => makeSuccessResponse(['id-1', 'id-2']))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Short query edge case ────────────────────────────────────────────────

  it('does not call fetch when query is shorter than 2 chars', async () => {
    const { result } = renderHook(() => useSemanticSearch('a', null, false))
    await act(async () => { vi.advanceTimersByTime(1500) })
    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.isSearching).toBe(false)
    expect(result.current.isEnhanced).toBe(false)
  })

  it('does not call fetch for empty query', async () => {
    const { result } = renderHook(() => useSemanticSearch('', null, false))
    await act(async () => { vi.advanceTimersByTime(1500) })
    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.semanticIds).toEqual([])
  })

  // ── Debounce behaviour ───────────────────────────────────────────────────

  it('does not call fetch before 1000ms debounce elapses', async () => {
    renderHook(() => useSemanticSearch('portrait photo', null, false))
    await act(async () => { vi.advanceTimersByTime(500) })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('calls fetch after 1000ms debounce', async () => {
    renderHook(() => useSemanticSearch('portrait photo', null, false))
    await act(async () => { vi.advanceTimersByTime(1000) })
    await act(async () => {}) // flush microtasks
    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch).toHaveBeenCalledWith('/api/search', expect.objectContaining({
      method: 'POST',
    }))
  })

  it('sends query, activeTag and favoritesOnly in request body', async () => {
    renderHook(() => useSemanticSearch('portrait', 'comfyui', true))
    await act(async () => { vi.advanceTimersByTime(1000) })
    await act(async () => {})
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.query).toBe('portrait')
    expect(body.activeTag).toBe('comfyui')
    expect(body.favoritesOnly).toBe(true)
  })

  // ── State transitions ────────────────────────────────────────────────────

  it('sets semanticIds and isEnhanced=true after successful fetch', async () => {
    const { result } = renderHook(() => useSemanticSearch('portrait photo', null, false))
    await act(async () => { vi.advanceTimersByTime(1000) })
    await act(async () => {})
    expect(result.current.semanticIds).toEqual(['id-1', 'id-2'])
    expect(result.current.isEnhanced).toBe(true)
    expect(result.current.isSearching).toBe(false)
  })

  it('resets state when query becomes too short', async () => {
    const { result, rerender } = renderHook(
      ({ q }) => useSemanticSearch(q, null, false),
      { initialProps: { q: 'portrait' } }
    )
    // Get some semantic results first
    await act(async () => { vi.advanceTimersByTime(1000) })
    await act(async () => {})
    expect(result.current.isEnhanced).toBe(true)

    // Clear the query
    rerender({ q: 'p' })
    await act(async () => {})
    expect(result.current.semanticIds).toEqual([])
    expect(result.current.isEnhanced).toBe(false)
    expect(result.current.isSearching).toBe(false)
  })

  // ── forceSearch ──────────────────────────────────────────────────────────

  it('forceSearch triggers immediate fetch without waiting for debounce', async () => {
    const { result } = renderHook(() => useSemanticSearch('portrait photo', null, false))
    // Advance only 200ms — well before the 1000ms debounce
    await act(async () => { vi.advanceTimersByTime(200) })
    expect(mockFetch).not.toHaveBeenCalled()

    await act(async () => { result.current.forceSearch() })
    await act(async () => {})
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  // ── Debounce cancellation ────────────────────────────────────────────────

  it('cancels pending debounce timer when query changes', async () => {
    const { rerender } = renderHook(
      ({ q }) => useSemanticSearch(q, null, false),
      { initialProps: { q: 'portrait' } }
    )
    await act(async () => { vi.advanceTimersByTime(500) })
    rerender({ q: 'portrait photo' })
    await act(async () => { vi.advanceTimersByTime(500) })
    // Only 500ms since last change — should not have called fetch yet
    expect(mockFetch).not.toHaveBeenCalled()

    await act(async () => { vi.advanceTimersByTime(600) })
    await act(async () => {})
    // Now 1100ms since last change — fetch should have fired once
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  // ── Error handling / silent fallback ────────────────────────────────────

  it('silently falls back to empty results when fetch returns non-ok', async () => {
    mockFetch.mockImplementation(() => makeErrorResponse())
    const { result } = renderHook(() => useSemanticSearch('portrait photo', null, false))
    await act(async () => { vi.advanceTimersByTime(1000) })
    await act(async () => {})
    expect(result.current.semanticIds).toEqual([])
    expect(result.current.isEnhanced).toBe(false)
    expect(result.current.isSearching).toBe(false)
  })

  it('silently falls back when fetch rejects (network error)', async () => {
    mockFetch.mockImplementation(() => Promise.reject(new Error('Network error')))
    const { result } = renderHook(() => useSemanticSearch('portrait photo', null, false))
    await act(async () => { vi.advanceTimersByTime(1000) })
    await act(async () => {})
    expect(result.current.semanticIds).toEqual([])
    expect(result.current.isSearching).toBe(false)
  })
})

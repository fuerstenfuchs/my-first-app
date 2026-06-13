'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export function useSemanticSearch(
  query: string,
  activeTag: string | null,
  favoritesOnly: boolean,
) {
  const [semanticIds, setSemanticIds] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isEnhanced, setIsEnhanced] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (
    searchQuery: string,
    tag: string | null,
    favorites: boolean,
  ) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsSearching(true)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, activeTag: tag, favoritesOnly: favorites }),
        signal: controller.signal,
      })
      if (!res.ok) return
      const { ids } = await res.json() as { ids: string[] }
      setSemanticIds(ids)
      setIsEnhanced(ids.length > 0)
    } catch {
      // AbortError oder API nicht verfügbar — stiller Fallback auf Keyword-Ergebnisse
    } finally {
      if (!controller.signal.aborted) setIsSearching(false)
    }
  }, [])

  // Debounced auto-search
  useEffect(() => {
    const trimmed = query.trim()

    if (trimmed.length < 2) {
      abortRef.current?.abort()
      if (timerRef.current) clearTimeout(timerRef.current)
      setSemanticIds([])
      setIsEnhanced(false)
      setIsSearching(false)
      return
    }

    setIsEnhanced(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => runSearch(trimmed, activeTag, favoritesOnly), 1000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query, activeTag, favoritesOnly, runSearch])

  // Enter-Taste: sofortige semantische Suche
  const forceSearch = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const trimmed = query.trim()
    if (trimmed.length >= 2) runSearch(trimmed, activeTag, favoritesOnly)
  }, [query, activeTag, favoritesOnly, runSearch])

  return { semanticIds, isSearching, isEnhanced, forceSearch }
}

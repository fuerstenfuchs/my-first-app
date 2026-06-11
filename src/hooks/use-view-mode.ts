'use client'

import { useState, useEffect } from 'react'

type ViewMode = 'grid' | 'list'
const STORAGE_KEY = 'promptdb-view-mode'

export function useViewMode() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'list' || saved === 'grid') setViewMode(saved)
  }, [])

  function setMode(mode: ViewMode) {
    setViewMode(mode)
    localStorage.setItem(STORAGE_KEY, mode)
  }

  return { viewMode, setMode }
}

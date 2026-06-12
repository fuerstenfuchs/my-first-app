'use client'

import { useState, useEffect } from 'react'

export function useQuickCapture() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isOpen) return
      if (e.key !== 'q' && e.key !== 'Q') return
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return
      e.preventDefault()
      setIsOpen(true)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return {
    isOpen,
    open: () => { if (!isOpen) setIsOpen(true) },
    close: () => setIsOpen(false),
  }
}

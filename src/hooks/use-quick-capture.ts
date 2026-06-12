'use client'

import { useState, useEffect } from 'react'
import type { SharePayload } from '@/components/prompts/quick-capture-modal'

export function useQuickCapture() {
  const [isOpen, setIsOpen] = useState(false)
  const [initialValues, setInitialValues] = useState<SharePayload | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isOpen) return
      if (e.key !== 'q' && e.key !== 'Q') return
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.getAttribute?.('contenteditable') === 'true'
      ) return
      e.preventDefault()
      setInitialValues(null)
      setIsOpen(true)
    }

    function handleOpenShare(e: Event) {
      const payload = (e as CustomEvent<SharePayload>).detail
      setInitialValues(payload)
      setIsOpen(true)
    }

    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('quick-capture:open-share', handleOpenShare)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('quick-capture:open-share', handleOpenShare)
    }
  }, [isOpen])

  return {
    isOpen,
    initialValues,
    open: () => { if (!isOpen) { setInitialValues(null); setIsOpen(true) } },
    close: () => { setIsOpen(false); setInitialValues(null) },
  }
}

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
      // Auch in Auswahllisten und offenen Dialogen nicht auslösen: Ein Radix-
      // SelectTrigger ist ein <button>, und das Tippen von „q" springt dort zum
      // Eintrag — Quick Capture würde sich zusätzlich über den offenen Dialog
      // legen. Zwei gestapelte Radix-Dialoge lassen leicht pointer-events am
      // body hängen.
      if (target.closest?.('[role="combobox"], [role="listbox"], [role="dialog"]')) return
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

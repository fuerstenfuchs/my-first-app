'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface QuickCaptureFABProps {
  onOpen: () => void
}

export function QuickCaptureFAB({ onOpen }: QuickCaptureFABProps) {
  return (
    <Button
      onClick={onOpen}
      size="icon"
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
      aria-label="Quick Capture öffnen (Q)"
    >
      <Plus className="h-6 w-6" />
    </Button>
  )
}

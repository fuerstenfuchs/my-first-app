'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { PromptMedia } from '@/hooks/use-prompt-media'
import { cn } from '@/lib/utils'

interface MediaGalleryProps {
  items: PromptMedia[]
  initialIndex: number
  onClose: () => void
}

export function MediaGallery({ items, initialIndex, onClose }: MediaGalleryProps) {
  const [current, setCurrent] = useState(initialIndex)
  const touchStartX = useRef<number | null>(null)

  function prev() {
    setCurrent(i => (i - 1 + items.length) % items.length)
  }

  function next() {
    setCurrent(i => (i + 1) % items.length)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev()
    touchStartX.current = null
  }

  const item = items[current]
  if (!item) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex flex-col"
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-sm text-white/50">
          {current + 1} / {items.length}
        </span>
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Schließen</span>
        </button>
      </div>

      {/* Main display */}
      <div className="flex-1 flex items-center justify-center relative min-h-0 px-12">
        {items.length > 1 && (
          <button
            onClick={e => { e.stopPropagation(); prev() }}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10 z-10"
          >
            <ChevronLeft className="h-7 w-7" />
            <span className="sr-only">Vorheriges</span>
          </button>
        )}

        <div className="w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
          {item.type === 'video' ? (
            <video
              key={item.id}
              src={item.url}
              controls
              muted
              className="max-w-full max-h-full rounded-lg"
              style={{ maxHeight: 'calc(100vh - 180px)' }}
            />
          ) : (
            <img
              key={item.id}
              src={item.url}
              alt=""
              className="max-w-full max-h-full object-contain rounded-lg"
              style={{ maxHeight: 'calc(100vh - 180px)' }}
            />
          )}
        </div>

        {items.length > 1 && (
          <button
            onClick={e => { e.stopPropagation(); next() }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10 z-10"
          >
            <ChevronRight className="h-7 w-7" />
            <span className="sr-only">Nächstes</span>
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      {items.length > 1 && (
        <div className="shrink-0 px-4 py-3">
          <div className="flex gap-2 overflow-x-auto justify-center">
            {items.map((m, idx) => (
              <button
                key={m.id}
                onClick={e => { e.stopPropagation(); setCurrent(idx) }}
                className={cn(
                  'shrink-0 w-14 h-10 rounded overflow-hidden border-2 transition-all',
                  idx === current ? 'border-violet-400 opacity-100' : 'border-transparent opacity-40 hover:opacity-70',
                )}
              >
                {m.type === 'video' ? (
                  <div className="w-full h-full bg-white/10 flex items-center justify-center text-white/60 text-[10px]">▶</div>
                ) : (
                  <img src={m.url} alt="" className="w-full h-full object-cover" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}

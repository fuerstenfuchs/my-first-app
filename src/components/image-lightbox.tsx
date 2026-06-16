'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X, ZoomIn } from 'lucide-react'

export interface LightboxImage {
  url: string
  id?: string
}

interface Props {
  images: LightboxImage[]
  initialIndex: number
  onClose: () => void
}

export function ImageLightbox({ images, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const [zoom, setZoom]   = useState(1)
  const [pan, setPan]     = useState({ x: 0, y: 0 })
  const panStart          = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)

  const image = images[index]

  const prev = () => { setIndex(i => (i - 1 + images.length) % images.length); setZoom(1); setPan({ x: 0, y: 0 }) }
  const next = () => { setIndex(i => (i + 1) % images.length); setZoom(1); setPan({ x: 0, y: 0 }) }

  function changeZoom(delta: number) {
    setZoom(z => {
      const next = Math.min(4, Math.max(0.25, parseFloat((z + delta).toFixed(2))))
      if (next <= 1) setPan({ x: 0, y: 0 })
      return next
    })
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')                            { onClose(); return }
      if (e.key === 'ArrowLeft'  && images.length > 1)   prev()
      if (e.key === 'ArrowRight' && images.length > 1)   next()
      if (e.key === '+' || e.key === '=')                changeZoom(+0.25)
      if (e.key === '-')                                 changeZoom(-0.25)
      if (e.key === '0')                                 { setZoom(1); setPan({ x: 0, y: 0 }) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    changeZoom(e.deltaY < 0 ? +0.25 : -0.25)
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (zoom <= 1) return
    e.currentTarget.setPointerCapture(e.pointerId)
    panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!panStart.current) return
    setPan({
      x: panStart.current.px + (e.clientX - panStart.current.mx),
      y: panStart.current.py + (e.clientY - panStart.current.my),
    })
  }

  function onPointerUp() { panStart.current = null }

  const zoomPct = Math.round(zoom * 100)

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onWheel={onWheel}>

      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-black/60 border-b border-white/10">

        <div className="flex items-center gap-1 min-w-[100px]">
          {images.length > 1 && (
            <>
              <button type="button" onClick={prev} className="p-1.5 rounded hover:bg-white/10 text-zinc-300 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-zinc-400 tabular-nums px-1">{index + 1} / {images.length}</span>
              <button type="button" onClick={next} className="p-1.5 rounded hover:bg-white/10 text-zinc-300 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={() => changeZoom(-0.25)} disabled={zoom <= 0.25}
            className="p-1.5 rounded hover:bg-white/10 text-zinc-300 disabled:opacity-30 transition-colors" title="Verkleinern (−)">
            <Minus className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
            className="text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded px-2 py-1 min-w-[52px] text-center tabular-nums transition-colors" title="Zurücksetzen (0)">
            {zoomPct}%
          </button>
          <button type="button" onClick={() => changeZoom(+0.25)} disabled={zoom >= 4}
            className="p-1.5 rounded hover:bg-white/10 text-zinc-300 disabled:opacity-30 transition-colors" title="Vergrößern (+)">
            <Plus className="h-4 w-4" />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button type="button" onClick={() => changeZoom(4 - zoom)}
            className="p-1.5 rounded hover:bg-white/10 text-zinc-300 transition-colors" title="400%">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
            className="p-1.5 rounded hover:bg-white/10 text-zinc-300 transition-colors" title="Zoom zurücksetzen">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center min-w-[100px] justify-end">
          <button type="button" onClick={onClose}
            className="p-1.5 rounded hover:bg-white/10 text-zinc-300 hover:text-white transition-colors" title="Schließen (Esc)">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        className="flex-1 overflow-hidden relative select-none"
        style={{ cursor: zoom > 1 ? (panStart.current ? 'grabbing' : 'grab') : 'zoom-in', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={image.url}
            src={image.url}
            alt=""
            draggable={false}
            style={{
              maxWidth: '90vw',
              maxHeight: 'calc(100vh - 112px)',
              objectFit: 'contain',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />
        </div>
      </div>

      {/* Footer hint */}
      <div className="shrink-0 py-1.5 text-center text-[11px] text-zinc-600">
        {images.length > 1
          ? '← → Navigieren · Scroll oder +/− zum Zoomen · Esc zum Schließen'
          : 'Scroll oder +/− zum Zoomen · Esc zum Schließen'}
      </div>
    </div>,
    document.body,
  )
}

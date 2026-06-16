import { useRef, useState, useEffect } from 'react'

interface CropRect { x: number; y: number; w: number; h: number }

interface Props {
  imageUrl: string
  onApply: (croppedDataUrl: string) => void
  onCancel: () => void
}

export function CropTool({ imageUrl, onApply, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef       = useRef<HTMLImageElement>(null)
  const dragStart    = useRef<{ x: number; y: number } | null>(null)

  const [dataUrl, setDataUrl]     = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [rect, setRect]           = useState<CropRect | null>(null)

  // Pre-fetch image as data URL so canvas.toDataURL() is not CORS-tainted on extraction
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    setDataUrl(null)
    setRect(null)

    async function load() {
      try {
        let src = imageUrl
        if (!imageUrl.startsWith('data:')) {
          const res = await fetch(imageUrl)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const blob = await res.blob()
          src = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror   = reject
            reader.readAsDataURL(blob)
          })
        }
        if (!cancelled) setDataUrl(src)
      } catch {
        if (!cancelled) { setLoadError(true); setLoading(false) }
      }
    }
    load()
    return () => { cancelled = true }
  }, [imageUrl])

  function getPos(e: React.PointerEvent<HTMLDivElement>) {
    const b = containerRef.current!.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(e.clientX - b.left, b.width)),
      y: Math.max(0, Math.min(e.clientY - b.top,  b.height)),
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStart.current = getPos(e)
    setRect(null)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return
    const p = getPos(e)
    const s = dragStart.current
    setRect({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    })
  }

  function onPointerUp() {
    dragStart.current = null
  }

  function handleApply() {
    const img = imgRef.current
    if (!img || !rect || rect.w < 5 || rect.h < 5) return
    const sx  = img.naturalWidth  / img.clientWidth
    const sy  = img.naturalHeight / img.clientHeight
    const out = document.createElement('canvas')
    out.width  = Math.max(1, Math.round(rect.w * sx))
    out.height = Math.max(1, Math.round(rect.h * sy))
    out.getContext('2d')!.drawImage(
      img,
      rect.x * sx, rect.y * sy, rect.w * sx, rect.h * sy,
      0, 0, out.width, out.height
    )
    onApply(out.toDataURL('image/jpeg', 0.92))
  }

  const canApply = !!rect && rect.w >= 5 && rect.h >= 5

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-black">

      {/* Image area */}
      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        {loading && !loadError && (
          <span className="w-5 h-5 rounded-full border-2 border-zinc-600 border-t-transparent animate-spin" />
        )}
        {loadError && (
          <p className="text-xs text-zinc-500 px-4 text-center">Bild konnte nicht geladen werden</p>
        )}

        {dataUrl && (
          /* containerRef wraps exactly the image — no object-contain letterboxing */
          <div className="relative shrink-0" ref={containerRef}>
            <img
              ref={imgRef}
              src={dataUrl}
              alt=""
              className="block"
              style={{ maxWidth: '360px', maxHeight: '420px' }}
              onLoad={() => setLoading(false)}
              draggable={false}
            />

            {/* Drag overlay — React pointer events, setPointerCapture for reliable drag */}
            <div
              className="absolute inset-0 cursor-crosshair"
              style={{ touchAction: 'none', userSelect: 'none' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {rect && rect.w > 2 && rect.h > 2 && (
                <>
                  {/* 4-part dark overlay around selection */}
                  <div className="absolute inset-x-0 top-0 bg-black/55 pointer-events-none"
                    style={{ height: rect.y }} />
                  <div className="absolute inset-x-0 bg-black/55 pointer-events-none"
                    style={{ top: rect.y + rect.h, bottom: 0 }} />
                  <div className="absolute bg-black/55 pointer-events-none"
                    style={{ top: rect.y, left: 0, width: rect.x, height: rect.h }} />
                  <div className="absolute bg-black/55 pointer-events-none"
                    style={{ top: rect.y, left: rect.x + rect.w, right: 0, height: rect.h }} />
                  {/* Selection border */}
                  <div className="absolute border border-white/90 pointer-events-none"
                    style={{ top: rect.y, left: rect.x, width: rect.w, height: rect.h }} />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hint */}
      {!loadError && !loading && (
        <p className="shrink-0 text-center text-[10px] text-zinc-600 py-1">
          {rect ? 'Bereich ausgewählt — Anwenden oder neu ziehen' : 'Bereich durch Ziehen auswählen'}
        </p>
      )}

      {/* Buttons */}
      <div className="shrink-0 flex items-center justify-between px-2 py-1.5 border-t border-zinc-700 gap-2">
        <div className="flex gap-1.5">
          <button type="button" onClick={onCancel}
            className="px-2.5 py-1 rounded text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors">
            Abbrechen
          </button>
          {rect && (
            <button type="button" onClick={() => setRect(null)}
              className="px-2.5 py-1 rounded text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors">
              ↺ Zurücksetzen
            </button>
          )}
        </div>
        <button type="button" onClick={handleApply} disabled={!canApply}
          className="px-3 py-1 rounded bg-white text-black text-[11px] font-semibold disabled:opacity-30 hover:bg-zinc-200 transition-colors">
          ✓ Anwenden
        </button>
      </div>
    </div>
  )
}

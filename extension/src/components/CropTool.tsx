import { useRef, useState, useEffect, useCallback } from 'react'

interface CropRect { x: number; y: number; w: number; h: number }

interface Props {
  imageUrl: string
  onApply: (croppedDataUrl: string) => void
  onCancel: () => void
}

export function CropTool({ imageUrl, onApply, onCancel }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const imgRef      = useRef<HTMLImageElement | null>(null)
  const [rect, setRect]       = useState<CropRect | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const drawState = useCallback((r: CropRect | null) => {
    const canvas = canvasRef.current
    const img    = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    if (r && r.w > 2 && r.h > 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h)
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth   = 1.5
      ctx.setLineDash([5, 3])
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1)
      ctx.setLineDash([])
    }
  }, [])

  // Load image: pre-fetch as data URL to avoid canvas CORS taint
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    setRect(null)

    async function load() {
      try {
        let src = imageUrl
        if (!imageUrl.startsWith('data:')) {
          const res = await fetch(imageUrl)
          if (!res.ok) throw new Error('fetch failed')
          const blob = await res.blob()
          src = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror   = reject
            reader.readAsDataURL(blob)
          })
        }
        if (cancelled) return
        const img = new Image()
        img.onload = () => {
          if (cancelled) return
          imgRef.current = img
          const maxW = 360, maxH = 440
          const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
          const w = Math.max(1, Math.round(img.naturalWidth  * scale))
          const h = Math.max(1, Math.round(img.naturalHeight * scale))
          const canvas = canvasRef.current
          if (canvas) { canvas.width = w; canvas.height = h }
          drawState(null)
          setLoading(false)
        }
        img.onerror = () => { if (!cancelled) { setLoadError(true); setLoading(false) } }
        img.src = src
      } catch {
        if (!cancelled) { setLoadError(true); setLoading(false) }
      }
    }
    load()
    return () => { cancelled = true }
  }, [imageUrl, drawState])

  // Mouse events via native listeners for smooth canvas updates
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || loading) return

    let dragging = false
    let start    = { x: 0, y: 0 }
    let live: CropRect | null = null

    function getPos(e: MouseEvent) {
      const r  = canvas.getBoundingClientRect()
      const sx = canvas.width  / r.width
      const sy = canvas.height / r.height
      return {
        x: Math.max(0, Math.min((e.clientX - r.left) * sx, canvas.width)),
        y: Math.max(0, Math.min((e.clientY - r.top)  * sy, canvas.height)),
      }
    }

    function onDown(e: MouseEvent) {
      e.preventDefault()
      dragging = true
      start    = getPos(e)
      live     = null
      setRect(null)
      drawState(null)
    }

    function onMove(e: MouseEvent) {
      if (!dragging) return
      const p = getPos(e)
      live = {
        x: Math.min(start.x, p.x),
        y: Math.min(start.y, p.y),
        w: Math.abs(p.x - start.x),
        h: Math.abs(p.y - start.y),
      }
      drawState(live)
      setRect({ ...live })
    }

    function onUp() { dragging = false }

    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove',  onMove)
    window.addEventListener('mouseup',    onUp)
    return () => {
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove',  onMove)
      window.removeEventListener('mouseup',    onUp)
    }
  }, [loading, drawState])

  function handleApply() {
    const canvas = canvasRef.current
    const img    = imgRef.current
    if (!canvas || !img || !rect || rect.w < 5 || rect.h < 5) return
    const sx   = img.naturalWidth  / canvas.width
    const sy   = img.naturalHeight / canvas.height
    const out  = document.createElement('canvas')
    out.width  = Math.max(1, Math.round(rect.w * sx))
    out.height = Math.max(1, Math.round(rect.h * sy))
    const ctx  = out.getContext('2d')!
    ctx.drawImage(img, rect.x * sx, rect.y * sy, rect.w * sx, rect.h * sy, 0, 0, out.width, out.height)
    onApply(out.toDataURL('image/jpeg', 0.92))
  }

  function handleReset() {
    setRect(null)
    drawState(null)
  }

  const canApply = !!rect && rect.w >= 5 && rect.h >= 5

  return (
    <div className="flex flex-col bg-black">
      <div className="relative flex items-center justify-center" style={{ minHeight: '80px' }}>
        {loading && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-5 h-5 rounded-full border-2 border-zinc-600 border-t-transparent animate-spin" />
          </div>
        )}
        {loadError && (
          <p className="text-xs text-zinc-500 py-6">Bild konnte nicht geladen werden</p>
        )}
        <canvas
          ref={canvasRef}
          className="block select-none cursor-crosshair"
          style={{ maxWidth: '100%', opacity: loading ? 0 : 1 }}
        />
      </div>

      {!loadError && (
        <div className="text-center py-0.5">
          <p className="text-[10px] text-zinc-600">
            {loading ? '' : rect ? 'Bereich ausgewählt — Anwenden oder neu ziehen' : 'Bereich durch Ziehen auswählen'}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between px-2 py-1.5 border-t border-zinc-700 gap-2">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-2.5 py-1 rounded text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            Abbrechen
          </button>
          {rect && (
            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1 rounded text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              ↺ Zurücksetzen
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleApply}
          disabled={!canApply}
          className="px-3 py-1 rounded bg-white text-black text-[11px] font-semibold disabled:opacity-30 hover:bg-zinc-200 transition-colors"
        >
          ✓ Anwenden
        </button>
      </div>
    </div>
  )
}

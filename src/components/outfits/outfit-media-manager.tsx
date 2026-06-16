'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext, closestCenter, type DragEndEvent,
  PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, rectSortingStrategy,
  sortableKeyboardCoordinates, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronLeft, ChevronRight, Crown, GripVertical, Link2, Minus, Plus, RotateCcw, Trash2, Upload, X, ZoomIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { OutfitImage } from '@/hooks/use-outfits'

// ─── Lightbox ────────────────────────────────────────────────────────────────

interface LightboxProps {
  images: OutfitImage[]
  initialIndex: number
  onClose: () => void
}

function Lightbox({ images, initialIndex, onClose }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const [zoom, setZoom]   = useState(1)
  const [pan, setPan]     = useState({ x: 0, y: 0 })
  const panStart          = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)
  const isPanning         = panStart.current !== null

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
      if (e.key === 'Escape')                           { onClose(); return }
      if (e.key === 'ArrowLeft'  && images.length > 1)  prev()
      if (e.key === 'ArrowRight' && images.length > 1)  next()
      if (e.key === '+' || e.key === '=')               changeZoom(+0.25)
      if (e.key === '-')                                 changeZoom(-0.25)
      if (e.key === '0')                                 { setZoom(1); setPan({ x: 0, y: 0 }) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })                                          // no deps — always reads latest state via closure

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
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      onWheel={onWheel}
    >
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-black/60 border-b border-white/10">
        {/* Navigation */}
        <div className="flex items-center gap-1 min-w-[100px]">
          {images.length > 1 && (
            <>
              <button
                type="button" onClick={prev}
                className="p-1.5 rounded hover:bg-white/10 text-zinc-300 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-zinc-400 tabular-nums px-1">
                {index + 1} / {images.length}
              </span>
              <button
                type="button" onClick={next}
                className="p-1.5 rounded hover:bg-white/10 text-zinc-300 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            type="button" onClick={() => changeZoom(-0.25)} disabled={zoom <= 0.25}
            className="p-1.5 rounded hover:bg-white/10 text-zinc-300 disabled:opacity-30 transition-colors"
            title="Verkleinern (−)"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
            className="text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded px-2 py-1 min-w-[52px] text-center tabular-nums transition-colors"
            title="Zurücksetzen (0)"
          >
            {zoomPct}%
          </button>
          <button
            type="button" onClick={() => changeZoom(+0.25)} disabled={zoom >= 4}
            className="p-1.5 rounded hover:bg-white/10 text-zinc-300 disabled:opacity-30 transition-colors"
            title="Vergrößern (+)"
          >
            <Plus className="h-4 w-4" />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button
            type="button" onClick={() => changeZoom(4 - zoom)}
            className="p-1.5 rounded hover:bg-white/10 text-zinc-300 transition-colors"
            title="400% — maximaler Zoom"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
            className="p-1.5 rounded hover:bg-white/10 text-zinc-300 transition-colors"
            title="Zoom zurücksetzen"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Close */}
        <div className="flex items-center min-w-[100px] justify-end">
          <button
            type="button" onClick={onClose}
            className="p-1.5 rounded hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
            title="Schließen (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        className="flex-1 overflow-hidden relative select-none"
        style={{
          cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in',
          touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(e) => { if (zoom <= 1 && e.target === e.currentTarget) onClose() }}
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
        {zoom > 1
          ? 'Ziehen zum Verschieben · Scroll oder +/− zum Zoomen · Esc zum Schließen'
          : images.length > 1
            ? '← → Navigieren · Scroll oder +/− zum Zoomen · Esc zum Schließen'
            : 'Scroll oder +/− zum Zoomen · Esc zum Schließen'}
      </div>
    </div>,
    document.body,
  )
}

// ─── SortableImage ────────────────────────────────────────────────────────────

interface SortableImageProps {
  image: OutfitImage
  isOutfitCover: boolean
  onDelete: () => void
  onSetOutfitCover?: () => void
  onOpen: () => void
}

function SortableImage({ image, isOutfitCover, onDelete, onSetOutfitCover, onOpen }: SortableImageProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} {...attributes} className={cn('relative rounded-md overflow-visible', isDragging && 'opacity-50 z-50')}>
      <div className="relative aspect-video rounded-md overflow-hidden border border-white/10 bg-black group">
        <img src={image.url} alt="" className="w-full h-full object-cover" />

        {/* Drag handle */}
        <div
          {...listeners}
          className="absolute top-1 left-1 cursor-grab active:cursor-grabbing p-1 bg-black/50 rounded z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-3 w-3 text-white" />
        </div>

        {/* Open/zoom button */}
        <button
          type="button"
          onClick={onOpen}
          title="Vergrößern"
          className="absolute inset-0 w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20"
        >
          <ZoomIn className="h-5 w-5 text-white drop-shadow-lg" />
        </button>

        {onSetOutfitCover && !isOutfitCover && (
          <button
            type="button"
            onClick={onSetOutfitCover}
            title="Als Outfit-Titelbild setzen"
            className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-amber-500 rounded z-10 opacity-30 group-hover:opacity-100 transition-all"
          >
            <Crown className="h-3 w-3 text-white" />
          </button>
        )}

        {isOutfitCover && (
          <div className="absolute top-1 right-1 flex items-center gap-0.5 text-[10px] bg-amber-500 text-black px-1.5 py-0.5 rounded font-semibold z-10">
            <Crown className="h-2.5 w-2.5" />
            Titelbild
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 mt-1">
        {isOutfitCover ? (
          <span className="text-[11px] text-amber-400 flex-1 truncate flex items-center gap-0.5">
            <Crown className="h-2.5 w-2.5" /> Titelbild
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <button
          type="button"
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive transition-colors ml-auto shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── OutfitMediaManager ───────────────────────────────────────────────────────

interface Props {
  variantId: string
  images: OutfitImage[]
  uploading: { id: string; file: File; status: string }[]
  outfitCoverUrl?: string | null
  onUpload: (files: File[]) => void
  onAddUrl: (url: string) => void
  onDelete: (imageId: string, storagePath: string | null) => void
  onReorder: (orderedIds: string[]) => void
  onSetOutfitCover?: (url: string) => void
}

export function OutfitMediaManager({
  variantId, images, uploading, outfitCoverUrl,
  onUpload, onAddUrl, onDelete, onReorder, onSetOutfitCover,
}: Props) {
  const fileRef             = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [urlInput, setUrlInput]     = useState('')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (arr.length > 0) onUpload(arr)
  }, [onUpload])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  function handleUrlAdd() {
    const url = urlInput.trim()
    if (!url) return
    onAddUrl(url)
    setUrlInput('')
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = images.findIndex(i => i.id === active.id)
    const newIndex = images.findIndex(i => i.id === over.id)
    const reordered = arrayMove(images, oldIndex, newIndex)
    onReorder(reordered.map(i => i.id))
  }

  const hasActiveUploads = uploading.some(u => u.status === 'uploading')

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'rounded-lg border-2 border-dashed transition-colors p-4',
          isDragOver ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 hover:border-white/20',
        )}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <Tabs defaultValue="upload">
          <TabsList className="h-7 mb-3">
            <TabsTrigger value="upload" className="text-xs gap-1.5 h-5 px-2">
              <Upload className="h-3 w-3" />
              Hochladen
            </TabsTrigger>
            <TabsTrigger value="url" className="text-xs gap-1.5 h-5 px-2">
              <Link2 className="h-3 w-3" />
              URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-0 space-y-2">
            <div className="flex items-center gap-2">
              <Button
                type="button" variant="outline" size="sm"
                className="gap-2 h-8 text-xs"
                disabled={hasActiveUploads}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                {hasActiveUploads ? 'Lädt hoch…' : 'Bilder auswählen'}
              </Button>
              <span className="text-xs text-muted-foreground">oder hierher ziehen</span>
            </div>
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP, GIF · max. 20 MB</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={e => { handleFiles(e.target.files!); e.target.value = '' }}
            />
          </TabsContent>

          <TabsContent value="url" className="mt-0">
            <div className="flex gap-2">
              <Input
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleUrlAdd())}
                placeholder="https://example.com/bild.jpg"
                className="text-xs h-8"
              />
              <Button
                type="button" variant="outline" size="sm"
                className="h-8 text-xs shrink-0"
                onClick={handleUrlAdd}
                disabled={!urlInput.trim()}
              >
                Hinzufügen
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {uploading.length > 0 && (
        <div className="space-y-1">
          {uploading.map(u => (
            <div key={u.id} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground truncate flex-1 min-w-0">{u.file.name}</span>
              {u.status === 'uploading' && <span className="text-muted-foreground shrink-0 animate-pulse">Lädt…</span>}
              {u.status === 'done'      && <span className="text-green-400 shrink-0">✓</span>}
              {u.status === 'error'     && <span className="text-destructive shrink-0">Fehler</span>}
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images.map(i => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2">
              {images.map((img, idx) => (
                <SortableImage
                  key={img.id}
                  image={img}
                  isOutfitCover={!!outfitCoverUrl && img.url === outfitCoverUrl}
                  onDelete={() => onDelete(img.id, img.storage_path)}
                  onSetOutfitCover={onSetOutfitCover ? () => onSetOutfitCover(img.url) : undefined}
                  onOpen={() => setLightboxIndex(idx)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {images.length === 0 && !hasActiveUploads && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Noch keine Bilder — lade Referenzbilder hoch.
        </p>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}

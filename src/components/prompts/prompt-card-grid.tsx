'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, MoreVertical, Pencil, Trash2, FolderPlus, FolderMinus, X, Heart, Images, Video, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { tagColorClass } from '@/lib/tag-colors'
import { StarRating } from '@/components/prompts/star-rating'
import { useCardCarousel } from '@/hooks/use-card-carousel'
import type { Prompt } from '@/hooks/use-prompts'

const GRADIENTS = [
  'from-violet-950 via-indigo-900 to-blue-950',
  'from-blue-950 via-cyan-900 to-teal-950',
  'from-emerald-950 via-green-900 to-teal-950',
  'from-orange-950 via-red-900 to-rose-950',
  'from-pink-950 via-rose-900 to-fuchsia-950',
  'from-amber-950 via-orange-900 to-yellow-950',
  'from-purple-950 via-fuchsia-900 to-pink-950',
  'from-slate-900 via-zinc-800 to-gray-950',
]

function gradientForTitle(title: string): string {
  let hash = 0
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) & 0x7fffffff
  return GRADIENTS[hash % GRADIENTS.length]
}

export const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
}

interface PromptCardGridProps {
  prompt: Prompt
  onClick: () => void
  onCopy: () => void
  onEdit: () => void
  onDelete: () => void
  onAddToCollection?: () => void
  onRemoveFromCollection?: () => void
  onToggleFavorite: () => void
  onSetRating: (rating: number | null) => void
  dragHandleSlot?: React.ReactNode
}

export function PromptCardGrid({
  prompt,
  onClick,
  onCopy,
  onEdit,
  onDelete,
  onAddToCollection,
  onRemoveFromCollection,
  onToggleFavorite,
  onSetRating,
  dragHandleSlot,
}: PromptCardGridProps) {
  const [imgError, setImgError] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lbZoom, setLbZoom] = useState(1)
  const [lbPan, setLbPan] = useState({ x: 0, y: 0 })
  const [lbDragging, setLbDragging] = useState(false)
  const lbDragStartRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)
  const lbOverlayRef = useRef<HTMLDivElement>(null)
  const [mediaVisible, setMediaVisible] = useState(false)

  const { currentIndex, isCarouselActive, onMouseEnter: carouselEnter, onMouseLeave: carouselLeave } = useCardCarousel(prompt.preview_media)

  const gradient = gradientForTitle(prompt.title)
  const showGradient = !prompt.cover_image_url || imgError
  const visibleTags = prompt.tags.slice(0, 3)
  const badgeTag = prompt.tags[0]

  const mediaCount = prompt.preview_media.length
  const firstMediaType = prompt.preview_media[0]?.type
  const dotCount = Math.min(mediaCount, 5)

  // Non-passive wheel listener for zoom (React's onWheel is passive by default)
  useEffect(() => {
    if (!lightboxOpen) return
    const el = lbOverlayRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setLbZoom(z => Math.min(4, Math.max(0.25, z - e.deltaY * 0.001)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [lightboxOpen])

  function closeLightbox() {
    setLightboxOpen(false)
    setLbZoom(1)
    setLbPan({ x: 0, y: 0 })
  }

  function lbChangeZoom(delta: number) {
    setLbZoom(z => {
      const next = Math.min(4, Math.max(0.25, z + delta))
      if (next <= 1) setLbPan({ x: 0, y: 0 })
      return next
    })
  }

  function lbMouseDown(e: React.MouseEvent) {
    if (lbZoom <= 1) return
    e.preventDefault()
    setLbDragging(true)
    lbDragStartRef.current = { mx: e.clientX, my: e.clientY, px: lbPan.x, py: lbPan.y }
  }

  function lbMouseMove(e: React.MouseEvent) {
    if (!lbDragStartRef.current) return
    setLbPan({
      x: lbDragStartRef.current.px + (e.clientX - lbDragStartRef.current.mx) / lbZoom,
      y: lbDragStartRef.current.py + (e.clientY - lbDragStartRef.current.my) / lbZoom,
    })
  }

  function lbMouseUp() {
    setLbDragging(false)
    lbDragStartRef.current = null
  }

  function handleMouseEnter() {
    setMediaVisible(true)
    carouselEnter()
  }

  function handleMouseLeave() {
    carouselLeave()
  }

  function handleCardClick() {
    carouselLeave()
    onClick()
  }

  return (
    <>
      <motion.div
        className="group relative overflow-hidden rounded-xl cursor-pointer"
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
        onClick={handleCardClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        variants={cardVariants}
        whileHover={{
          y: -3,
          boxShadow: '0 0 0 1px rgba(139,92,246,0.7), 0 0 24px rgba(139,92,246,0.12), 0 8px 32px rgba(0,0,0,0.5)',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        {/* 16:9 image zone */}
        <div className="relative aspect-video overflow-hidden">

          {/* Base layer: cover image or gradient — always visible */}
          {showGradient ? (
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
          ) : (
            <img
              src={prompt.cover_image_url!}
              alt=""
              className="absolute inset-0 w-full h-full object-contain bg-black/60 cursor-zoom-in"
              onError={() => setImgError(true)}
              onClick={e => { e.stopPropagation(); setLightboxOpen(true) }}
            />
          )}

          {/* Carousel overlay layers — rendered after first hover, pointer-events-none */}
          {mediaVisible && prompt.preview_media.map((media, i) => {
            const isActive = isCarouselActive && i === currentIndex
            return (
              <div
                key={`overlay-${i}`}
                className="absolute inset-0 transition-opacity duration-[400ms] ease-in-out pointer-events-none"
                style={{ opacity: isActive ? 1 : 0 }}
                aria-hidden
              >
                {media.type === 'image' ? (
                  <img
                    src={media.url}
                    alt=""
                    className="w-full h-full object-contain bg-black/60"
                    loading="lazy"
                  />
                ) : isActive ? (
                  <video
                    src={media.url}
                    className="w-full h-full object-contain bg-black"
                    muted
                    loop
                    autoPlay
                    playsInline
                  />
                ) : null}
              </div>
            )
          })}

          {/* Dot indicators — shown when carousel active and > 1 medium */}
          {isCarouselActive && mediaCount > 1 && (
            <div className="absolute bottom-2 inset-x-0 z-10 flex items-center justify-center gap-1 pointer-events-none">
              {Array.from({ length: dotCount }, (_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-200 ${
                    i === currentIndex % dotCount
                      ? 'w-2 h-2 bg-white shadow-sm'
                      : 'w-1.5 h-1.5 bg-white/40'
                  }`}
                />
              ))}
              {mediaCount > 5 && (
                <span className="text-white/50 text-[8px] ml-0.5 leading-none">…</span>
              )}
            </div>
          )}

          {/* Bottom-left: drag handle (when in sortable context) */}
          {dragHandleSlot && (
            <div className="absolute bottom-2 left-2 z-10">
              {dragHandleSlot}
            </div>
          )}

          {/* Top-left: media badge + monospace category badge */}
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 pointer-events-none flex-wrap max-w-[calc(100%-4rem)]">
            {firstMediaType === 'video' ? (
              <span className="inline-flex items-center bg-black/55 backdrop-blur-sm text-white/75 px-1.5 py-0.5 rounded">
                <Video className="h-3 w-3" />
              </span>
            ) : mediaCount > 1 ? (
              <span className="inline-flex items-center gap-0.5 bg-black/55 backdrop-blur-sm text-white/65 px-1.5 py-0.5 rounded font-mono text-[9px]">
                <Images className="h-3 w-3" />
                <span>{mediaCount}</span>
              </span>
            ) : null}
            {badgeTag && (
              <span className="font-mono text-[9px] uppercase tracking-widest bg-black/55 backdrop-blur-sm text-white/65 px-2 py-0.5 rounded">
                {badgeTag}
              </span>
            )}
          </div>

          {/* Top-right: favorite + context menu */}
          <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 bg-black/50 hover:bg-black/70 transition-opacity ${prompt.is_favorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              onClick={onToggleFavorite}
            >
              <Heart className={`h-4 w-4 transition-colors ${prompt.is_favorite ? 'fill-rose-500 text-rose-500' : 'text-white'}`} />
              <span className="sr-only">Favorit</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Menü</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Bearbeiten
                </DropdownMenuItem>
                {onAddToCollection && (
                  <DropdownMenuItem onClick={onAddToCollection}>
                    <FolderPlus className="mr-2 h-4 w-4" />
                    Zu Sammlung hinzufügen
                  </DropdownMenuItem>
                )}
                {onRemoveFromCollection && (
                  <DropdownMenuItem onClick={onRemoveFromCollection}>
                    <FolderMinus className="mr-2 h-4 w-4" />
                    Aus Sammlung entfernen
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

        </div>

        {/* Card body below image */}
        <div className="px-3 pt-2.5 pb-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm leading-snug line-clamp-2 flex-1">
              {prompt.title}
            </h3>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0 -mt-0.5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={e => { e.stopPropagation(); onCopy() }}
            >
              <Copy className="h-3 w-3" />
              <span className="sr-only">Kopieren</span>
            </Button>
          </div>
          {prompt.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{prompt.description}</p>
          )}
          {prompt.source_url && (
            <a
              href={prompt.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-violet-400 transition-colors mt-1"
              onClick={e => e.stopPropagation()}
              title="Quelle öffnen"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[140px]">
                {(() => { try { return new URL(prompt.source_url).hostname } catch { return prompt.source_url } })()}
              </span>
            </a>
          )}
          <div className="flex items-center justify-between gap-2 mt-2">
            {visibleTags.length > 0 ? (
              <div className="flex flex-wrap gap-1 min-w-0">
                {visibleTags.map(tag => (
                  <span
                    key={tag}
                    className={`text-[10px] px-1.5 py-0 rounded font-mono leading-5 ${tagColorClass(tag)}`}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            ) : <div />}
            <div onClick={e => e.stopPropagation()}>
              <StarRating value={prompt.rating} onChange={onSetRating} />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Lightbox — portal to avoid hover flicker */}
      {lightboxOpen && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            ref={lbOverlayRef}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={closeLightbox}
            onMouseMove={lbMouseMove}
            onMouseUp={lbMouseUp}
            onMouseLeave={lbMouseUp}
          >
            {/* Entry animation wrapper (framer-motion owns transform here) */}
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Zoom / pan wrapper (plain div — framer-motion must NOT own this transform) */}
              <div
                style={{
                  transform: `scale(${lbZoom}) translate(${lbPan.x}px, ${lbPan.y}px)`,
                  transformOrigin: 'center center',
                  transition: lbDragging ? 'none' : 'transform 0.12s ease',
                  cursor: lbZoom > 1 ? (lbDragging ? 'grabbing' : 'grab') : 'zoom-in',
                }}
                onMouseDown={lbMouseDown}
              >
                <img
                  src={prompt.cover_image_url!}
                  alt={prompt.title}
                  className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl select-none block"
                  draggable={false}
                />
              </div>
            </motion.div>

            {/* Close button */}
            <button
              className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
              onClick={closeLightbox}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Schließen</span>
            </button>

            {/* Zoom controls */}
            <div
              className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 rounded-full px-4 py-2 backdrop-blur-sm"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => lbChangeZoom(-0.25)}
                className="text-white/80 hover:text-white w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-lg leading-none"
              >−</button>
              <span className="text-white/70 text-sm w-12 text-center tabular-nums">
                {Math.round(lbZoom * 100)}%
              </span>
              <button
                onClick={() => lbChangeZoom(0.25)}
                className="text-white/80 hover:text-white w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-lg leading-none"
              >+</button>
              {lbZoom !== 1 && (
                <button
                  onClick={() => { setLbZoom(1); setLbPan({ x: 0, y: 0 }) }}
                  className="text-white/50 hover:text-white/80 text-xs ml-1 px-2 py-0.5 rounded hover:bg-white/10 transition-colors"
                >Reset</button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

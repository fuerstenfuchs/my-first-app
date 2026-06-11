'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, MoreVertical, Pencil, Trash2, FolderPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { tagColorClass } from '@/lib/tag-colors'
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
}

export function PromptCardGrid({
  prompt,
  onClick,
  onCopy,
  onEdit,
  onDelete,
  onAddToCollection,
}: PromptCardGridProps) {
  const [imgError, setImgError] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const gradient = gradientForTitle(prompt.title)
  const showGradient = !prompt.cover_image_url || imgError
  const visibleTags = prompt.tags.slice(0, 3)
  const badgeTag = prompt.tags[0]

  return (
    <>
      <motion.div
        className="group relative overflow-hidden rounded-xl cursor-pointer"
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
        onClick={onClick}
        variants={cardVariants}
        whileHover={{
          y: -3,
          boxShadow: '0 0 0 1px rgba(139,92,246,0.7), 0 0 24px rgba(139,92,246,0.12), 0 8px 32px rgba(0,0,0,0.5)',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        {/* 16:9 image + all overlays */}
        <div className="relative aspect-video overflow-hidden">

          {/* Background: image or gradient */}
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

          {/* Top-left: monospace category badge */}
          {badgeTag && (
            <div className="absolute top-2 left-2 z-10 pointer-events-none">
              <span className="font-mono text-[9px] uppercase tracking-widest bg-black/55 backdrop-blur-sm text-white/65 px-2 py-0.5 rounded">
                {badgeTag}
              </span>
            </div>
          )}

          {/* Top-right: context menu */}
          <div className="absolute top-2 right-2 z-10" onClick={e => e.stopPropagation()}>
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

          {/* Bottom gradient overlay: title + tags + copy */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-10 pb-3 px-3">
            <h3 className="font-semibold text-sm leading-snug line-clamp-2 text-white">
              {prompt.title}
            </h3>
            <div className="flex items-center justify-between gap-2 mt-1.5">
              <div className="flex flex-wrap gap-1 min-w-0 overflow-hidden">
                {visibleTags.map(tag => (
                  <span
                    key={tag}
                    className={`text-[10px] px-1.5 py-0 rounded font-mono leading-5 shrink-0 ${tagColorClass(tag)}`}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0 text-white/60 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={e => { e.stopPropagation(); onCopy() }}
              >
                <Copy className="h-3 w-3" />
                <span className="sr-only">Kopieren</span>
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Lightbox — portal to avoid hover flicker */}
      {lightboxOpen && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setLightboxOpen(false)}
          >
            <motion.img
              src={prompt.cover_image_url!}
              alt={prompt.title}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={e => e.stopPropagation()}
            />
            <button
              className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
              onClick={() => setLightboxOpen(false)}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Schließen</span>
            </button>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

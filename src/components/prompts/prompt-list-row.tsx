'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, MoreVertical, Pencil, Trash2, FolderPlus, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { tagColorClass } from '@/lib/tag-colors'
import { StarRating } from '@/components/prompts/star-rating'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Prompt } from '@/hooks/use-prompts'

const GRADIENTS = [
  'from-violet-950 to-indigo-900',
  'from-blue-950 to-cyan-900',
  'from-emerald-950 to-teal-900',
  'from-orange-950 to-red-900',
  'from-pink-950 to-fuchsia-900',
  'from-amber-950 to-orange-900',
  'from-purple-950 to-fuchsia-900',
  'from-slate-900 to-zinc-800',
]

function gradientForTitle(title: string): string {
  let hash = 0
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) & 0x7fffffff
  return GRADIENTS[hash % GRADIENTS.length]
}

export const rowVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
}

interface PromptListRowProps {
  prompt: Prompt
  onClick: () => void
  onCopy: () => void
  onEdit: () => void
  onDelete: () => void
  onAddToCollection?: () => void
  onToggleFavorite: () => void
  onSetRating: (rating: number | null) => void
}

export function PromptListRow({
  prompt,
  onClick,
  onCopy,
  onEdit,
  onDelete,
  onAddToCollection,
  onToggleFavorite,
  onSetRating,
}: PromptListRowProps) {
  const [imgError, setImgError] = useState(false)
  const gradient = gradientForTitle(prompt.title)
  const showGradient = !prompt.cover_image_url || imgError

  const date = new Date(prompt.created_at).toLocaleDateString('de-DE', {
    day: 'numeric', month: 'short', year: '2-digit',
  })

  return (
    <motion.div
      className="group flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-accent/40 cursor-pointer transition-colors"
      onClick={onClick}
      variants={rowVariants}
    >
      {/* Thumbnail 48×48 */}
      <div className="shrink-0 w-12 h-12 rounded-md overflow-hidden">
        {showGradient ? (
          <div className={`w-full h-full bg-gradient-to-br ${gradient}`} />
        ) : (
          <img
            src={prompt.cover_image_url!}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{prompt.title}</span>
          <div className="flex gap-1 shrink-0">
            {prompt.tags.slice(0, 2).map(tag => (
              <span key={tag} className={`text-[10px] px-1.5 py-0 rounded font-mono leading-5 ${tagColorClass(tag)}`}>
                #{tag}
              </span>
            ))}
          </div>
        </div>
        {prompt.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{prompt.description}</p>
        )}
      </div>

      {/* Stars */}
      <div className="shrink-0 hidden sm:block" onClick={e => e.stopPropagation()}>
        <StarRating value={prompt.rating} onChange={onSetRating} />
      </div>

      {/* Date */}
      <span className="text-xs text-muted-foreground shrink-0 hidden md:block">{date}</span>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
        <Button
          size="icon"
          variant="ghost"
          className={`h-7 w-7 transition-opacity ${prompt.is_favorite ? 'opacity-100 text-rose-500' : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500'}`}
          onClick={onToggleFavorite}
        >
          <Heart className={`h-3.5 w-3.5 ${prompt.is_favorite ? 'fill-rose-500' : ''}`} />
          <span className="sr-only">Favorit</span>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onCopy}
        >
          <Copy className="h-3.5 w-3.5" />
          <span className="sr-only">Kopieren</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
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
    </motion.div>
  )
}

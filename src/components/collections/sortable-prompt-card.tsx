'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { PromptCardGrid } from '@/components/prompts/prompt-card-grid'
import type { Prompt } from '@/hooks/use-prompts'

interface SortablePromptCardProps {
  id: string
  prompt: Prompt
  onClick: () => void
  onCopy: () => void
  onEdit: () => void
  onDelete: () => void
  onRemoveFromCollection: () => void
  onToggleFavorite: () => void
  onSetRating: (rating: number | null) => void
}

export function SortablePromptCard({
  id,
  prompt,
  onClick,
  onCopy,
  onEdit,
  onDelete,
  onRemoveFromCollection,
  onToggleFavorite,
  onSetRating,
}: SortablePromptCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const dragHandle = (
    <button
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing text-white/60 hover:text-white transition-colors p-1 rounded touch-none bg-black/40 hover:bg-black/60"
      aria-label="Drag Handle"
      onClick={e => e.stopPropagation()}
      type="button"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  )

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <PromptCardGrid
        prompt={prompt}
        onClick={onClick}
        onCopy={onCopy}
        onEdit={onEdit}
        onDelete={onDelete}
        onRemoveFromCollection={onRemoveFromCollection}
        onToggleFavorite={onToggleFavorite}
        onSetRating={onSetRating}
        dragHandleSlot={dragHandle}
      />
    </div>
  )
}

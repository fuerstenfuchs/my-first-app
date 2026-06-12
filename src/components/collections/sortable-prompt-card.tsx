'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { PromptCard } from '@/components/prompts/prompt-card'
import type { Prompt } from '@/hooks/use-prompts'

interface SortablePromptCardProps {
  id: string
  prompt: Prompt
  onClick: () => void
  onCopy: () => void
  onEdit: () => void
  onDelete: () => void
  onRemoveFromCollection: () => void
}

export function SortablePromptCard({
  id,
  prompt,
  onClick,
  onCopy,
  onEdit,
  onDelete,
  onRemoveFromCollection,
}: SortablePromptCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <button
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors p-1 rounded touch-none"
        aria-label="Drag Handle"
        onClick={e => e.stopPropagation()}
        type="button"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <PromptCard
        prompt={prompt}
        onClick={onClick}
        onCopy={onCopy}
        onEdit={onEdit}
        onDelete={onDelete}
        onRemoveFromCollection={onRemoveFromCollection}
      />
    </div>
  )
}

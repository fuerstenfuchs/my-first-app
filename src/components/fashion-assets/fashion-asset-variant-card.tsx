'use client'

import { useRef } from 'react'
import { Upload, Pencil, Trash2, MoreHorizontal, GripVertical } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { FashionAssetVariant } from '@/hooks/use-fashion-assets'

interface Props {
  variant: FashionAssetVariant
  isSelected: boolean
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
  onUploadImages: (files: File[]) => void
}

export function FashionAssetVariantCard({ variant, isSelected, onClick, onEdit, onDelete, onUploadImages }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const cover = variant.images[0]

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: variant.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border transition-all cursor-pointer group relative ${
        isSelected
          ? 'border-rose-500/60 bg-rose-500/5 ring-1 ring-rose-500/30'
          : 'border-border/50 bg-card/60 hover:border-border hover:bg-card'
      }`}
      onClick={onClick}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 z-10 p-1 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 cursor-grab active:cursor-grabbing text-muted-foreground bg-black/40"
        onClick={e => e.stopPropagation()}
      >
        <GripVertical className="h-3 w-3" />
      </div>

      <div className="relative aspect-square rounded-t-lg overflow-hidden bg-muted/30">
        {cover ? (
          <img src={cover.url} alt={variant.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
            <span className="text-lg font-bold">{variant.name.charAt(0).toUpperCase()}</span>
          </div>
        )}
        {variant.images.length > 1 && (
          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1 py-0.5 rounded leading-none">
            {variant.images.length}
          </div>
        )}
        <div
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5"
          onClick={e => e.stopPropagation()}
        >
          <Button size="icon" variant="secondary" className="h-6 w-6 bg-black/60 hover:bg-black/80 border-0"
            onClick={() => fileRef.current?.click()} title="Bilder hochladen">
            <Upload className="h-3 w-3 text-white" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="secondary" className="h-6 w-6 bg-black/60 hover:bg-black/80 border-0">
                <MoreHorizontal className="h-3 w-3 text-white" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}><Pencil className="mr-2 h-3.5 w-3.5" />Bearbeiten</DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-3.5 w-3.5" />Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="px-2 py-1.5">
        <p className="font-medium text-xs leading-tight truncate">{variant.name}</p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onClick={e => e.stopPropagation()}
        onChange={e => {
          const f = Array.from(e.target.files ?? [])
          if (f.length > 0) onUploadImages(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

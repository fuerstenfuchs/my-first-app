'use client'

import { useRef } from 'react'
import { Upload, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'
import type { CharacterVariant } from '@/hooks/use-characters'

const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif'

interface Props {
  variant: CharacterVariant
  isSelected: boolean
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
  onUploadImages: (files: File[]) => void
}

export function VariantCard({ variant, isSelected, onClick, onEdit, onDelete, onUploadImages }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const coverImage = variant.images[0]

  return (
    <div
      className={`rounded-xl border transition-all cursor-pointer group ${
        isSelected
          ? 'border-violet-500/60 bg-violet-500/5 ring-1 ring-violet-500/30'
          : 'border-border/50 bg-card/60 hover:border-border hover:bg-card'
      }`}
      onClick={onClick}
    >
      {/* Cover image */}
      <div className="relative aspect-[4/3] rounded-t-xl overflow-hidden bg-muted/30">
        {coverImage ? (
          <img src={coverImage.url} alt={variant.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
              <span className="text-xl font-bold">{variant.name.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-xs">Kein Bild</span>
          </div>
        )}

        {/* Image count */}
        {variant.images.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-md">
            {variant.images.length} Bilder
          </div>
        )}

        {/* Action overlay */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1" onClick={e => e.stopPropagation()}>
          <Button
            size="icon"
            variant="secondary"
            className="h-7 w-7 bg-black/60 hover:bg-black/80 border-0"
            onClick={() => fileRef.current?.click()}
            title="Bilder hochladen"
          >
            <Upload className="h-3.5 w-3.5 text-white" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="secondary" className="h-7 w-7 bg-black/60 hover:bg-black/80 border-0">
                <MoreHorizontal className="h-3.5 w-3.5 text-white" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Bearbeiten
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="font-medium text-sm leading-tight truncate">{variant.name}</p>
        {variant.description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{variant.description}</p>
        )}
        {variant.prompt && (
          <p className="text-xs text-muted-foreground/50 mt-1 line-clamp-2 font-mono leading-relaxed">
            {variant.prompt}
          </p>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onClick={e => e.stopPropagation()}
        onChange={e => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) onUploadImages(files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

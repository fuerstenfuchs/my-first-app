'use client'

import { useCallback, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Link2, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { CharacterImage } from '@/hooks/use-characters'

interface SortableImageProps {
  image: CharacterImage
  isCover: boolean
  onDelete: () => void
}

function SortableImage({ image, isCover, onDelete }: SortableImageProps) {
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

        {/* Cover badge */}
        {isCover && (
          <div className="absolute top-1 right-1 text-[10px] bg-amber-500 text-black px-1.5 py-0.5 rounded font-semibold z-10">
            Cover
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 mt-1">
        {isCover ? (
          <span className="text-[11px] text-amber-400 flex-1 truncate">★ Cover</span>
        ) : (
          <span className="flex-1" />
        )}
        <button
          type="button"
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive transition-colors ml-auto shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">Löschen</span>
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  variantId: string
  images: CharacterImage[]
  uploading: { id: string; file: File; status: string }[]
  onUpload: (files: File[]) => void
  onAddUrl: (url: string) => void
  onDelete: (imageId: string, storagePath: string | null) => void
  onReorder: (orderedIds: string[]) => void
}

export function CharacterMediaManager({
  variantId,
  images,
  uploading,
  onUpload,
  onAddUrl,
  onDelete,
  onReorder,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [urlInput, setUrlInput] = useState('')

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
  const coverUrl = images[0]?.url ?? null

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        className={cn(
          'rounded-lg border-2 border-dashed transition-colors p-4',
          isDragOver ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 hover:border-white/20',
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
                type="button"
                variant="outline"
                size="sm"
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
                type="button"
                variant="outline"
                size="sm"
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

      {/* Upload progress */}
      {uploading.length > 0 && (
        <div className="space-y-1">
          {uploading.map(u => (
            <div key={u.id} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground truncate flex-1 min-w-0">{u.file.name}</span>
              {u.status === 'uploading' && <span className="text-muted-foreground shrink-0 animate-pulse">Lädt…</span>}
              {u.status === 'done' && <span className="text-green-400 shrink-0">✓</span>}
              {u.status === 'error' && <span className="text-destructive shrink-0">Fehler</span>}
            </div>
          ))}
        </div>
      )}

      {/* Sortable image grid */}
      {images.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images.map(i => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2">
              {images.map(img => (
                <SortableImage
                  key={img.id}
                  image={img}
                  isCover={img.url === coverUrl}
                  onDelete={() => onDelete(img.id, img.storage_path)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {images.length === 0 && !hasActiveUploads && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Noch keine Bilder — lade Referenzbilder dieser Variante hoch.
        </p>
      )}
    </div>
  )
}

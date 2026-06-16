'use client'

import { useCallback, useRef, useState } from 'react'
import {
  DndContext, closestCenter, type DragEndEvent,
  PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, rectSortingStrategy,
  sortableKeyboardCoordinates, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Crown, GripVertical, Link2, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { FashionAssetImage } from '@/hooks/use-fashion-assets'

function SortableImage({
  image, isAssetCover, onDelete, onSetAssetCover,
}: {
  image: FashionAssetImage
  isAssetCover: boolean
  onDelete: () => void
  onSetAssetCover?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} {...attributes} className={cn('relative rounded-md', isDragging && 'opacity-50 z-50')}>
      <div className="relative aspect-video rounded-md overflow-hidden border border-white/10 bg-black group">
        <img src={image.url} alt="" className="w-full h-full object-cover" />
        <div {...listeners} className="absolute top-1 left-1 cursor-grab active:cursor-grabbing p-1 bg-black/50 rounded z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="h-3 w-3 text-white" />
        </div>
        {onSetAssetCover && !isAssetCover && (
          <button
            type="button"
            onClick={onSetAssetCover}
            title="Als Titelbild setzen"
            className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-amber-500 rounded z-10 opacity-30 group-hover:opacity-100 transition-all"
          >
            <Crown className="h-3 w-3 text-white" />
          </button>
        )}
        {isAssetCover && (
          <div className="absolute top-1 right-1 flex items-center gap-0.5 text-[10px] bg-amber-500 text-black px-1.5 py-0.5 rounded font-semibold z-10">
            <Crown className="h-2.5 w-2.5" />Titelbild
          </div>
        )}
      </div>
      <div className="flex items-center mt-1">
        {isAssetCover ? (
          <span className="text-[11px] text-amber-400 flex-1 flex items-center gap-0.5">
            <Crown className="h-2.5 w-2.5" />Titelbild
          </span>
        ) : <span className="flex-1" />}
        <button type="button" onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

interface Props {
  variantId: string
  images: FashionAssetImage[]
  uploading: { id: string; file: File; status: string }[]
  assetCoverUrl?: string | null
  onUpload: (files: File[]) => void
  onAddUrl: (url: string) => void
  onDelete: (imageId: string, storagePath: string | null) => void
  onReorder: (orderedIds: string[]) => void
  onSetAssetCover?: (url: string) => void
}

export function FashionAssetMediaManager({
  images, uploading, assetCoverUrl,
  onUpload, onAddUrl, onDelete, onReorder, onSetAssetCover,
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = images.findIndex(i => i.id === active.id)
    const newIndex = images.findIndex(i => i.id === over.id)
    onReorder(arrayMove(images, oldIndex, newIndex).map(i => i.id))
  }

  const hasActiveUploads = uploading.some(u => u.status === 'uploading')

  return (
    <div className="space-y-3">
      <div
        className={cn('rounded-lg border-2 border-dashed transition-colors p-4', isDragOver ? 'border-rose-500 bg-rose-500/10' : 'border-white/10 hover:border-white/20')}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => { e.preventDefault(); setIsDragOver(false); handleFiles(e.dataTransfer.files) }}
      >
        <Tabs defaultValue="upload">
          <TabsList className="h-7 mb-3">
            <TabsTrigger value="upload" className="text-xs gap-1.5 h-5 px-2"><Upload className="h-3 w-3" />Hochladen</TabsTrigger>
            <TabsTrigger value="url" className="text-xs gap-1.5 h-5 px-2"><Link2 className="h-3 w-3" />URL</TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="mt-0 space-y-2">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-2 h-8 text-xs" disabled={hasActiveUploads} onClick={() => fileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" />
                {hasActiveUploads ? 'Lädt hoch…' : 'Bilder auswählen'}
              </Button>
              <span className="text-xs text-muted-foreground">oder hierher ziehen</span>
            </div>
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP, GIF · max. 20 MB</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={e => { handleFiles(e.target.files!); e.target.value = '' }} />
          </TabsContent>
          <TabsContent value="url" className="mt-0">
            <div className="flex gap-2">
              <Input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), onAddUrl(urlInput.trim()), setUrlInput(''))} placeholder="https://…" className="text-xs h-8" />
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={() => { onAddUrl(urlInput.trim()); setUrlInput('') }} disabled={!urlInput.trim()}>
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
              <span className="text-muted-foreground truncate flex-1">{u.file.name}</span>
              {u.status === 'uploading' && <span className="text-muted-foreground animate-pulse shrink-0">Lädt…</span>}
              {u.status === 'done' && <span className="text-green-400 shrink-0">✓</span>}
              {u.status === 'error' && <span className="text-destructive shrink-0">Fehler</span>}
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images.map(i => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2">
              {images.map(img => (
                <SortableImage
                  key={img.id}
                  image={img}
                  isAssetCover={!!assetCoverUrl && img.url === assetCoverUrl}
                  onDelete={() => onDelete(img.id, img.storage_path)}
                  onSetAssetCover={onSetAssetCover ? () => onSetAssetCover(img.url) : undefined}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {images.length === 0 && !hasActiveUploads && (
        <p className="text-xs text-muted-foreground text-center py-2">Noch keine Bilder — lade Referenzbilder hoch.</p>
      )}
    </div>
  )
}

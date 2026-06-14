'use client'

import { forwardRef, useCallback, useImperativeHandle, useRef, useEffect, useState } from 'react'
import {
  DndContext,
  closestCenter,
  DragEndEvent,
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
import { GripVertical, Link2, Trash2, Upload, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePromptMedia, type PromptMedia } from '@/hooks/use-prompt-media'
import { cn } from '@/lib/utils'

export interface MediaManagerHandle {
  commitDeferredMedia: () => Promise<void>
}

interface MediaManagerProps {
  promptId: string
  coverImageUrl: string | null
  onCoverChange: (url: string | null) => void
  deferred?: boolean
}

interface SortableItemProps {
  item: PromptMedia
  isCover: boolean
  onSetCover: (item: PromptMedia) => void
  onDelete: (item: PromptMedia) => void
}

function SortableMediaItem({ item, isCover, onSetCover, onDelete }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn('relative rounded-md overflow-visible', isDragging && 'opacity-50 z-50')}
    >
      <div className="relative aspect-video rounded-md overflow-hidden border border-white/10 bg-black group">
        {item.type === 'video' ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black/60 gap-1">
            <Video className="h-6 w-6 text-white/50" />
            <span className="text-xs text-white/40">Video</span>
          </div>
        ) : (
          <img src={item.url} alt="" className="w-full h-full object-cover" />
        )}
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
        {item.type === 'image' && !isCover && (
          <button
            type="button"
            onClick={() => onSetCover(item)}
            className="text-[11px] text-muted-foreground hover:text-amber-400 transition-colors flex-1 text-left truncate"
          >
            Als Cover
          </button>
        )}
        {isCover && (
          <span className="text-[11px] text-amber-400 flex-1 truncate">★ Cover</span>
        )}
        {item.type === 'video' && !isCover && (
          <span className="flex-1" />
        )}
        <button
          type="button"
          onClick={() => onDelete(item)}
          className="text-muted-foreground hover:text-destructive transition-colors ml-auto shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">Löschen</span>
        </button>
      </div>
    </div>
  )
}

export const MediaManager = forwardRef<MediaManagerHandle, MediaManagerProps>(
function MediaManager({ promptId, coverImageUrl, onCoverChange, deferred = false }, ref) {
  const { media, uploading, fetchMedia, uploadFiles, deleteMedia, reorderMedia, setCoverImage, addMediaUrl, commitDeferredMedia } = usePromptMedia()
  const [urlInput, setUrlInput] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    commitDeferredMedia: () => commitDeferredMedia(promptId),
  }), [commitDeferredMedia, promptId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    fetchMedia(promptId)
  }, [promptId, fetchMedia])

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files)
    if (arr.length === 0) return
    const newMedia = await uploadFiles(arr, promptId, deferred)
    // Auto-set cover if this is the first image and no cover yet
    if (!coverImageUrl) {
      const firstImage = newMedia.find(m => m.type === 'image')
      if (firstImage) {
        if (!deferred) await setCoverImage(firstImage.url, promptId)
        onCoverChange(firstImage.url)
      }
    }
  }, [uploadFiles, promptId, deferred, coverImageUrl, setCoverImage, onCoverChange])

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  async function handleUrlAdd() {
    const url = urlInput.trim()
    if (!url) return
    const item = await addMediaUrl(url, promptId, deferred)
    if (!item) return
    setUrlInput('')
    if (!coverImageUrl && item.type === 'image') {
      if (!deferred) await setCoverImage(url, promptId)
      onCoverChange(url)
    }
  }

  async function handleSetCover(item: PromptMedia) {
    if (!deferred) await setCoverImage(item.url, promptId)
    onCoverChange(item.url)
  }

  async function handleDelete(item: PromptMedia) {
    await deleteMedia(item.id, item.url)
    if (item.url === coverImageUrl) {
      const remaining = media.filter(m => m.id !== item.id && m.type === 'image')
      const next = remaining[0]?.url ?? null
      if (!deferred) await setCoverImage(next, promptId)
      onCoverChange(next)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = media.findIndex(m => m.id === active.id)
    const newIndex = media.findIndex(m => m.id === over.id)
    const reordered = arrayMove(media, oldIndex, newIndex)
    await reorderMedia(reordered.map(m => m.id))
  }

  const hasActiveUploads = uploading.some(u => u.status === 'uploading')

  return (
    <div className="space-y-3">
      <Label>
        Medien{' '}
        <span className="text-muted-foreground font-normal">(optional)</span>
      </Label>

      {/* Drop Zone */}
      <div
        className={cn(
          'rounded-lg border-2 border-dashed transition-colors p-4',
          isDragOver ? 'border-green-500 bg-green-500/10' : 'border-white/10 hover:border-white/20',
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
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                {hasActiveUploads ? 'Lädt hoch…' : 'Dateien auswählen'}
              </Button>
              <span className="text-xs text-muted-foreground">oder hierher ziehen</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Bilder: JPG, PNG, WebP, GIF (max. 20 MB) · Videos: MP4, WebM, MOV (max. 100 MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov"
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
        <div className="space-y-1.5">
          {uploading.map(u => (
            <div key={u.id} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">{u.file.name}</span>
              {u.status === 'uploading' && (
                <Progress value={u.progress} className="h-1.5 w-20 shrink-0" />
              )}
              {u.status === 'done' && (
                <span className="text-xs text-green-400 shrink-0">✓</span>
              )}
              {u.status === 'error' && (
                <span className="text-xs text-destructive shrink-0">Fehler</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sortable media grid */}
      {media.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={media.map(m => m.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2">
              {media.map(item => (
                <SortableMediaItem
                  key={item.id}
                  item={item}
                  isCover={item.url === coverImageUrl}
                  onSetCover={handleSetCover}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
})

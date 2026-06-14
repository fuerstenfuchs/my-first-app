'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { FolderOpen, ImageIcon } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Skeleton as SkeletonUI } from '@/components/ui/skeleton'
import { SortablePromptCard } from '@/components/collections/sortable-prompt-card'
import { CollectionCover } from '@/components/collections/collection-cover'
import { CollectionCoverModal } from '@/components/collections/collection-cover-modal'
import { PromptModal } from '@/components/prompts/prompt-modal'
import { PromptDetailPanel } from '@/components/prompts/prompt-detail-panel'
import { DeleteDialog } from '@/components/prompts/delete-dialog'
import { useCollectionPrompts } from '@/hooks/use-collections'
import { usePrompts, type Prompt, type PromptInput } from '@/hooks/use-prompts'

type ModalMode = 'view' | 'edit'

export default function CollectionPage() {
  const { id } = useParams<{ id: string }>()
  const {
    items,
    loading,
    collectionName,
    collectionCoverUrl,
    reorder,
    updateCover,
    removeFromCollection,
    removeItemAt,
  } = useCollectionPrompts(id)
  const { updatePrompt, deletePrompt, copyPrompt, toggleFavorite, setRating } = usePrompts()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalPrompt, setModalPrompt] = useState<Prompt | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>('edit')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)
  const [coverModalOpen, setCoverModalOpen] = useState(false)
  const [detailPromptId, setDetailPromptId] = useState<string | null>(null)

  const liveDetailPrompt = detailPromptId
    ? items.find(i => i.prompt.id === detailPromptId)?.prompt ?? null
    : null

  const detailItemIndex = detailPromptId
    ? items.findIndex(i => i.prompt.id === detailPromptId)
    : -1

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(item => item.id === active.id)
    const newIndex = items.findIndex(item => item.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) reorder(oldIndex, newIndex)
  }

  const coverImages: string[] = (() => {
    if (collectionCoverUrl) return [collectionCoverUrl]
    for (const item of items) {
      const img =
        item.prompt.cover_image_url ||
        item.prompt.preview_media.find(m => m.type === 'image')?.url
      if (img) return [img]
    }
    return []
  })()

  function openEdit(prompt: Prompt) {
    setModalPrompt(prompt)
    setModalMode('edit')
    setModalOpen(true)
  }

  async function handleSave(input: PromptInput): Promise<boolean> {
    if (!modalPrompt) return false
    return updatePrompt(modalPrompt.id, input)
  }

  async function handleDeleteConfirm() {
    if (!deleteId) return
    await deletePrompt(deleteId)
    if (deleteIndex !== null) removeItemAt(deleteIndex)
    setDeleteId(null)
    setDeleteIndex(null)
  }

  return (
    <div className="flex h-svh min-w-0">
      {/* Left: header + grid */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="border-b shrink-0">
          <div className="flex items-center gap-3 px-4 py-3">
            <SidebarTrigger />
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <CollectionCover
                images={loading ? [] : coverImages}
                name={collectionName}
                mode="single"
                className="h-10 w-10 rounded-lg shrink-0"
              />
              <div className="min-w-0 flex-1">
                {loading ? (
                  <SkeletonUI className="h-6 w-40" />
                ) : (
                  <>
                    <h1 className="text-lg font-semibold truncate leading-tight">
                      {collectionName}
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      {items.length} {items.length === 1 ? 'Prompt' : 'Prompts'}
                    </p>
                  </>
                )}
              </div>
            </div>
            {!loading && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCoverModalOpen(true)}
                className="shrink-0"
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Cover
              </Button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
          <main className="absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden" style={{ right: '-20px' }}>
            {loading ? (
              <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonUI key={i} className="h-48 rounded-xl" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center gap-3 px-4">
                <FolderOpen className="h-12 w-12 text-muted-foreground/40" />
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold">Diese Sammlung ist leer</h2>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Öffne einen Prompt unter „Alle Prompts" und wähle im Drei-Punkte-Menü
                    „Zu Sammlung hinzufügen".
                  </p>
                </div>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={items.map(i => i.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className={`p-4 md:p-6 grid gap-4 grid-cols-1 sm:grid-cols-2 ${detailPromptId ? 'lg:grid-cols-2 xl:grid-cols-2' : 'lg:grid-cols-3 xl:grid-cols-4'}`}>
                    {items.map((item, index) => (
                      <SortablePromptCard
                        key={item.id}
                        id={item.id}
                        prompt={item.prompt}
                        onClick={() => setDetailPromptId(prev => prev === item.prompt.id ? null : item.prompt.id)}
                        onCopy={() => copyPrompt(item.prompt)}
                        onEdit={() => openEdit(item.prompt)}
                        onDelete={() => {
                          setDetailPromptId(null)
                          setDeleteId(item.prompt.id)
                          setDeleteIndex(index)
                        }}
                        onRemoveFromCollection={() => removeFromCollection(index)}
                        onToggleFavorite={() => toggleFavorite(item.prompt)}
                        onSetRating={(rating) => setRating(item.prompt, rating)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </main>
        </div>
      </div>

      {/* Right: detail panel */}
      <AnimatePresence>
        {liveDetailPrompt && (
          <PromptDetailPanel
            prompt={liveDetailPrompt}
            onClose={() => setDetailPromptId(null)}
            onEdit={() => openEdit(liveDetailPrompt)}
            onDelete={() => {
              setDetailPromptId(null)
              setDeleteId(liveDetailPrompt.id)
              setDeleteIndex(detailItemIndex)
            }}
            onToggleFavorite={() => toggleFavorite(liveDetailPrompt)}
            onSetRating={r => setRating(liveDetailPrompt, r)}
          />
        )}
      </AnimatePresence>

      <PromptModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        prompt={modalPrompt}
        mode={modalMode}
        onSave={handleSave}
        onCopy={modalPrompt ? () => copyPrompt(modalPrompt) : undefined}
      />

      <DeleteDialog
        open={!!deleteId}
        onOpenChange={open => !open && (setDeleteId(null), setDeleteIndex(null))}
        onConfirm={handleDeleteConfirm}
      />

      <CollectionCoverModal
        open={coverModalOpen}
        onClose={() => setCoverModalOpen(false)}
        collectionId={id}
        currentCoverUrl={collectionCoverUrl}
        items={items}
        onCoverChange={updateCover}
      />
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { FolderOpen } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton as SkeletonUI } from '@/components/ui/skeleton'
import { PromptCard } from '@/components/prompts/prompt-card'
import { PromptModal } from '@/components/prompts/prompt-modal'
import { DeleteDialog } from '@/components/prompts/delete-dialog'
import { useCollectionPrompts } from '@/hooks/use-collections'
import { usePrompts, type Prompt, type PromptInput } from '@/hooks/use-prompts'

type ModalMode = 'view' | 'edit'

export default function CollectionPage() {
  const { id } = useParams<{ id: string }>()
  const { items, loading, collectionName, moveUp, moveDown, removeFromCollection } =
    useCollectionPrompts(id)
  const { updatePrompt, deletePrompt, copyPrompt } = usePrompts()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalPrompt, setModalPrompt] = useState<Prompt | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>('view')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)

  function openView(prompt: Prompt) {
    setModalPrompt(prompt)
    setModalMode('view')
    setModalOpen(true)
  }

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
    setDeleteId(null)
    setDeleteIndex(null)
  }

  return (
    <div className="flex flex-col h-svh">
      <header className="border-b shrink-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <SidebarTrigger />
          <FolderOpen className="h-5 w-5 text-muted-foreground shrink-0" />
          <h1 className="text-lg font-semibold truncate">
            {loading ? <SkeletonUI className="h-6 w-40" /> : collectionName}
          </h1>
          {!loading && (
            <span className="text-sm text-muted-foreground shrink-0">
              ({items.length})
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((item, index) => (
              <PromptCard
                key={item.id}
                prompt={item.prompt}
                onClick={() => openView(item.prompt)}
                onCopy={() => copyPrompt(item.prompt)}
                onEdit={() => openEdit(item.prompt)}
                onDelete={() => {
                  setDeleteId(item.prompt.id)
                  setDeleteIndex(index)
                }}
                onMoveUp={() => moveUp(index)}
                onMoveDown={() => moveDown(index)}
                onRemoveFromCollection={() => removeFromCollection(index)}
                isFirst={index === 0}
                isLast={index === items.length - 1}
              />
            ))}
          </div>
        )}
      </main>

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
    </div>
  )
}

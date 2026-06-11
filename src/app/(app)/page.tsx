'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PromptCard } from '@/components/prompts/prompt-card'
import { PromptModal } from '@/components/prompts/prompt-modal'
import { DeleteDialog } from '@/components/prompts/delete-dialog'
import { usePrompts, type Prompt, type PromptInput } from '@/hooks/use-prompts'

type ModalMode = 'view' | 'edit' | 'create'

export default function PromptsPage() {
  const { prompts, loading, createPrompt, updatePrompt, deletePrompt, copyPrompt } = usePrompts()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalPrompt, setModalPrompt] = useState<Prompt | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>('create')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function openCreate() {
    setModalPrompt(null)
    setModalMode('create')
    setModalOpen(true)
  }

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
    if (modalMode === 'edit' && modalPrompt) {
      return updatePrompt(modalPrompt.id, input)
    }
    return createPrompt(input)
  }

  async function handleDeleteConfirm() {
    if (!deleteId) return
    await deletePrompt(deleteId)
    setDeleteId(null)
  }

  return (
    <div className="flex flex-col h-svh">
      <header className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <h1 className="text-lg font-semibold">Alle Prompts</h1>
          {!loading && prompts.length > 0 && (
            <span className="text-sm text-muted-foreground">({prompts.length})</span>
          )}
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Neuer Prompt
        </Button>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : prompts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center gap-4 px-4">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Noch keine Prompts</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Leg deinen ersten Prompt an und fang an, deine KI-Workflows zu organisieren.
              </p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Ersten Prompt anlegen
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {prompts.map(prompt => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                onClick={() => openView(prompt)}
                onCopy={() => copyPrompt(prompt)}
                onEdit={() => openEdit(prompt)}
                onDelete={() => setDeleteId(prompt.id)}
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
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}

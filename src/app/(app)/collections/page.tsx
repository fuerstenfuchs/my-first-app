'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FolderOpen, FolderPlus, Plus } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CollectionCard } from '@/components/collections/collection-card'
import { useCollectionsOverview } from '@/hooks/use-collections'

export default function CollectionsPage() {
  const router = useRouter()
  const { collections, loading, createCollection } = useCollectionsOverview()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [nameError, setNameError] = useState('')
  const [creating, setCreating] = useState(false)

  function openDialog() {
    setNewName('')
    setNameError('')
    setDialogOpen(true)
  }

  async function handleCreate() {
    if (!newName.trim()) {
      setNameError('Bitte gib einen Namen ein')
      return
    }
    setCreating(true)
    const col = await createCollection(newName.trim())
    setCreating(false)
    if (col) {
      setDialogOpen(false)
      setNewName('')
      router.push(`/collections/${col.id}`)
    }
  }

  return (
    <div className="flex flex-col h-svh">
      <header className="border-b shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold">Sammlungen</h1>
          </div>
          <Button size="sm" onClick={openDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Sammlung
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center gap-4 px-4">
            <FolderOpen className="h-12 w-12 text-muted-foreground/40" />
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Noch keine Sammlungen</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Erstelle deine erste Sammlung um Prompts thematisch zu gruppieren.
              </p>
            </div>
            <Button onClick={openDialog}>
              <FolderPlus className="mr-2 h-4 w-4" />
              Erste Sammlung anlegen
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {collections.map(col => (
              <CollectionCard key={col.id} collection={col} />
            ))}
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={open => !open && setDialogOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Neue Sammlung</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="col-name">Sammlungsname</Label>
            <Input
              id="col-name"
              value={newName}
              onChange={e => {
                setNewName(e.target.value)
                setNameError('')
              }}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="z.B. Musik-Prompts"
              autoFocus
            />
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Erstellen…' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

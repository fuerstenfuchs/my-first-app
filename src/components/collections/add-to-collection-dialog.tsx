'use client'

import { useState, useEffect } from 'react'
import { Check, FolderOpen } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import type { Collection } from '@/hooks/use-collections'

interface AddToCollectionDialogProps {
  promptId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  collections: Collection[]
}

export function AddToCollectionDialog({
  promptId,
  open,
  onOpenChange,
  collections,
}: AddToCollectionDialogProps) {
  const [inCollections, setInCollections] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !promptId) return
    async function fetchMemberships() {
      const supabase = createClient()
      const { data } = await supabase
        .from('collection_prompts')
        .select('collection_id')
        .eq('prompt_id', promptId)
      setInCollections(new Set(data?.map(r => r.collection_id) ?? []))
    }
    fetchMemberships()
  }, [open, promptId])

  async function handleAdd(collection: Collection) {
    if (inCollections.has(collection.id)) return
    setLoading(collection.id)
    const supabase = createClient()
    const { data: existing } = await supabase
      .from('collection_prompts')
      .select('sort_order')
      .eq('collection_id', collection.id)
      .order('sort_order', { ascending: false })
      .limit(1)
    const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1
    const { error } = await supabase.from('collection_prompts').insert({
      collection_id: collection.id,
      prompt_id: promptId,
      sort_order: nextOrder,
    })
    setLoading(null)
    if (error) {
      toast.error('Hinzufügen fehlgeschlagen')
    } else {
      setInCollections(prev => new Set([...prev, collection.id]))
      toast.success(`Zu „${collection.name}" hinzugefügt`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Zu Sammlung hinzufügen</DialogTitle>
        </DialogHeader>
        {collections.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Noch keine Sammlungen — lege zuerst eine Sammlung in der Sidebar an.
          </p>
        ) : (
          <div className="space-y-1 py-1">
            {collections.map(collection => {
              const isIn = inCollections.has(collection.id)
              return (
                <button
                  key={collection.id}
                  onClick={() => handleAdd(collection)}
                  disabled={isIn || loading === collection.id}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                    {collection.name}
                  </div>
                  {isIn && <Check className="h-4 w-4 text-muted-foreground shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import type { Prompt } from './use-prompts'

export interface Collection {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface CollectionPromptItem {
  id: string
  sort_order: number
  prompt: Prompt
}

export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCollections = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) {
      toast.error('Fehler beim Laden der Sammlungen')
    } else {
      setCollections(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCollections()
  }, [fetchCollections])

  async function createCollection(name: string): Promise<Collection | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('collections')
      .insert({ name: name.trim(), user_id: user!.id })
      .select()
      .single()
    if (error) {
      toast.error('Sammlung konnte nicht erstellt werden')
      return null
    }
    setCollections(prev => [...prev, data])
    return data
  }

  async function renameCollection(id: string, name: string): Promise<boolean> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('collections')
      .update({ name: name.trim() })
      .eq('id', id)
      .select()
      .single()
    if (error) {
      toast.error('Umbenennen fehlgeschlagen')
      return false
    }
    setCollections(prev => prev.map(c => c.id === id ? data : c))
    return true
  }

  async function deleteCollection(id: string): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from('collections').delete().eq('id', id)
    if (error) {
      toast.error('Löschen fehlgeschlagen')
      return false
    }
    setCollections(prev => prev.filter(c => c.id !== id))
    return true
  }

  return { collections, loading, createCollection, renameCollection, deleteCollection }
}

export function useCollectionPrompts(collectionId: string) {
  const [items, setItems] = useState<CollectionPromptItem[]>([])
  const [loading, setLoading] = useState(true)
  const [collectionName, setCollectionName] = useState('')

  const fetchItems = useCallback(async () => {
    const supabase = createClient()
    const [{ data: col }, { data: rows, error }] = await Promise.all([
      supabase.from('collections').select('name').eq('id', collectionId).single(),
      supabase
        .from('collection_prompts')
        .select('id, sort_order, prompt:prompts(*)')
        .eq('collection_id', collectionId)
        .order('sort_order', { ascending: true }),
    ])
    if (col) setCollectionName(col.name)
    if (error) {
      toast.error('Fehler beim Laden der Sammlung')
    } else {
      setItems(
        (rows ?? []).map(r => ({
          id: r.id as string,
          sort_order: r.sort_order as number,
          prompt: r.prompt as unknown as Prompt,
        }))
      )
    }
    setLoading(false)
  }, [collectionId])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  async function moveUp(index: number) {
    if (index === 0) return
    await swap(index, index - 1)
  }

  async function moveDown(index: number) {
    if (index === items.length - 1) return
    await swap(index, index + 1)
  }

  async function swap(i: number, j: number) {
    const newItems = [...items]
    const tempOrder = newItems[i].sort_order
    newItems[i] = { ...newItems[i], sort_order: newItems[j].sort_order }
    newItems[j] = { ...newItems[j], sort_order: tempOrder }
    ;[newItems[i], newItems[j]] = [newItems[j], newItems[i]]
    setItems(newItems)

    const supabase = createClient()
    const [r1, r2] = await Promise.all([
      supabase
        .from('collection_prompts')
        .update({ sort_order: newItems[i].sort_order })
        .eq('id', newItems[i].id),
      supabase
        .from('collection_prompts')
        .update({ sort_order: newItems[j].sort_order })
        .eq('id', newItems[j].id),
    ])
    if (r1.error || r2.error) {
      toast.error('Speichern fehlgeschlagen')
      setItems(items)
    }
  }

  async function removeFromCollection(index: number) {
    const item = items[index]
    const supabase = createClient()
    const { error } = await supabase
      .from('collection_prompts')
      .delete()
      .eq('id', item.id)
    if (error) {
      toast.error('Entfernen fehlgeschlagen')
    } else {
      setItems(prev => prev.filter((_, i) => i !== index))
      toast.success('Aus Sammlung entfernt')
    }
  }

  return { items, loading, collectionName, moveUp, moveDown, removeFromCollection }
}

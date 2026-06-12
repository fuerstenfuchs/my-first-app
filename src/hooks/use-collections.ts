'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import type { Prompt } from './use-prompts'

export interface Collection {
  id: string
  user_id: string
  name: string
  cover_image_url: string | null
  created_at: string
}

export interface CollectionPromptItem {
  id: string
  sort_order: number
  prompt: Prompt
}

export interface CollectionOverviewItem extends Collection {
  prompt_count: number
  collage_images: string[]
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr]
  result.splice(to, 0, result.splice(from, 1)[0])
  return result
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

  async function updateCollectionCover(id: string, url: string | null): Promise<boolean> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('collections')
      .update({ cover_image_url: url })
      .eq('id', id)
      .select()
      .single()
    if (error) {
      toast.error('Cover konnte nicht gespeichert werden')
      return false
    }
    setCollections(prev => prev.map(c => c.id === id ? data : c))
    return true
  }

  return { collections, loading, createCollection, renameCollection, deleteCollection, updateCollectionCover }
}

export function useCollectionsOverview() {
  const [collections, setCollections] = useState<CollectionOverviewItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCollections = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('collections')
      .select(`
        id, user_id, name, cover_image_url, created_at,
        collection_prompts(
          sort_order,
          prompt:prompts(id, cover_image_url, prompt_media(url, type, sort_order))
        )
      `)
      .order('created_at', { ascending: true })
    if (error) {
      toast.error('Fehler beim Laden der Sammlungen')
    } else {
      setCollections(
        ((data ?? []) as unknown as Array<{
          id: string
          user_id: string
          name: string
          cover_image_url: string | null
          created_at: string
          collection_prompts: Array<{
            sort_order: number
            prompt: {
              id: string
              cover_image_url: string | null
              prompt_media: Array<{ url: string; type: string; sort_order: number }>
            } | null
          }> | null
        }>).map(col => {
          const sortedPrompts = ((col.collection_prompts ?? [])
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(cp => cp.prompt)
            .filter(Boolean)) as Array<{
              id: string
              cover_image_url: string | null
              prompt_media: Array<{ url: string; type: string; sort_order: number }>
            }>

          const images: string[] = []
          for (const prompt of sortedPrompts) {
            const firstMedia = (prompt.prompt_media ?? [])
              .filter(m => m.type === 'image')
              .sort((a, b) => a.sort_order - b.sort_order)[0]
            const img = prompt.cover_image_url || firstMedia?.url
            if (img) images.push(img)
            if (images.length >= 4) break
          }

          return {
            id: col.id,
            user_id: col.user_id,
            name: col.name,
            cover_image_url: col.cover_image_url,
            created_at: col.created_at,
            prompt_count: (col.collection_prompts ?? []).length,
            collage_images: col.cover_image_url ? [col.cover_image_url] : images,
          }
        })
      )
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
    await fetchCollections()
    return data
  }

  return { collections, loading, createCollection }
}

export function useCollectionPrompts(collectionId: string) {
  const [items, setItems] = useState<CollectionPromptItem[]>([])
  const [loading, setLoading] = useState(true)
  const [collectionName, setCollectionName] = useState('')
  const [collectionCoverUrl, setCollectionCoverUrl] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    const supabase = createClient()
    const [{ data: col }, { data: rows, error }] = await Promise.all([
      supabase.from('collections').select('name, cover_image_url').eq('id', collectionId).single(),
      supabase
        .from('collection_prompts')
        .select('id, sort_order, prompt:prompts(*, prompt_media(type, url, sort_order))')
        .eq('collection_id', collectionId)
        .order('sort_order', { ascending: true }),
    ])
    if (col) {
      setCollectionName(col.name)
      setCollectionCoverUrl(col.cover_image_url ?? null)
    }
    if (error) {
      toast.error('Fehler beim Laden der Sammlung')
    } else {
      setItems(
        (rows ?? []).map(r => {
          const raw = r.prompt as unknown as {
            prompt_media?: Array<{ type: string; url: string; sort_order: number }>
            [key: string]: unknown
          }
          const { prompt_media, ...rest } = raw ?? {}
          return {
            id: r.id as string,
            sort_order: r.sort_order as number,
            prompt: {
              ...rest,
              preview_media: (prompt_media ?? [])
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(m => ({ type: m.type as 'image' | 'video', url: m.url, sort_order: m.sort_order })),
            } as Prompt,
          }
        })
      )
    }
    setLoading(false)
  }, [collectionId])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  async function reorder(oldIndex: number, newIndex: number) {
    if (oldIndex === newIndex) return
    const prev = items
    const reordered = arrayMove(items, oldIndex, newIndex).map((item, i) => ({
      ...item,
      sort_order: i + 1,
    }))
    setItems(reordered)

    const supabase = createClient()
    const results = await Promise.all(
      reordered.map(item =>
        supabase
          .from('collection_prompts')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id)
      )
    )
    if (results.some(r => r.error)) {
      toast.error('Reihenfolge konnte nicht gespeichert werden')
      setItems(prev)
    }
  }

  async function updateCover(url: string | null): Promise<boolean> {
    const prevUrl = collectionCoverUrl
    setCollectionCoverUrl(url)
    const supabase = createClient()
    const { error } = await supabase
      .from('collections')
      .update({ cover_image_url: url })
      .eq('id', collectionId)
    if (error) {
      toast.error('Cover konnte nicht gespeichert werden')
      setCollectionCoverUrl(prevUrl)
      return false
    }
    return true
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

  function removeItemAt(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  return {
    items,
    loading,
    collectionName,
    collectionCoverUrl,
    reorder,
    updateCover,
    removeFromCollection,
    removeItemAt,
  }
}

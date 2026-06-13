'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'

export interface PreviewMediaItem {
  type: 'image' | 'video'
  url: string
  sort_order: number
}

export interface Prompt {
  id: string
  user_id: string
  title: string
  content: string
  description: string | null
  tags: string[]
  usage_count: number
  last_used_at: string | null
  cover_image_url: string | null
  rating: number | null
  is_favorite: boolean
  source_url: string | null
  source_type: string | null
  created_at: string
  updated_at: string
  preview_media: PreviewMediaItem[]
}

interface RawPromptRow extends Omit<Prompt, 'preview_media'> {
  prompt_media: Array<{ type: string; url: string; sort_order: number }> | null
}

export interface PromptInput {
  title: string
  content: string
  description?: string
  tags?: string[]
  cover_image_url?: string | null
  source_url?: string | null
  source_type?: string | null
}

export function usePrompts() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPrompts = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('prompts')
      .select('*, prompt_media(type, url, sort_order)')
      .order('created_at', { ascending: false })
    if (error) {
      toast.error('Fehler beim Laden der Prompts')
    } else {
      setPrompts((data as unknown as RawPromptRow[]).map(({ prompt_media, ...row }) => ({
        ...row,
        tags: row.tags ?? [],
        preview_media: (prompt_media ?? [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .slice(0, 6)
          .map(m => ({ type: m.type as 'image' | 'video', url: m.url, sort_order: m.sort_order })),
      })))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPrompts()
  }, [fetchPrompts])

  async function createPrompt(input: PromptInput, id?: string): Promise<boolean> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('prompts')
      .insert({ ...input, user_id: user!.id, ...(id ? { id } : {}) })
      .select()
      .single()
    if (error) {
      toast.error('Speichern fehlgeschlagen — bitte erneut versuchen')
      return false
    }
    setPrompts(prev => [{ ...data, preview_media: [] }, ...prev])
    toast.success('Prompt gespeichert')
    fetch('/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [data.id] }),
    }).catch(() => {})
    return true
  }

  async function updatePrompt(id: string, input: PromptInput): Promise<boolean> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('prompts')
      .update(input)
      .eq('id', id)
      .select()
      .single()
    if (error) {
      toast.error('Speichern fehlgeschlagen — bitte erneut versuchen')
      return false
    }
    setPrompts(prev => prev.map(p => p.id === id ? { ...data, preview_media: p.preview_media } : p))
    toast.success('Prompt aktualisiert')
    fetch('/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => {})
    return true
  }

  async function deletePrompt(id: string): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from('prompts').delete().eq('id', id)
    if (error) {
      toast.error('Löschen fehlgeschlagen')
      return false
    }
    setPrompts(prev => prev.filter(p => p.id !== id))
    return true
  }

  async function toggleFavorite(prompt: Prompt): Promise<void> {
    const supabase = createClient()
    const next = !prompt.is_favorite
    const { error } = await supabase
      .from('prompts')
      .update({ is_favorite: next })
      .eq('id', prompt.id)
    if (error) { toast.error('Fehler beim Aktualisieren'); return }
    setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, is_favorite: next } : p))
  }

  async function setRating(prompt: Prompt, rating: number | null): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase
      .from('prompts')
      .update({ rating })
      .eq('id', prompt.id)
    if (error) { toast.error('Fehler beim Speichern der Bewertung'); return }
    setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, rating } : p))
  }

  async function copyPrompt(prompt: Prompt): Promise<void> {
    try {
      await navigator.clipboard.writeText(prompt.content)
      toast.success('Kopiert!')
      const now = new Date().toISOString()
      const supabase = createClient()
      await supabase
        .from('prompts')
        .update({ usage_count: prompt.usage_count + 1, last_used_at: now })
        .eq('id', prompt.id)
      setPrompts(prev =>
        prev.map(p => p.id === prompt.id ? { ...p, usage_count: p.usage_count + 1, last_used_at: now } : p)
      )
    } catch {
      toast.error('Kopieren fehlgeschlagen')
    }
  }

  function prependPrompt(prompt: Prompt) {
    setPrompts(prev => {
      if (prev.some(p => p.id === prompt.id)) return prev
      return [prompt, ...prev]
    })
  }

  async function importPrompts(items: Array<{
    title: string
    content: string
    description?: string | null
    tags?: string[]
    usage_count?: number
  }>): Promise<number> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const rows = items.map(item => ({
      title: item.title,
      content: item.content,
      description: item.description ?? null,
      tags: item.tags ?? [],
      usage_count: item.usage_count ?? 0,
      user_id: user!.id,
    }))
    const { data, error } = await supabase
      .from('prompts')
      .insert(rows)
      .select()
    if (error) {
      toast.error('Import fehlgeschlagen — bitte erneut versuchen')
      return 0
    }
    setPrompts(prev => [...(data ?? []).map(p => ({ ...p, preview_media: [] as PreviewMediaItem[] })), ...prev])
    return data?.length ?? 0
  }

  return { prompts, loading, createPrompt, updatePrompt, deletePrompt, copyPrompt, importPrompts, toggleFavorite, setRating, prependPrompt }
}

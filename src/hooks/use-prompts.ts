'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'

export interface Prompt {
  id: string
  user_id: string
  title: string
  content: string
  description: string | null
  tags: string[]
  usage_count: number
  created_at: string
  updated_at: string
}

export interface PromptInput {
  title: string
  content: string
  description?: string
  tags?: string[]
}

export function usePrompts() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPrompts = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      toast.error('Fehler beim Laden der Prompts')
    } else {
      setPrompts(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPrompts()
  }, [fetchPrompts])

  async function createPrompt(input: PromptInput): Promise<boolean> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('prompts')
      .insert({ ...input, user_id: user!.id })
      .select()
      .single()
    if (error) {
      toast.error('Speichern fehlgeschlagen — bitte erneut versuchen')
      return false
    }
    setPrompts(prev => [data, ...prev])
    toast.success('Prompt gespeichert')
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
    setPrompts(prev => prev.map(p => p.id === id ? data : p))
    toast.success('Prompt aktualisiert')
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

  async function copyPrompt(prompt: Prompt): Promise<void> {
    try {
      await navigator.clipboard.writeText(prompt.content)
      toast.success('Kopiert!')
      const supabase = createClient()
      await supabase
        .from('prompts')
        .update({ usage_count: prompt.usage_count + 1 })
        .eq('id', prompt.id)
      setPrompts(prev =>
        prev.map(p => p.id === prompt.id ? { ...p, usage_count: p.usage_count + 1 } : p)
      )
    } catch {
      toast.error('Kopieren fehlgeschlagen')
    }
  }

  return { prompts, loading, createPrompt, updatePrompt, deletePrompt, copyPrompt }
}

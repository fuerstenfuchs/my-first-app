'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'

export type CategoryScope = 'location' | 'location_archetype'

export interface CustomCategory {
  id:         string
  user_id:    string
  scope:      CategoryScope
  key:        string
  label:      string
  emoji:      string
  created_at: string
}

const TABLE = 'custom_categories'

function normalize(raw: Record<string, unknown>): CustomCategory {
  return {
    id:         raw.id as string,
    user_id:    raw.user_id as string,
    scope:      raw.scope as CategoryScope,
    key:        raw.key as string,
    label:      raw.label as string,
    emoji:      raw.emoji as string,
    created_at: raw.created_at as string,
  }
}

function slugify(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return slug || 'kategorie'
}

export function useCustomCategories(scope: CategoryScope) {
  const [categories, setCategories] = useState<CustomCategory[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('scope', scope)
      .order('created_at', { ascending: true })
    if (error) {
      toast.error('Fehler beim Laden der Kategorien')
    } else {
      setCategories((data ?? []).map(normalize))
    }
    setLoading(false)
  }, [scope])

  useEffect(() => { fetch() }, [fetch])

  async function createCategory(label: string, emoji: string, existingKeys: string[]): Promise<CustomCategory | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const base = slugify(label)
    let key = base
    let suffix = 2
    while (existingKeys.includes(key)) {
      key = `${base}_${suffix++}`
    }

    const { data: row, error } = await supabase
      .from(TABLE)
      .insert({ user_id: user.id, scope, key, label: label.trim(), emoji: emoji.trim() || '📦' })
      .select()
      .single()

    if (error || !row) { toast.error('Kategorie konnte nicht erstellt werden'); return null }
    const category = normalize(row)
    setCategories(prev => [...prev, category])
    return category
  }

  async function deleteCategory(id: string): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) { toast.error('Kategorie konnte nicht gelöscht werden'); return false }
    setCategories(prev => prev.filter(c => c.id !== id))
    return true
  }

  return { categories, loading, createCategory, deleteCategory, refetch: fetch }
}

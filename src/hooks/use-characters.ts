'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { IMAGE_TYPES, IMAGE_MAX, validateMediaFile } from './use-prompt-media'

export type { UploadingFile } from './use-prompt-media'
export { IMAGE_TYPES, IMAGE_MAX }

export interface Character {
  id: string
  user_id: string
  name: string
  description: string | null
  tags: string[]
  cover_image_url: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CharacterImage {
  id: string
  variant_id: string
  user_id: string
  url: string
  storage_path: string | null
  sort_order: number
  created_at: string
}

export interface CharacterVariant {
  id: string
  character_id: string
  user_id: string
  name: string
  description: string | null
  prompt: string | null
  sort_order: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  images: CharacterImage[]
}

export interface CharacterInput {
  name: string
  description?: string
  tags?: string[]
  cover_image_url?: string | null
}

export interface VariantInput {
  name: string
  description?: string
  prompt?: string
}

interface UploadingEntry {
  id: string
  file: File
  status: 'uploading' | 'done' | 'error'
  progress: number
}

// ─── useCharacters ───────────────────────────────────────────────────────────

export function useCharacters() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) {
      toast.error('Fehler beim Laden der Charaktere')
    } else {
      setCharacters((data ?? []).map(normalizeCharacter))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function createCharacter(input: CharacterInput, firstVariantName = 'Standard'): Promise<Character | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: char, error } = await supabase
      .from('characters')
      .insert({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        tags: input.tags ?? [],
        cover_image_url: input.cover_image_url ?? null,
        user_id: user.id,
      })
      .select()
      .single()

    if (error) { toast.error('Charakter konnte nicht erstellt werden'); return null }

    await supabase.from('character_variants').insert({
      character_id: char.id,
      user_id: user.id,
      name: firstVariantName.trim() || 'Standard',
      sort_order: 0,
    })

    const normalized = normalizeCharacter(char)
    setCharacters(prev => [...prev, normalized])
    return normalized
  }

  async function updateCharacter(id: string, input: CharacterInput): Promise<boolean> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('characters')
      .update({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        tags: input.tags ?? [],
        cover_image_url: input.cover_image_url ?? null,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) { toast.error('Aktualisierung fehlgeschlagen'); return false }
    setCharacters(prev => prev.map(c => c.id === id ? normalizeCharacter(data) : c))
    return true
  }

  async function deleteCharacter(id: string): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from('characters').delete().eq('id', id)
    if (error) { toast.error('Löschen fehlgeschlagen'); return false }
    setCharacters(prev => prev.filter(c => c.id !== id))
    return true
  }

  return { characters, loading, createCharacter, updateCharacter, deleteCharacter, refetch: fetch }
}

// ─── useCharacterDetail ──────────────────────────────────────────────────────

export function useCharacterDetail(characterId: string | null) {
  const [character, setCharacter] = useState<Character | null>(null)
  const [variants, setVariants] = useState<CharacterVariant[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState<UploadingEntry[]>([])

  const fetch = useCallback(async () => {
    if (!characterId) { setCharacter(null); setVariants([]); return }
    setLoading(true)
    const supabase = createClient()

    const [{ data: char, error: charErr }, { data: vars, error: varErr }] = await Promise.all([
      supabase.from('characters').select('*').eq('id', characterId).single(),
      supabase
        .from('character_variants')
        .select('*, images:character_images(*)')
        .eq('character_id', characterId)
        .order('sort_order', { ascending: true }),
    ])

    if (charErr || varErr) {
      toast.error('Fehler beim Laden des Charakters')
    } else {
      setCharacter(char ? normalizeCharacter(char) : null)
      setVariants((vars ?? []).map(normalizeVariant))
    }
    setLoading(false)
  }, [characterId])

  useEffect(() => { fetch() }, [fetch])

  // ── Variant CRUD ──

  async function createVariant(input: VariantInput): Promise<CharacterVariant | null> {
    if (!characterId) return null
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const maxOrder = variants.length > 0 ? Math.max(...variants.map(v => v.sort_order)) : -1
    const { data, error } = await supabase
      .from('character_variants')
      .insert({
        character_id: characterId,
        user_id: user.id,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        prompt: input.prompt?.trim() || null,
        sort_order: maxOrder + 1,
      })
      .select()
      .single()

    if (error) { toast.error('Variante konnte nicht erstellt werden'); return null }
    const v = normalizeVariant({ ...data, images: [] })
    setVariants(prev => [...prev, v])
    return v
  }

  async function updateVariant(variantId: string, input: VariantInput): Promise<boolean> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('character_variants')
      .update({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        prompt: input.prompt?.trim() || null,
      })
      .eq('id', variantId)
      .select()
      .single()

    if (error) { toast.error('Aktualisierung fehlgeschlagen'); return false }
    setVariants(prev => prev.map(v =>
      v.id === variantId ? { ...normalizeVariant({ ...data, images: v.images }) } : v
    ))
    return true
  }

  async function deleteVariant(variantId: string): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from('character_variants').delete().eq('id', variantId)
    if (error) { toast.error('Löschen fehlgeschlagen'); return false }
    setVariants(prev => prev.filter(v => v.id !== variantId))
    return true
  }

  // ── Image management ──

  async function uploadImages(variantId: string, files: File[]): Promise<CharacterImage[]> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const validFiles: File[] = []
    for (const file of files) {
      const err = validateMediaFile(file)
      if (err) { toast.error(err); continue }
      if (!IMAGE_TYPES.includes(file.type)) { toast.error(`${file.name}: Nur Bilder erlaubt`); continue }
      validFiles.push(file)
    }
    if (validFiles.length === 0) return []

    const variant = variants.find(v => v.id === variantId)
    const maxOrder = variant && variant.images.length > 0
      ? Math.max(...variant.images.map(i => i.sort_order))
      : -1

    const pending: UploadingEntry[] = validFiles.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      status: 'uploading',
      progress: 0,
    }))
    setUploading(prev => [...prev, ...pending])

    const results: CharacterImage[] = []

    await Promise.all(pending.map(async (entry, idx) => {
      const file = entry.file
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const storagePath = `${user.id}/${variantId}/${crypto.randomUUID()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('character-images')
        .upload(storagePath, file)

      if (upErr) {
        setUploading(prev => prev.map(u => u.id === entry.id ? { ...u, status: 'error' } : u))
        toast.error(`${file.name}: Upload fehlgeschlagen`)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('character-images')
        .getPublicUrl(storagePath)

      const { data: row, error: insertErr } = await supabase
        .from('character_images')
        .insert({
          variant_id: variantId,
          user_id: user.id,
          url: publicUrl,
          storage_path: storagePath,
          sort_order: maxOrder + 1 + idx,
        })
        .select()
        .single()

      if (insertErr) {
        setUploading(prev => prev.map(u => u.id === entry.id ? { ...u, status: 'error' } : u))
        toast.error(`${file.name}: Fehler beim Speichern`)
        return
      }

      setUploading(prev => prev.map(u => u.id === entry.id ? { ...u, status: 'done', progress: 100 } : u))
      results.push(row as CharacterImage)
    }))

    if (results.length > 0) {
      setVariants(prev => prev.map(v =>
        v.id === variantId ? { ...v, images: [...v.images, ...results] } : v
      ))

      // Auto-set character cover from first ever image
      if (!character?.cover_image_url) {
        const first = results[0]
        await supabase.from('characters').update({ cover_image_url: first.url }).eq('id', characterId!)
        setCharacter(prev => prev ? { ...prev, cover_image_url: first.url } : prev)
      }
    }

    setTimeout(() => setUploading(prev => prev.filter(u => u.status !== 'done')), 1500)
    return results
  }

  async function addImageUrl(variantId: string, url: string): Promise<CharacterImage | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const variant = variants.find(v => v.id === variantId)
    const maxOrder = variant && variant.images.length > 0
      ? Math.max(...variant.images.map(i => i.sort_order)) : -1

    const { data: row, error } = await supabase
      .from('character_images')
      .insert({
        variant_id: variantId,
        user_id: user.id,
        url: url.trim(),
        storage_path: null,
        sort_order: maxOrder + 1,
      })
      .select()
      .single()

    if (error) { toast.error('URL konnte nicht hinzugefügt werden'); return null }

    const img = row as CharacterImage
    setVariants(prev => prev.map(v =>
      v.id === variantId ? { ...v, images: [...v.images, img] } : v
    ))

    if (!character?.cover_image_url) {
      await supabase.from('characters').update({ cover_image_url: img.url }).eq('id', characterId!)
      setCharacter(prev => prev ? { ...prev, cover_image_url: img.url } : prev)
    }

    return img
  }

  async function deleteImage(variantId: string, imageId: string, storagePath: string | null): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase.from('character_images').delete().eq('id', imageId)
    if (error) { toast.error('Bild konnte nicht gelöscht werden'); return }

    setVariants(prev => prev.map(v =>
      v.id === variantId ? { ...v, images: v.images.filter(i => i.id !== imageId) } : v
    ))

    if (storagePath) {
      await supabase.storage.from('character-images').remove([storagePath])
    }

    // If deleted image was character cover, update to next available
    const variant = variants.find(v => v.id === variantId)
    if (variant) {
      const remaining = variant.images.filter(i => i.id !== imageId)
      const currentCover = character?.cover_image_url
      const deletedImg = variant.images.find(i => i.id === imageId)
      if (deletedImg?.url === currentCover) {
        const nextUrl = remaining[0]?.url ?? null
        await supabase.from('characters').update({ cover_image_url: nextUrl }).eq('id', characterId!)
        setCharacter(prev => prev ? { ...prev, cover_image_url: nextUrl } : prev)
      }
    }
  }

  async function reorderImages(variantId: string, orderedIds: string[]): Promise<void> {
    const supabase = createClient()
    setVariants(prev => prev.map(v => {
      if (v.id !== variantId) return v
      const byId = Object.fromEntries(v.images.map(i => [i.id, i]))
      return { ...v, images: orderedIds.map((id, idx) => ({ ...byId[id], sort_order: idx })) }
    }))
    await Promise.all(
      orderedIds.map((id, idx) =>
        supabase.from('character_images').update({ sort_order: idx }).eq('id', id)
      )
    )
  }

  async function updateCharacterCover(url: string | null): Promise<void> {
    if (!characterId) return
    const supabase = createClient()
    await supabase.from('characters').update({ cover_image_url: url }).eq('id', characterId)
    setCharacter(prev => prev ? { ...prev, cover_image_url: url } : prev)
  }

  return {
    character,
    variants,
    loading,
    uploading,
    createVariant,
    updateVariant,
    deleteVariant,
    uploadImages,
    addImageUrl,
    deleteImage,
    reorderImages,
    updateCharacterCover,
    refetch: fetch,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeCharacter(raw: Record<string, unknown>): Character {
  return {
    id: raw.id as string,
    user_id: raw.user_id as string,
    name: raw.name as string,
    description: (raw.description as string | null) ?? null,
    tags: (raw.tags as string[] | null) ?? [],
    cover_image_url: (raw.cover_image_url as string | null) ?? null,
    metadata: (raw.metadata as Record<string, unknown>) ?? {},
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
  }
}

function normalizeVariant(raw: Record<string, unknown>): CharacterVariant {
  return {
    id: raw.id as string,
    character_id: raw.character_id as string,
    user_id: raw.user_id as string,
    name: raw.name as string,
    description: (raw.description as string | null) ?? null,
    prompt: (raw.prompt as string | null) ?? null,
    sort_order: (raw.sort_order as number) ?? 0,
    metadata: (raw.metadata as Record<string, unknown>) ?? {},
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
    images: ((raw.images as CharacterImage[] | null) ?? []).sort((a, b) => a.sort_order - b.sort_order),
  }
}

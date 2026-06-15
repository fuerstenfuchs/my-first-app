'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { IMAGE_TYPES, IMAGE_MAX, validateMediaFile } from './use-prompt-media'

export type { UploadingFile } from './use-prompt-media'
export { IMAGE_TYPES, IMAGE_MAX }

export interface Outfit {
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

export interface OutfitImage {
  id: string
  variant_id: string
  user_id: string
  url: string
  storage_path: string | null
  sort_order: number
  created_at: string
}

export interface OutfitVariant {
  id: string
  outfit_id: string
  user_id: string
  name: string
  description: string | null
  sort_order: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  images: OutfitImage[]
}

export interface OutfitInput {
  name: string
  description?: string
  tags?: string[]
  cover_image_url?: string | null
}

export interface OutfitVariantInput {
  name: string
  description?: string
}

export interface InitialOutfitSlot {
  name: string
  file: File
}

interface UploadingEntry {
  id: string
  file: File
  status: 'uploading' | 'done' | 'error'
  progress: number
}

const BUCKET = 'outfit-images'

// ─── useOutfits ──────────────────────────────────────────────────────────────

export function useOutfits() {
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('outfits')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) {
      toast.error('Fehler beim Laden der Outfits')
    } else {
      setOutfits((data ?? []).map(normalizeOutfit))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function createOutfitWithSlots(
    input: OutfitInput,
    slots: InitialOutfitSlot[],
  ): Promise<Outfit | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: outfit, error } = await supabase
      .from('outfits')
      .insert({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        tags: input.tags ?? [],
        user_id: user.id,
      })
      .select()
      .single()

    if (error || !outfit) { toast.error('Outfit konnte nicht erstellt werden'); return null }

    let firstImageUrl: string | null = null

    for (const slot of slots) {
      const validation = validateMediaFile(slot.file)
      if (validation) { toast.error(validation); continue }

      const { data: variant, error: vErr } = await supabase
        .from('outfit_variants')
        .insert({ outfit_id: outfit.id, user_id: user.id, name: slot.name, sort_order: slots.indexOf(slot) })
        .select()
        .single()

      if (vErr || !variant) continue

      const ext = slot.file.name.split('.').pop() ?? 'jpg'
      const storagePath = `${user.id}/${outfit.id}/${variant.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, slot.file)
      if (upErr) continue

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

      await supabase.from('outfit_images').insert({
        variant_id: variant.id,
        user_id: user.id,
        url: publicUrl,
        storage_path: storagePath,
        sort_order: 0,
      })

      if (!firstImageUrl) firstImageUrl = publicUrl
    }

    if (firstImageUrl) {
      await supabase.from('outfits').update({ cover_image_url: firstImageUrl }).eq('id', outfit.id)
      outfit.cover_image_url = firstImageUrl
    }

    const normalized = normalizeOutfit(outfit)
    setOutfits(prev => [...prev, normalized])
    return normalized
  }

  async function updateOutfit(id: string, input: OutfitInput): Promise<boolean> {
    const supabase = createClient()
    const patch: Record<string, unknown> = {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      tags: input.tags ?? [],
    }
    if ('cover_image_url' in input) patch.cover_image_url = input.cover_image_url
    const { data, error } = await supabase
      .from('outfits')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) { toast.error('Aktualisierung fehlgeschlagen'); return false }
    setOutfits(prev => prev.map(o => o.id === id ? normalizeOutfit(data) : o))
    return true
  }

  async function deleteOutfit(id: string): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from('outfits').delete().eq('id', id)
    if (error) { toast.error('Löschen fehlgeschlagen'); return false }
    setOutfits(prev => prev.filter(o => o.id !== id))
    return true
  }

  function patchOutfitCover(id: string, url: string | null) {
    setOutfits(prev => prev.map(o => o.id === id ? { ...o, cover_image_url: url } : o))
  }

  return { outfits, loading, createOutfitWithSlots, updateOutfit, deleteOutfit, patchOutfitCover, refetch: fetch }
}

// ─── useOutfitDetail ─────────────────────────────────────────────────────────

export function useOutfitDetail(outfitId: string | null) {
  const [outfit, setOutfit] = useState<Outfit | null>(null)
  const [variants, setVariants] = useState<OutfitVariant[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState<UploadingEntry[]>([])

  const fetch = useCallback(async () => {
    if (!outfitId) { setOutfit(null); setVariants([]); return }
    setLoading(true)
    const supabase = createClient()

    const [{ data: o, error: oErr }, { data: vars, error: varErr }] = await Promise.all([
      supabase.from('outfits').select('*').eq('id', outfitId).single(),
      supabase
        .from('outfit_variants')
        .select('*, images:outfit_images(*)')
        .eq('outfit_id', outfitId)
        .order('sort_order', { ascending: true }),
    ])

    if (oErr || varErr) {
      toast.error('Fehler beim Laden des Outfits')
    } else {
      setOutfit(o ? normalizeOutfit(o) : null)
      setVariants((vars ?? []).map(normalizeVariant))
    }
    setLoading(false)
  }, [outfitId])

  useEffect(() => { fetch() }, [fetch])

  async function createVariant(input: OutfitVariantInput): Promise<OutfitVariant | null> {
    if (!outfitId) return null
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const maxOrder = variants.length > 0 ? Math.max(...variants.map(v => v.sort_order)) : -1
    const { data, error } = await supabase
      .from('outfit_variants')
      .insert({
        outfit_id: outfitId,
        user_id: user.id,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        sort_order: maxOrder + 1,
      })
      .select()
      .single()

    if (error) { toast.error('Variante konnte nicht erstellt werden'); return null }
    const v = normalizeVariant({ ...data, images: [] })
    setVariants(prev => [...prev, v])
    return v
  }

  async function updateVariant(variantId: string, input: OutfitVariantInput): Promise<boolean> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('outfit_variants')
      .update({
        name: input.name.trim(),
        description: input.description?.trim() || null,
      })
      .eq('id', variantId)
      .select()
      .single()

    if (error) { toast.error('Aktualisierung fehlgeschlagen'); return false }
    setVariants(prev => prev.map(v =>
      v.id === variantId ? normalizeVariant({ ...data, images: v.images }) : v
    ))
    return true
  }

  async function deleteVariant(variantId: string): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from('outfit_variants').delete().eq('id', variantId)
    if (error) { toast.error('Variante konnte nicht gelöscht werden'); return false }
    setVariants(prev => prev.filter(v => v.id !== variantId))
    return true
  }

  async function reorderVariants(orderedIds: string[]): Promise<void> {
    setVariants(prev => {
      const byId = Object.fromEntries(prev.map(v => [v.id, v]))
      return orderedIds.map((id, idx) => ({ ...byId[id], sort_order: idx }))
    })
    const supabase = createClient()
    await Promise.all(orderedIds.map((id, idx) =>
      supabase.from('outfit_variants').update({ sort_order: idx }).eq('id', id)
    ))
  }

  async function uploadImages(variantId: string, files: File[]): Promise<void> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !outfitId) return

    const entries: UploadingEntry[] = files.map(f => ({
      id: `${Date.now()}-${Math.random()}`,
      file: f,
      status: 'uploading',
      progress: 0,
    }))
    setUploading(prev => [...prev, ...entries])

    const existingImages = variants.find(v => v.id === variantId)?.images ?? []
    let nextOrder = existingImages.length

    for (const entry of entries) {
      const validation = validateMediaFile(entry.file)
      if (validation) {
        toast.error(validation)
        setUploading(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'error' } : e))
        continue
      }

      const ext = entry.file.name.split('.').pop() ?? 'jpg'
      const storagePath = `${user.id}/${outfitId}/${variantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, entry.file)
      if (upErr) {
        toast.error(`Upload fehlgeschlagen: ${entry.file.name}`)
        setUploading(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'error' } : e))
        continue
      }

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
      const { data: img } = await supabase.from('outfit_images').insert({
        variant_id: variantId,
        user_id: user.id,
        url: publicUrl,
        storage_path: storagePath,
        sort_order: nextOrder++,
      }).select().single()

      if (img) {
        setVariants(prev => prev.map(v =>
          v.id === variantId ? { ...v, images: [...v.images, normalizeImage(img)] } : v
        ))
      }
      setUploading(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'done' } : e))
    }

    setTimeout(() => setUploading(prev => prev.filter(e => e.status !== 'done')), 2000)
  }

  async function addImageUrl(variantId: string, url: string): Promise<void> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const existingImages = variants.find(v => v.id === variantId)?.images ?? []
    const { data: img } = await supabase.from('outfit_images').insert({
      variant_id: variantId,
      user_id: user.id,
      url,
      storage_path: null,
      sort_order: existingImages.length,
    }).select().single()

    if (img) {
      setVariants(prev => prev.map(v =>
        v.id === variantId ? { ...v, images: [...v.images, normalizeImage(img)] } : v
      ))
    }
  }

  async function deleteImage(variantId: string, imageId: string, storagePath: string | null): Promise<void> {
    const supabase = createClient()
    if (storagePath) await supabase.storage.from(BUCKET).remove([storagePath])
    await supabase.from('outfit_images').delete().eq('id', imageId)
    setVariants(prev => prev.map(v =>
      v.id === variantId ? { ...v, images: v.images.filter(i => i.id !== imageId) } : v
    ))
  }

  async function reorderImages(variantId: string, orderedIds: string[]): Promise<void> {
    const supabase = createClient()
    setVariants(prev => prev.map(v => {
      if (v.id !== variantId) return v
      const byId = Object.fromEntries(v.images.map(i => [i.id, i]))
      return { ...v, images: orderedIds.map((id, idx) => ({ ...byId[id], sort_order: idx })) }
    }))
    await Promise.all(orderedIds.map((id, idx) =>
      supabase.from('outfit_images').update({ sort_order: idx }).eq('id', id)
    ))
  }

  async function updateOutfitCover(url: string | null, onSynced?: (url: string | null) => void): Promise<void> {
    if (!outfitId) return
    const supabase = createClient()
    const { error } = await supabase.from('outfits').update({ cover_image_url: url }).eq('id', outfitId)
    if (error) { toast.error('Titelbild konnte nicht gesetzt werden'); return }
    setOutfit(prev => prev ? { ...prev, cover_image_url: url } : prev)
    onSynced?.(url)
    toast.success('Titelbild gesetzt')
  }

  return {
    outfit,
    variants,
    loading,
    uploading,
    createVariant,
    updateVariant,
    deleteVariant,
    reorderVariants,
    uploadImages,
    addImageUrl,
    deleteImage,
    reorderImages,
    updateOutfitCover,
    refetch: fetch,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeOutfit(raw: Record<string, unknown>): Outfit {
  return {
    id: raw.id as string,
    user_id: raw.user_id as string,
    name: raw.name as string,
    description: (raw.description as string | null) ?? null,
    tags: (raw.tags as string[]) ?? [],
    cover_image_url: (raw.cover_image_url as string | null) ?? null,
    metadata: (raw.metadata as Record<string, unknown>) ?? {},
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
  }
}

function normalizeVariant(raw: Record<string, unknown>): OutfitVariant {
  const images = ((raw.images as Record<string, unknown>[]) ?? [])
    .map(normalizeImage)
    .sort((a, b) => a.sort_order - b.sort_order)
  return {
    id: raw.id as string,
    outfit_id: raw.outfit_id as string,
    user_id: raw.user_id as string,
    name: raw.name as string,
    description: (raw.description as string | null) ?? null,
    sort_order: (raw.sort_order as number) ?? 0,
    metadata: (raw.metadata as Record<string, unknown>) ?? {},
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
    images,
  }
}

function normalizeImage(raw: Record<string, unknown>): OutfitImage {
  return {
    id: raw.id as string,
    variant_id: raw.variant_id as string,
    user_id: raw.user_id as string,
    url: raw.url as string,
    storage_path: (raw.storage_path as string | null) ?? null,
    sort_order: (raw.sort_order as number) ?? 0,
    created_at: raw.created_at as string,
  }
}

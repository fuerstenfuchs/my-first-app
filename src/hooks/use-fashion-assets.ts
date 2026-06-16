'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { validateMediaFile } from './use-prompt-media'

export const FASHION_CATEGORIES = [
  { key: 'oberteile',       label: 'Oberteile',       emoji: '👕' },
  { key: 'unterteile',      label: 'Unterteile',      emoji: '👖' },
  { key: 'kleider',         label: 'Kleider',          emoji: '👗' },
  { key: 'jacken',          label: 'Jacken',           emoji: '🧥' },
  { key: 'schuhe',          label: 'Schuhe',           emoji: '👞' },
  { key: 'accessoires',     label: 'Accessoires',      emoji: '🕶️' },
  { key: 'kopfbedeckungen', label: 'Kopfbedeckungen',  emoji: '🎩' },
  { key: 'sonstiges',       label: 'Sonstiges',        emoji: '🛍️' },
] as const

export type FashionCategory = typeof FASHION_CATEGORIES[number]['key']

export interface FashionAsset {
  id: string
  user_id: string
  name: string
  description: string | null
  category: FashionCategory
  tags: string[]
  cover_image_url: string | null
  source_url: string | null
  source_title: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface FashionAssetVariant {
  id: string
  asset_id: string
  user_id: string
  name: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
  images: FashionAssetImage[]
}

export interface FashionAssetImage {
  id: string
  variant_id: string
  user_id: string
  url: string
  storage_path: string | null
  sort_order: number
  created_at: string
}

export interface FashionAssetInput {
  name: string
  description?: string
  category: FashionCategory
  tags?: string[]
  cover_image_url?: string | null
  source_url?: string | null
  source_title?: string | null
}

export interface FashionAssetVariantInput {
  name: string
  description?: string
}

interface UploadingEntry {
  id: string
  file: File
  status: 'uploading' | 'done' | 'error'
}

const BUCKET = 'fashion-assets'

// ─── useFashionAssets ────────────────────────────────────────────────────────

export function useFashionAssets() {
  const [assets, setAssets] = useState<FashionAsset[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('fashion_assets')
      .select('*')
      .order('name', { ascending: true })
    if (error) {
      toast.error('Fehler beim Laden der Fashion Assets')
    } else {
      setAssets((data ?? []).map(normalizeAsset))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function createAsset(input: FashionAssetInput, coverFile?: File | null): Promise<FashionAsset | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: asset, error } = await supabase
      .from('fashion_assets')
      .insert({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        category: input.category,
        tags: input.tags ?? [],
        user_id: user.id,
        source_url: input.source_url ?? null,
        source_title: input.source_title ?? null,
        cover_image_url: input.cover_image_url ?? null,
      })
      .select()
      .single()

    if (error || !asset) { toast.error('Asset konnte nicht erstellt werden'); return null }

    if (coverFile) {
      const validation = validateMediaFile(coverFile)
      if (!validation) {
        const ext = coverFile.name.split('.').pop() ?? 'jpg'
        const storagePath = `${user.id}/${asset.id}/cover.${ext}`
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, coverFile)
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
          await supabase.from('fashion_assets').update({ cover_image_url: publicUrl }).eq('id', asset.id)
          asset.cover_image_url = publicUrl
        }
      }
    } else if (input.cover_image_url && !asset.cover_image_url) {
      // External URL provided directly (e.g. from browser extension capture)
      await supabase.from('fashion_assets').update({ cover_image_url: input.cover_image_url }).eq('id', asset.id)
      asset.cover_image_url = input.cover_image_url
    }

    const normalized = normalizeAsset(asset)
    setAssets(prev => [...prev, normalized].sort((a, b) => a.name.localeCompare(b.name)))
    return normalized
  }

  async function updateAsset(id: string, input: FashionAssetInput): Promise<boolean> {
    const supabase = createClient()
    const patch: Record<string, unknown> = {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      category: input.category,
      tags: input.tags ?? [],
    }
    if ('cover_image_url' in input) patch.cover_image_url = input.cover_image_url
    const { data, error } = await supabase
      .from('fashion_assets')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) { toast.error('Aktualisierung fehlgeschlagen'); return false }
    setAssets(prev => prev.map(a => a.id === id ? normalizeAsset(data) : a))
    return true
  }

  async function deleteAsset(id: string): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from('fashion_assets').delete().eq('id', id)
    if (error) { toast.error('Löschen fehlgeschlagen'); return false }
    setAssets(prev => prev.filter(a => a.id !== id))
    return true
  }

  function patchAssetCover(id: string, url: string | null) {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, cover_image_url: url } : a))
  }

  return { assets, loading, createAsset, updateAsset, deleteAsset, patchAssetCover, refetch: fetch }
}

// ─── useFashionAssetDetail ───────────────────────────────────────────────────

export function useFashionAssetDetail(assetId: string | null) {
  const [asset, setAsset] = useState<FashionAsset | null>(null)
  const [variants, setVariants] = useState<FashionAssetVariant[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState<UploadingEntry[]>([])

  const fetch = useCallback(async () => {
    if (!assetId) { setAsset(null); setVariants([]); return }
    setLoading(true)
    const supabase = createClient()
    const [{ data: a, error: aErr }, { data: vars, error: vErr }] = await Promise.all([
      supabase.from('fashion_assets').select('*').eq('id', assetId).single(),
      supabase
        .from('fashion_asset_variants')
        .select('*, images:fashion_asset_images(*)')
        .eq('asset_id', assetId)
        .order('sort_order', { ascending: true }),
    ])
    if (aErr || vErr) {
      toast.error('Fehler beim Laden des Assets')
    } else {
      setAsset(a ? normalizeAsset(a) : null)
      setVariants((vars ?? []).map(normalizeVariant))
    }
    setLoading(false)
  }, [assetId])

  useEffect(() => { fetch() }, [fetch])

  async function createVariant(input: FashionAssetVariantInput): Promise<FashionAssetVariant | null> {
    if (!assetId) return null
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const maxOrder = variants.length > 0 ? Math.max(...variants.map(v => v.sort_order)) : -1
    const { data, error } = await supabase
      .from('fashion_asset_variants')
      .insert({
        asset_id: assetId,
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

  async function updateVariant(variantId: string, input: FashionAssetVariantInput): Promise<boolean> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('fashion_asset_variants')
      .update({ name: input.name.trim(), description: input.description?.trim() || null })
      .eq('id', variantId)
      .select()
      .single()
    if (error) { toast.error('Aktualisierung fehlgeschlagen'); return false }
    setVariants(prev => prev.map(v => v.id === variantId ? normalizeVariant({ ...data, images: v.images }) : v))
    return true
  }

  async function deleteVariant(variantId: string): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from('fashion_asset_variants').delete().eq('id', variantId)
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
      supabase.from('fashion_asset_variants').update({ sort_order: idx }).eq('id', id)
    ))
  }

  async function uploadImages(variantId: string, files: File[]): Promise<void> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !assetId) return

    const entries: UploadingEntry[] = files.map(f => ({
      id: `${Date.now()}-${Math.random()}`, file: f, status: 'uploading',
    }))
    setUploading(prev => [...prev, ...entries])

    const existingImages = variants.find(v => v.id === variantId)?.images ?? []
    let nextOrder = existingImages.length

    for (const entry of entries) {
      const err = validateMediaFile(entry.file)
      if (err) {
        toast.error(err)
        setUploading(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'error' } : e))
        continue
      }
      const ext = entry.file.name.split('.').pop() ?? 'jpg'
      const storagePath = `${user.id}/${assetId}/${variantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, entry.file)
      if (upErr) {
        toast.error(`Upload fehlgeschlagen: ${entry.file.name}`)
        setUploading(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'error' } : e))
        continue
      }
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
      const { data: img } = await supabase.from('fashion_asset_images').insert({
        variant_id: variantId, user_id: user.id, url: publicUrl, storage_path: storagePath, sort_order: nextOrder++,
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
    const { data: img } = await supabase.from('fashion_asset_images').insert({
      variant_id: variantId, user_id: user.id, url, storage_path: null, sort_order: existingImages.length,
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
    await supabase.from('fashion_asset_images').delete().eq('id', imageId)
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
      supabase.from('fashion_asset_images').update({ sort_order: idx }).eq('id', id)
    ))
  }

  async function updateAssetCover(url: string | null, onSynced?: (url: string | null) => void): Promise<void> {
    if (!assetId) return
    const supabase = createClient()
    const { error } = await supabase.from('fashion_assets').update({ cover_image_url: url }).eq('id', assetId)
    if (error) { toast.error('Titelbild konnte nicht gesetzt werden'); return }
    setAsset(prev => prev ? { ...prev, cover_image_url: url } : prev)
    onSynced?.(url)
    toast.success('Titelbild gesetzt')
  }

  return {
    asset, variants, loading, uploading,
    createVariant, updateVariant, deleteVariant, reorderVariants,
    uploadImages, addImageUrl, deleteImage, reorderImages,
    updateAssetCover, refetch: fetch,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeAsset(raw: Record<string, unknown>): FashionAsset {
  return {
    id: raw.id as string,
    user_id: raw.user_id as string,
    name: raw.name as string,
    description: (raw.description as string | null) ?? null,
    category: raw.category as FashionCategory,
    tags: (raw.tags as string[]) ?? [],
    cover_image_url: (raw.cover_image_url as string | null) ?? null,
    source_url: (raw.source_url as string | null) ?? null,
    source_title: (raw.source_title as string | null) ?? null,
    metadata: (raw.metadata as Record<string, unknown>) ?? {},
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
  }
}

function normalizeVariant(raw: Record<string, unknown>): FashionAssetVariant {
  const images = ((raw.images as Record<string, unknown>[]) ?? [])
    .map(normalizeImage)
    .sort((a, b) => a.sort_order - b.sort_order)
  return {
    id: raw.id as string,
    asset_id: raw.asset_id as string,
    user_id: raw.user_id as string,
    name: raw.name as string,
    description: (raw.description as string | null) ?? null,
    sort_order: (raw.sort_order as number) ?? 0,
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
    images,
  }
}

function normalizeImage(raw: Record<string, unknown>): FashionAssetImage {
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

'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'

// ── Categories ────────────────────────────────────────────────────────────────

export const CAMERA_CATEGORIES = [
  { key: 'nah',        label: 'Nahaufnahme',        emoji: '🔭' },
  { key: 'mittel',     label: 'Mittelaufnahme',      emoji: '📐' },
  { key: 'weit',       label: 'Weitwinkel',          emoji: '🌄' },
  { key: 'perspektive',label: 'Perspektive & Winkel',emoji: '🎯' },
  { key: 'sonstiges',  label: 'Sonstiges',           emoji: '📦' },
] as const

export const LIGHTING_CATEGORIES = [
  { key: 'natuerlich', label: 'Natürlich',    emoji: '☀️' },
  { key: 'studio',     label: 'Studio',       emoji: '💡' },
  { key: 'dramatisch', label: 'Dramatisch',   emoji: '🎭' },
  { key: 'urban',      label: 'Neon & Urban', emoji: '🌆' },
  { key: 'warm',       label: 'Warm & Intim', emoji: '🕯️' },
  { key: 'sonstiges',  label: 'Sonstiges',    emoji: '📦' },
] as const

export const EXPRESSION_CATEGORIES = [
  { key: 'alle', label: 'Alle Ausdrücke', emoji: '😊' },
] as const

export const STYLE_CATEGORIES = [
  { key: 'alle', label: 'Alle Stile', emoji: '🎥' },
] as const

export const GRADING_CATEGORIES = [
  { key: 'alle', label: 'Alle Gradings', emoji: '🎨' },
] as const

export type AssetType        = 'camera' | 'lighting' | 'expression' | 'style' | 'grading'
export type CameraCategory   = typeof CAMERA_CATEGORIES[number]['key']
export type LightingCategory = typeof LIGHTING_CATEGORIES[number]['key']
export type ExpressionCategory = typeof EXPRESSION_CATEGORIES[number]['key']
export type StyleCategory    = typeof STYLE_CATEGORIES[number]['key']
export type GradingCategory  = typeof GRADING_CATEGORIES[number]['key']
export type VisualCategory   = CameraCategory | LightingCategory | ExpressionCategory | StyleCategory | GradingCategory

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VisualAsset {
  id:              string
  user_id:         string
  asset_type:      AssetType
  name:            string
  description:     string | null
  prompt:          string | null
  category:        VisualCategory
  tags:            string[]
  cover_image_url: string | null
  source_url:      string | null
  source_title:    string | null
  preset_key:      string | null
  created_at:      string
  updated_at:      string
}

export interface VisualAssetInput {
  asset_type:      AssetType
  name:            string
  description?:    string
  prompt?:         string
  category:        VisualCategory
  tags?:           string[]
  cover_image_url?: string | null
  source_url?:     string | null
  source_title?:   string | null
  preset_key?:     string | null
}

const BUCKET = 'visual-assets'

function normalize(row: Record<string, unknown>): VisualAsset {
  return {
    id:              row.id              as string,
    user_id:         row.user_id         as string,
    asset_type:      row.asset_type      as AssetType,
    name:            row.name            as string,
    description:     (row.description    as string | null) ?? null,
    prompt:          (row.prompt          as string | null) ?? null,
    category:        row.category        as VisualCategory,
    tags:            (row.tags           as string[]) ?? [],
    cover_image_url: (row.cover_image_url as string | null) ?? null,
    source_url:      (row.source_url     as string | null) ?? null,
    source_title:    (row.source_title   as string | null) ?? null,
    preset_key:      (row.preset_key     as string | null) ?? null,
    created_at:      row.created_at      as string,
    updated_at:      row.updated_at      as string,
  }
}

// ── useVisualAssets ───────────────────────────────────────────────────────────

export function useVisualAssets() {
  const [assets, setAssets]   = useState<VisualAsset[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('visual_assets')
      .select('*')
      .order('name', { ascending: true })
    if (error) {
      toast.error('Fehler beim Laden der Assets')
    } else {
      setAssets((data ?? []).map(normalize))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function createAsset(input: VisualAssetInput, coverFile?: File | null): Promise<VisualAsset | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: row, error } = await supabase
      .from('visual_assets')
      .insert({
        user_id:         user.id,
        asset_type:      input.asset_type,
        name:            input.name.trim(),
        description:     input.description?.trim() || null,
        prompt:          input.prompt?.trim() || null,
        category:        input.category,
        tags:            input.tags ?? [],
        cover_image_url: input.cover_image_url ?? null,
        source_url:      input.source_url ?? null,
        source_title:    input.source_title ?? null,
        preset_key:      input.preset_key ?? null,
      })
      .select()
      .single()

    if (error || !row) { toast.error('Asset konnte nicht erstellt werden'); return null }

    if (coverFile) {
      const ext = coverFile.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/${row.id}/cover.${ext}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, coverFile)
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
        await supabase.from('visual_assets').update({ cover_image_url: publicUrl }).eq('id', row.id)
        row.cover_image_url = publicUrl
      }
    }

    const asset = normalize(row)
    setAssets(prev => [...prev, asset].sort((a, b) => a.name.localeCompare(b.name)))
    return asset
  }

  async function updateAsset(id: string, input: Partial<VisualAssetInput>): Promise<boolean> {
    const supabase = createClient()
    const patch: Record<string, unknown> = {}
    if (input.name        !== undefined) patch.name        = input.name.trim()
    if (input.description !== undefined) patch.description = input.description?.trim() || null
    if (input.prompt      !== undefined) patch.prompt      = input.prompt?.trim() || null
    if (input.category    !== undefined) patch.category    = input.category
    if (input.tags        !== undefined) patch.tags        = input.tags
    if ('cover_image_url' in input)      patch.cover_image_url = input.cover_image_url
    if ('source_url'      in input)      patch.source_url  = input.source_url
    if ('source_title'    in input)      patch.source_title = input.source_title

    const { data, error } = await supabase
      .from('visual_assets').update(patch).eq('id', id).select().single()
    if (error) { toast.error('Aktualisierung fehlgeschlagen'); return false }
    setAssets(prev => prev.map(a => a.id === id ? normalize(data) : a))
    return true
  }

  async function deleteAsset(id: string): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from('visual_assets').delete().eq('id', id)
    if (error) { toast.error('Löschen fehlgeschlagen'); return false }
    setAssets(prev => prev.filter(a => a.id !== id))
    return true
  }

  function patchCover(id: string, url: string | null) {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, cover_image_url: url } : a))
  }

  async function uploadCover(id: string, file: File): Promise<string | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${user.id}/${id}/cover.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
    if (error) { toast.error('Upload fehlgeschlagen'); return null }
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
    // Cache-bust: replacing a cover overwrites the same storage path, so the public URL
    // would otherwise stay identical and the browser keeps showing the stale cached image.
    const bustedUrl = `${publicUrl}?v=${Date.now()}`
    await supabase.from('visual_assets').update({ cover_image_url: bustedUrl }).eq('id', id)
    patchCover(id, bustedUrl)
    return bustedUrl
  }

  return { assets, loading, createAsset, updateAsset, deleteAsset, patchCover, uploadCover, refetch: fetch }
}

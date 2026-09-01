'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { STANDARD_SCENE_PRESETS } from '@/lib/scene-presets-standard'
import { EMPTY_PRESET_CONFIG, type ScenePresetConfig } from '@/lib/scene-preset-types'

export interface ScenePreset {
  id:              string
  user_id:         string
  name:            string
  description:     string | null
  category:        string | null
  cover_image_url: string | null
  config:          ScenePresetConfig
  created_at:      string
  updated_at:      string
}

export interface ScenePresetItem {
  id:              string
  name:            string
  description:     string | null
  category:        string | null
  cover_image_url: string | null
  config:          ScenePresetConfig
  isStandard:      boolean
}

export interface ScenePresetInput {
  name:             string
  description?:     string | null
  category?:        string | null
  config:           ScenePresetConfig
  cover_image_url?: string | null
}

const BUCKET = 'visual-assets'
const TABLE  = 'scene_presets'

function normalize(row: Record<string, unknown>): ScenePreset {
  return {
    id:              row.id              as string,
    user_id:         row.user_id         as string,
    name:            row.name            as string,
    description:     (row.description    as string | null) ?? null,
    category:        (row.category       as string | null) ?? null,
    cover_image_url: (row.cover_image_url as string | null) ?? null,
    config:          { ...EMPTY_PRESET_CONFIG, ...(row.config as Partial<ScenePresetConfig> ?? {}) },
    created_at:      row.created_at      as string,
    updated_at:      row.updated_at      as string,
  }
}

function standardToItem(p: typeof STANDARD_SCENE_PRESETS[number]): ScenePresetItem {
  return {
    id: `standard:${p.key}`,
    name: p.name,
    description: p.description,
    category: p.category,
    cover_image_url: null,
    config: p.config,
    isStandard: true,
  }
}

function presetToItem(p: ScenePreset): ScenePresetItem {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    cover_image_url: p.cover_image_url,
    config: p.config,
    isStandard: false,
  }
}

export function useScenePresets() {
  const [presets, setPresets] = useState<ScenePreset[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: true })
    if (error) {
      toast.error('Fehler beim Laden der Presets')
    } else {
      setPresets((data ?? []).map(normalize))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const items = useMemo<ScenePresetItem[]>(() => [
    ...STANDARD_SCENE_PRESETS.map(standardToItem),
    ...presets.map(presetToItem),
  ], [presets])

  async function createPreset(input: ScenePresetInput, coverFile?: File | null): Promise<ScenePreset | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: row, error } = await supabase
      .from(TABLE)
      .insert({
        user_id:     user.id,
        name:        input.name.trim(),
        description: input.description?.trim() || null,
        category:    input.category || null,
        config:      input.config,
        cover_image_url: input.cover_image_url ?? null,
      })
      .select()
      .single()

    if (error || !row) { toast.error('Preset konnte nicht gespeichert werden'); return null }

    if (coverFile) {
      const ext = coverFile.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/presets/${row.id}/cover.${ext}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, coverFile, { upsert: true })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
        const bustedUrl = `${publicUrl}?v=${Date.now()}`
        await supabase.from(TABLE).update({ cover_image_url: bustedUrl }).eq('id', row.id)
        row.cover_image_url = bustedUrl
      }
    }

    const preset = normalize(row)
    setPresets(prev => [...prev, preset])
    return preset
  }

  async function deletePreset(id: string): Promise<boolean> {
    if (id.startsWith('standard:')) return false
    const supabase = createClient()
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) { toast.error('Löschen fehlgeschlagen'); return false }
    setPresets(prev => prev.filter(p => p.id !== id))
    return true
  }

  async function duplicatePreset(item: ScenePresetItem): Promise<ScenePreset | null> {
    return createPreset({
      name: `Kopie von ${item.name}`,
      description: item.description ?? undefined,
      category: item.category ?? undefined,
      config: item.config,
      cover_image_url: item.cover_image_url,
    })
  }

  function exportPreset(item: ScenePresetItem) {
    const payload = {
      name: item.name,
      description: item.description,
      category: item.category,
      config: item.config,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${item.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importPresetFromFile(file: File): Promise<ScenePreset | null> {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as { name?: string; description?: string; category?: string; config?: Partial<ScenePresetConfig> }
      if (!parsed.config) throw new Error('Ungültiges Preset-Format')
      return createPreset({
        name: parsed.name?.trim() || 'Importiertes Preset',
        description: parsed.description,
        category: parsed.category,
        config: { ...EMPTY_PRESET_CONFIG, ...parsed.config },
      })
    } catch {
      toast.error('Preset-Datei konnte nicht gelesen werden')
      return null
    }
  }

  return {
    items, loading, createPreset, deletePreset, duplicatePreset,
    exportPreset, importPresetFromFile, refetch: fetchAll,
  }
}

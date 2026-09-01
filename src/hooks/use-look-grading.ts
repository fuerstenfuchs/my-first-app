'use client'

import { useMemo } from 'react'
import { useVisualAssets, type VisualAsset } from './use-visual-assets'
import { STANDARD_STYLES, STANDARD_GRADINGS, type LookGradingPreset } from '@/lib/look-grading-presets'

export type LookGradingType = 'style' | 'grading'

export interface LookGradingItem {
  id:              string
  name:            string
  description:     string | null
  prompt:          string
  tags:            string[]
  cover_image_url: string | null
  isStandard:      boolean
  presetKey:       string | null
}

export interface LookGradingInput {
  name:         string
  description?: string
  prompt:       string
  tags?:        string[]
}

function presetToItem(p: LookGradingPreset, coverOverride: VisualAsset | undefined): LookGradingItem {
  return {
    id: `standard:${p.key}`,
    name: p.name,
    description: p.description,
    prompt: p.prompt,
    tags: p.tags,
    cover_image_url: coverOverride?.cover_image_url ?? null,
    isStandard: true,
    presetKey: p.key,
  }
}

function assetToItem(a: VisualAsset): LookGradingItem {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    prompt: a.prompt?.trim() || '',
    tags: a.tags,
    cover_image_url: a.cover_image_url,
    isStandard: false,
    presetKey: null,
  }
}

// Merges the fixed Standard-Stile/-Gradings (code constants, no cover image) with the
// user's own custom entries (visual_assets rows with asset_type 'style'/'grading') into
// one unified, generically-shaped list — both render as identical tiles everywhere.
export function useLookGrading() {
  const { assets, loading, createAsset, updateAsset, deleteAsset, uploadCover } = useVisualAssets()

  // Rows with a preset_key are "cover overrides" for a Standard entry, not real custom entries.
  const customStyles   = useMemo(() => assets.filter(a => a.asset_type === 'style'   && !a.preset_key), [assets])
  const customGradings = useMemo(() => assets.filter(a => a.asset_type === 'grading' && !a.preset_key), [assets])

  const styleOverrides   = useMemo(() => new Map(assets.filter(a => a.asset_type === 'style'   && a.preset_key).map(a => [a.preset_key!, a])), [assets])
  const gradingOverrides = useMemo(() => new Map(assets.filter(a => a.asset_type === 'grading' && a.preset_key).map(a => [a.preset_key!, a])), [assets])

  const styles   = useMemo(() => [
    ...STANDARD_STYLES.map(p => presetToItem(p, styleOverrides.get(p.key))),
    ...customStyles.map(assetToItem),
  ], [customStyles, styleOverrides])

  const gradings = useMemo(() => [
    ...STANDARD_GRADINGS.map(p => presetToItem(p, gradingOverrides.get(p.key))),
    ...customGradings.map(assetToItem),
  ], [customGradings, gradingOverrides])

  async function createItem(type: LookGradingType, input: LookGradingInput, coverFile?: File | null): Promise<VisualAsset | null> {
    return createAsset({
      asset_type:  type,
      name:        input.name,
      description: input.description,
      prompt:      input.prompt,
      category:    'alle',
      tags:        input.tags,
    }, coverFile)
  }

  async function updateItem(id: string, input: Partial<LookGradingInput>): Promise<boolean> {
    if (id.startsWith('standard:')) return false
    return updateAsset(id, input)
  }

  async function deleteItem(id: string): Promise<boolean> {
    if (id.startsWith('standard:')) return false
    return deleteAsset(id)
  }

  async function uploadItemCover(id: string, file: File): Promise<string | null> {
    if (id.startsWith('standard:')) return null
    return uploadCover(id, file)
  }

  // Standards have no DB row of their own — the first uploaded cover image creates a
  // minimal "override" row (preset_key set, name/description/prompt unused) just to hold it.
  async function uploadStandardCover(type: LookGradingType, presetKey: string, file: File): Promise<string | null> {
    const overrides = type === 'style' ? styleOverrides : gradingOverrides
    const existing = overrides.get(presetKey)
    if (existing) return uploadCover(existing.id, file)

    const preset = (type === 'style' ? STANDARD_STYLES : STANDARD_GRADINGS).find(p => p.key === presetKey)
    if (!preset) return null
    const created = await createAsset({
      asset_type: type,
      name:       preset.name,
      prompt:     preset.prompt,
      category:   'alle',
      preset_key: presetKey,
    }, file)
    return created?.cover_image_url ?? null
  }

  return { styles, gradings, loading, createItem, updateItem, deleteItem, uploadItemCover, uploadStandardCover }
}

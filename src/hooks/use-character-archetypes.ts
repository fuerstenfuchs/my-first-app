'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { validateMediaFile } from './use-prompt-media'

export interface CharacterArchetypeAttributes {
  geschlecht?:        string
  alter?:              string
  koerperbau?:         string
  groesse?:            string
  haarfarbe?:          string
  haarstil?:           string
  augenfarbe?:         string
  bart?:               string
  hauttyp?:            string
  nationalitaet?:      string
  beruf?:              string
  persoenlichkeit?:    string
  ausstrahlung?:       string
  stimmung?:           string
  besonderheiten?:     string
}

export interface CharacterArchetype {
  id:                string
  user_id:           string
  name:              string
  short_description: string | null
  long_description:  string | null
  prompt:            string | null
  tags:              string[]
  attributes:        CharacterArchetypeAttributes
  cover_image_url:   string | null
  created_at:        string
  updated_at:        string
}

export interface CharacterArchetypeImage {
  id:           string
  archetype_id: string
  user_id:      string
  url:          string
  storage_path: string | null
  sort_order:   number
  created_at:   string
}

export interface CharacterArchetypeInput {
  name:               string
  short_description?: string
  long_description?:  string
  prompt?:            string
  tags?:              string[]
  attributes?:        CharacterArchetypeAttributes
}

interface UploadingEntry {
  id: string
  file: File
  status: 'uploading' | 'done' | 'error'
}

const BUCKET = 'character-archetype-images'
const TABLE  = 'character_archetypes'
const IMAGE_TABLE = 'character_archetype_images'

function normalize(raw: Record<string, unknown>): CharacterArchetype {
  return {
    id:                raw.id as string,
    user_id:           raw.user_id as string,
    name:              raw.name as string,
    short_description: (raw.short_description as string | null) ?? null,
    long_description:  (raw.long_description as string | null) ?? null,
    prompt:            (raw.prompt as string | null) ?? null,
    tags:              (raw.tags as string[]) ?? [],
    attributes:        (raw.attributes as CharacterArchetypeAttributes) ?? {},
    cover_image_url:   (raw.cover_image_url as string | null) ?? null,
    created_at:        raw.created_at as string,
    updated_at:        raw.updated_at as string,
  }
}

function normalizeImage(raw: Record<string, unknown>): CharacterArchetypeImage {
  return {
    id:           raw.id as string,
    archetype_id: raw.archetype_id as string,
    user_id:      raw.user_id as string,
    url:          raw.url as string,
    storage_path: (raw.storage_path as string | null) ?? null,
    sort_order:   (raw.sort_order as number) ?? 0,
    created_at:   raw.created_at as string,
  }
}

// ─── useCharacterArchetypes ─────────────────────────────────────────────────

export function useCharacterArchetypes() {
  const [archetypes, setArchetypes] = useState<CharacterArchetype[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('name', { ascending: true })
    if (error) {
      toast.error('Fehler beim Laden der Character Archetypes')
    } else {
      setArchetypes((data ?? []).map(normalize))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function createArchetype(input: CharacterArchetypeInput): Promise<CharacterArchetype | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: row, error } = await supabase
      .from(TABLE)
      .insert({
        user_id:            user.id,
        name:               input.name.trim(),
        short_description:  input.short_description?.trim() || null,
        long_description:   input.long_description?.trim() || null,
        prompt:              input.prompt?.trim() || null,
        tags:                input.tags ?? [],
        attributes:          input.attributes ?? {},
      })
      .select()
      .single()

    if (error || !row) { toast.error('Archetyp konnte nicht erstellt werden'); return null }

    const archetype = normalize(row)
    setArchetypes(prev => [...prev, archetype].sort((a, b) => a.name.localeCompare(b.name)))
    return archetype
  }

  async function updateArchetype(id: string, input: CharacterArchetypeInput): Promise<boolean> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        name:              input.name.trim(),
        short_description: input.short_description?.trim() || null,
        long_description:  input.long_description?.trim() || null,
        prompt:            input.prompt?.trim() || null,
        tags:              input.tags ?? [],
        attributes:        input.attributes ?? {},
      })
      .eq('id', id)
      .select()
      .single()
    if (error) { toast.error('Aktualisierung fehlgeschlagen'); return false }
    setArchetypes(prev => prev.map(a => a.id === id ? normalize(data) : a))
    return true
  }

  async function deleteArchetype(id: string): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) { toast.error('Löschen fehlgeschlagen'); return false }
    setArchetypes(prev => prev.filter(a => a.id !== id))
    return true
  }

  function patchCover(id: string, url: string | null) {
    setArchetypes(prev => prev.map(a => a.id === id ? { ...a, cover_image_url: url } : a))
  }

  return { archetypes, loading, createArchetype, updateArchetype, deleteArchetype, patchCover, refetch: fetch }
}

// ─── useCharacterArchetypeImages ────────────────────────────────────────────

export function useCharacterArchetypeImages(archetypeId: string | null, onCoverSynced?: (id: string, url: string | null) => void) {
  const [images, setImages] = useState<CharacterArchetypeImage[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState<UploadingEntry[]>([])

  const fetch = useCallback(async () => {
    if (!archetypeId) { setImages([]); return }
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from(IMAGE_TABLE)
      .select('*')
      .eq('archetype_id', archetypeId)
      .order('sort_order', { ascending: true })
    if (error) {
      toast.error('Fehler beim Laden der Referenzbilder')
    } else {
      setImages((data ?? []).map(normalizeImage))
    }
    setLoading(false)
  }, [archetypeId])

  useEffect(() => { fetch() }, [fetch])

  async function syncCoverIfFirst(nextImages: CharacterArchetypeImage[]) {
    if (!archetypeId) return
    const supabase = createClient()
    const newCover = nextImages[0]?.url ?? null
    await supabase.from(TABLE).update({ cover_image_url: newCover }).eq('id', archetypeId)
    onCoverSynced?.(archetypeId, newCover)
  }

  async function uploadImages(files: File[]): Promise<void> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !archetypeId) return

    const entries: UploadingEntry[] = files.map(f => ({
      id: `${Date.now()}-${Math.random()}`, file: f, status: 'uploading',
    }))
    setUploading(prev => [...prev, ...entries])

    let nextOrder = images.length
    let latestImages = images

    for (const entry of entries) {
      const err = validateMediaFile(entry.file)
      if (err) {
        toast.error(err)
        setUploading(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'error' } : e))
        continue
      }
      const ext = entry.file.name.split('.').pop() ?? 'jpg'
      const storagePath = `${user.id}/${archetypeId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, entry.file)
      if (upErr) {
        toast.error(`Upload fehlgeschlagen: ${entry.file.name}`)
        setUploading(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'error' } : e))
        continue
      }
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
      const { data: img } = await supabase.from(IMAGE_TABLE).insert({
        archetype_id: archetypeId, user_id: user.id, url: publicUrl, storage_path: storagePath, sort_order: nextOrder++,
      }).select().single()
      if (img) {
        latestImages = [...latestImages, normalizeImage(img)]
        setImages(latestImages)
      }
      setUploading(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'done' } : e))
    }
    if (latestImages.length !== images.length) await syncCoverIfFirst(latestImages)
    setTimeout(() => setUploading(prev => prev.filter(e => e.status !== 'done')), 2000)
  }

  async function deleteImage(imageId: string, storagePath: string | null): Promise<void> {
    const supabase = createClient()
    if (storagePath) await supabase.storage.from(BUCKET).remove([storagePath])
    await supabase.from(IMAGE_TABLE).delete().eq('id', imageId)
    const next = images.filter(i => i.id !== imageId)
    setImages(next)
    await syncCoverIfFirst(next)
  }

  async function reorderImages(orderedIds: string[]): Promise<void> {
    const supabase = createClient()
    const byId = Object.fromEntries(images.map(i => [i.id, i]))
    const next = orderedIds.map((id, idx) => ({ ...byId[id], sort_order: idx }))
    setImages(next)
    await Promise.all(orderedIds.map((id, idx) =>
      supabase.from(IMAGE_TABLE).update({ sort_order: idx }).eq('id', id)
    ))
    await syncCoverIfFirst(next)
  }

  return { images, loading, uploading, uploadImages, deleteImage, reorderImages, refetch: fetch }
}

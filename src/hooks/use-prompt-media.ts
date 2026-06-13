'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'

export interface PromptMedia {
  id: string
  prompt_id: string
  user_id: string
  type: 'image' | 'video'
  url: string
  sort_order: number
  created_at: string
}

export interface UploadingFile {
  id: string
  file: File
  status: 'uploading' | 'done' | 'error'
  progress: number
  url?: string
  error?: string
}

interface DeferredMedia {
  url: string
  type: 'image' | 'video'
  sort_order: number
}

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
export const IMAGE_MAX = 20 * 1024 * 1024   // 20 MB
export const VIDEO_MAX = 100 * 1024 * 1024  // 100 MB

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url)
}

export function validateMediaFile(file: { type: string; size: number; name: string }): string | null {
  if (IMAGE_TYPES.includes(file.type)) {
    return file.size > IMAGE_MAX ? `${file.name}: Datei zu groß — maximal 20 MB pro Bild` : null
  }
  if (VIDEO_TYPES.includes(file.type)) {
    return file.size > VIDEO_MAX ? `${file.name}: Video zu groß — maximal 100 MB` : null
  }
  return `${file.name}: Format nicht unterstützt`
}

export function usePromptMedia() {
  const [media, setMedia] = useState<PromptMedia[]>([])
  const [uploading, setUploading] = useState<UploadingFile[]>([])
  const [deferredMedia, setDeferredMedia] = useState<DeferredMedia[]>([])

  const fetchMedia = useCallback(async (promptId: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('prompt_media')
      .select('*')
      .eq('prompt_id', promptId)
      .order('sort_order', { ascending: true })
    if (error) {
      toast.error('Fehler beim Laden der Medien')
      return
    }
    setMedia(data ?? [])
  }, [])

  async function uploadFiles(files: File[], promptId: string, deferred = false): Promise<PromptMedia[]> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const validFiles: File[] = []
    for (const file of files) {
      const error = validateMediaFile(file)
      if (error) { toast.error(error); continue }
      validFiles.push(file)
    }

    if (validFiles.length === 0) return []

    const pending: UploadingFile[] = validFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      status: 'uploading',
      progress: 0,
    }))
    setUploading(prev => [...prev, ...pending])

    const currentSortMax = media.length > 0 ? Math.max(...media.map(m => m.sort_order)) : -1
    const results: PromptMedia[] = []

    await Promise.all(
      pending.map(async (item, idx) => {
        const file = item.file
        const isVideo = VIDEO_TYPES.includes(file.type)
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
        const path = `${user.id}/${promptId}/${crypto.randomUUID()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('prompt-media')
          .upload(path, file)

        if (uploadError) {
          setUploading(prev => prev.map(u =>
            u.id === item.id ? { ...u, status: 'error', error: uploadError.message } : u
          ))
          toast.error(`${file.name}: Upload fehlgeschlagen`)
          return
        }

        const { data: { publicUrl } } = supabase.storage
          .from('prompt-media')
          .getPublicUrl(path)

        const sortOrder = currentSortMax + 1 + idx
        const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image'

        if (deferred) {
          // Prompt doesn't exist yet — track locally, commit to DB after save
          setDeferredMedia(prev => [...prev, { url: publicUrl, type: mediaType, sort_order: sortOrder }])
          const tempItem: PromptMedia = {
            id: crypto.randomUUID(),
            prompt_id: promptId,
            user_id: user.id,
            type: mediaType,
            url: publicUrl,
            sort_order: sortOrder,
            created_at: new Date().toISOString(),
          }
          setUploading(prev => prev.map(u =>
            u.id === item.id ? { ...u, status: 'done', progress: 100, url: publicUrl } : u
          ))
          setMedia(prev => [...prev, tempItem])
          results.push(tempItem)
          return
        }

        const { data: mediaRow, error: insertError } = await supabase
          .from('prompt_media')
          .insert({
            prompt_id: promptId,
            user_id: user.id,
            type: mediaType,
            url: publicUrl,
            sort_order: sortOrder,
          })
          .select()
          .single()

        if (insertError) {
          setUploading(prev => prev.map(u =>
            u.id === item.id ? { ...u, status: 'error' } : u
          ))
          toast.error(`${file.name}: Fehler beim Speichern`)
          return
        }

        setUploading(prev => prev.map(u =>
          u.id === item.id ? { ...u, status: 'done', progress: 100, url: publicUrl } : u
        ))
        setMedia(prev => [...prev, mediaRow])
        results.push(mediaRow)
      })
    )

    // Clear done uploads after a short delay
    setTimeout(() => {
      setUploading(prev => prev.filter(u => u.status !== 'done'))
    }, 1500)

    return results
  }

  async function deleteMedia(id: string, url: string): Promise<void> {
    const supabase = createClient()

    // Deferred items are not yet in DB — remove from local state only
    if (deferredMedia.some(d => d.url === url)) {
      setMedia(prev => prev.filter(m => m.id !== id))
      setDeferredMedia(prev => prev.filter(d => d.url !== url))
      return
    }

    // Remove from DB first (optimistic)
    setMedia(prev => prev.filter(m => m.id !== id))

    const { error: dbError } = await supabase
      .from('prompt_media')
      .delete()
      .eq('id', id)

    if (dbError) {
      toast.error('Löschen fehlgeschlagen')
      // Revert — re-fetch to restore consistent state
      return
    }

    // Remove from Storage (best-effort, don't block on this)
    if (url.includes('prompt-media')) {
      const parts = url.split('/prompt-media/')
      if (parts[1]) {
        const filePath = parts[1].split('?')[0]
        await supabase.storage.from('prompt-media').remove([filePath])
      }
    }
  }

  async function reorderMedia(orderedIds: string[]): Promise<void> {
    const supabase = createClient()

    // Optimistic update
    setMedia(prev => {
      const byId = Object.fromEntries(prev.map(m => [m.id, m]))
      return orderedIds.map((id, idx) => ({ ...byId[id], sort_order: idx }))
    })

    // Persist each sort_order
    await Promise.all(
      orderedIds.map((id, idx) =>
        supabase.from('prompt_media').update({ sort_order: idx }).eq('id', id)
      )
    )
  }

  async function setCoverImage(url: string | null, promptId: string): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase
      .from('prompts')
      .update({ cover_image_url: url })
      .eq('id', promptId)
    if (error) toast.error('Cover konnte nicht gesetzt werden')
  }

  async function addMediaUrl(url: string, promptId: string, deferred = false): Promise<PromptMedia | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url)
    const sortMax = media.length > 0 ? Math.max(...media.map(m => m.sort_order)) : -1
    const sortOrder = sortMax + 1
    const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image'

    if (deferred) {
      setDeferredMedia(prev => [...prev, { url, type: mediaType, sort_order: sortOrder }])
      const tempItem: PromptMedia = {
        id: crypto.randomUUID(),
        prompt_id: promptId,
        user_id: user.id,
        type: mediaType,
        url,
        sort_order: sortOrder,
        created_at: new Date().toISOString(),
      }
      setMedia(prev => [...prev, tempItem])
      return tempItem
    }

    const { data, error } = await supabase
      .from('prompt_media')
      .insert({
        prompt_id: promptId,
        user_id: user.id,
        type: mediaType,
        url,
        sort_order: sortOrder,
      })
      .select()
      .single()

    if (error) {
      toast.error('URL konnte nicht hinzugefügt werden')
      return null
    }
    setMedia(prev => [...prev, data])
    return data
  }

  async function commitDeferredMedia(promptId: string): Promise<void> {
    if (deferredMedia.length === 0) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await Promise.all(
      deferredMedia.map(item =>
        supabase.from('prompt_media').insert({
          prompt_id: promptId,
          user_id: user.id,
          type: item.type,
          url: item.url,
          sort_order: item.sort_order,
        })
      )
    )
    setDeferredMedia([])
  }

  function clearMedia() {
    setMedia([])
    setUploading([])
    setDeferredMedia([])
  }

  return { media, uploading, fetchMedia, uploadFiles, deleteMedia, reorderMedia, setCoverImage, addMediaUrl, commitDeferredMedia, clearMedia }
}

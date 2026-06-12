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

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const IMAGE_MAX = 20 * 1024 * 1024
const VIDEO_MAX = 100 * 1024 * 1024

export function usePromptMedia() {
  const [media, setMedia] = useState<PromptMedia[]>([])
  const [uploading, setUploading] = useState<UploadingFile[]>([])

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

  async function uploadFiles(files: File[], promptId: string): Promise<PromptMedia[]> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const validFiles: File[] = []
    for (const file of files) {
      if (IMAGE_TYPES.includes(file.type)) {
        if (file.size > IMAGE_MAX) {
          toast.error(`${file.name}: Datei zu groß — maximal 20 MB pro Bild`)
          continue
        }
      } else if (VIDEO_TYPES.includes(file.type)) {
        if (file.size > VIDEO_MAX) {
          toast.error(`${file.name}: Video zu groß — maximal 100 MB`)
          continue
        }
      } else {
        toast.error(`${file.name}: Format nicht unterstützt`)
        continue
      }
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

        const { data: mediaRow, error: insertError } = await supabase
          .from('prompt_media')
          .insert({
            prompt_id: promptId,
            user_id: user.id,
            type: isVideo ? 'video' : 'image',
            url: publicUrl,
            sort_order: currentSortMax + 1 + idx,
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

  async function addMediaUrl(url: string, promptId: string): Promise<PromptMedia | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url)
    const sortMax = media.length > 0 ? Math.max(...media.map(m => m.sort_order)) : -1

    const { data, error } = await supabase
      .from('prompt_media')
      .insert({
        prompt_id: promptId,
        user_id: user.id,
        type: isVideo ? 'video' : 'image',
        url,
        sort_order: sortMax + 1,
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

  function clearMedia() {
    setMedia([])
    setUploading([])
  }

  return { media, uploading, fetchMedia, uploadFiles, deleteMedia, reorderMedia, setCoverImage, addMediaUrl, clearMedia }
}

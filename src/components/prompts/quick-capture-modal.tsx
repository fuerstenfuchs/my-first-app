'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { QuickImageDrop } from './quick-image-drop'
import { usePromptMedia, IMAGE_TYPES, IMAGE_MAX } from '@/hooks/use-prompt-media'
import type { Prompt } from '@/hooks/use-prompts'

export interface SharePayload {
  content: string
  source_url: string | null
  title: string | null
  media_urls?: string[]
  pending_files?: File[]
}

interface QuickCaptureModalProps {
  isOpen: boolean
  onClose: () => void
  initialValues?: SharePayload | null
}

function isValidUrl(url: string): boolean {
  if (!url.trim()) return true
  try { new URL(url); return true } catch { return false }
}

export function QuickCaptureModal({ isOpen, onClose, initialValues }: QuickCaptureModalProps) {
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceUrlError, setSourceUrlError] = useState('')
  const [saving, setSaving] = useState(false)
  const [contentError, setContentError] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [sharedMediaUrls, setSharedMediaUrls] = useState<string[]>([])
  const draftId = useRef(crypto.randomUUID())
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { media, uploading, uploadFiles, clearMedia } = usePromptMedia()

  const isUploading = uploading.some(u => u.status === 'uploading')

  const dropItems = [
    ...sharedMediaUrls.map((url, i) => ({ id: `share-${i}`, url, status: 'done' as const })),
    ...uploading.map(u => ({ id: u.id, url: u.url, status: u.status })),
    ...media.map(m => ({ id: m.id, url: m.url, status: 'done' as const })),
  ]

  useEffect(() => {
    if (isOpen) {
      setContentError('')
      setSourceUrlError('')
      setIsDirty(false)
      draftId.current = crypto.randomUUID()
      // eslint-disable-next-line react-hooks/exhaustive-deps
      clearMedia()

      if (initialValues) {
        setContent(initialValues.content ?? '')
        setSourceUrl(initialValues.source_url ?? '')
        setSharedMediaUrls(initialValues.media_urls ?? [])
        if (initialValues.title) {
          setTitle(initialValues.title)
        } else if (initialValues.content) {
          setTitle(initialValues.content.trim().slice(0, 55).trimEnd())
        } else if (!initialValues.content && initialValues.source_url) {
          setTitle('Shared Link')
        } else {
          setTitle('')
        }
        setTagsInput('')
        setIsDirty(true)

        // Images shared via Android Share Sheet arrive as File objects from SW cache
        if (initialValues.pending_files && initialValues.pending_files.length > 0) {
          const files = initialValues.pending_files
          setTimeout(() => handleFiles(files), 0)
        }
      } else {
        setContent('')
        setTitle('')
        setTagsInput('')
        setSourceUrl('')
        setSharedMediaUrls([])
        setTimeout(() => textareaRef.current?.focus(), 50)
      }
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  function tryClose() {
    if (!isDirty) { onClose(); return }
    setShowDiscardDialog(true)
  }

  function handleDiscard() {
    setShowDiscardDialog(false)
    onClose()
  }

  const handleFiles = useCallback(async (files: File[]) => {
    const imageFiles: File[] = []
    for (const file of files) {
      if (!IMAGE_TYPES.includes(file.type)) {
        toast.error(`${file.name}: Format nicht unterstützt — nur Bilder erlaubt`)
        continue
      }
      if (file.size > IMAGE_MAX) {
        toast.error(`${file.name}: Datei zu groß — maximal 20 MB pro Bild`)
        continue
      }
      imageFiles.push(file)
    }
    if (imageFiles.length === 0) return
    setIsDirty(true)
    await uploadFiles(imageFiles, draftId.current)
  }, [uploadFiles])

  async function handleSave() {
    if (!content.trim() && !sourceUrl.trim()) {
      setContentError('Prompt-Text oder Quell-Link ist erforderlich')
      return
    }
    if (sourceUrl.trim() && !isValidUrl(sourceUrl.trim())) {
      setSourceUrlError('Bitte eine gültige URL eingeben (z.B. https://…)')
      return
    }
    if (isUploading) return

    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const autoTitle = title.trim() || content.trim().slice(0, 50).trimEnd() || 'Shared Link'
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)

    const { data, error } = await supabase
      .from('prompts')
      .insert({
        id: draftId.current,
        user_id: user.id,
        title: autoTitle,
        content: content.trim(),
        tags,
        description: null,
        source_url: sourceUrl.trim() || null,
        source_type: null,
      })
      .select()
      .single()

    setSaving(false)

    if (error) {
      toast.error('Speichern fehlgeschlagen — bitte erneut versuchen')
      return
    }

    // Persist images that arrived via the share target (already in Storage, link to DB now)
    if (sharedMediaUrls.length > 0) {
      await Promise.all(
        sharedMediaUrls.map((url, idx) =>
          supabase.from('prompt_media').insert({
            prompt_id: draftId.current,
            user_id: user.id,
            type: 'image',
            url,
            sort_order: idx,
          })
        )
      )
    }

    const sharedPreview = sharedMediaUrls.map((url, idx) => ({
      type: 'image' as const,
      url,
      sort_order: idx,
    }))
    const uploadedPreview = media
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m, i) => ({ type: m.type, url: m.url, sort_order: sharedPreview.length + i }))

    const newPrompt: Prompt = {
      ...data,
      source_url: data.source_url ?? null,
      source_type: data.source_type ?? null,
      preview_media: [...sharedPreview, ...uploadedPreview].slice(0, 6),
    }

    window.dispatchEvent(new CustomEvent('quick-capture:saved', { detail: newPrompt }))
    onClose()
  }

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={open => { if (!open) tryClose() }}
      >
        <DialogContent
          className="max-w-lg"
          onInteractOutside={e => { e.preventDefault(); tryClose() }}
          onEscapeKeyDown={e => { e.preventDefault(); tryClose() }}
        >
          <DialogHeader>
            <DialogTitle>Quick Capture</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="qc-content">Prompt-Text</Label>
              <Textarea
                id="qc-content"
                ref={textareaRef}
                value={content}
                onChange={e => {
                  setContent(e.target.value)
                  setContentError('')
                  setIsDirty(true)
                }}
                placeholder="Schreib oder füg deinen Prompt hier ein…"
                rows={5}
                className="resize-none font-mono text-sm"
              />
              {contentError && <p className="text-xs text-destructive">{contentError}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="qc-title">
                Titel{' '}
                <span className="text-muted-foreground font-normal text-xs">
                  (optional — wird aus Prompt-Text generiert)
                </span>
              </Label>
              <Input
                id="qc-title"
                value={title}
                onChange={e => { setTitle(e.target.value); setIsDirty(true) }}
                placeholder='z.B. „Bildgenerator Portrait-Stil"'
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="qc-source">
                Quell-Link{' '}
                <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </Label>
              <Input
                id="qc-source"
                type="url"
                value={sourceUrl}
                onChange={e => { setSourceUrl(e.target.value); setSourceUrlError(''); setIsDirty(true) }}
                placeholder="https://..."
              />
              {sourceUrlError && <p className="text-xs text-destructive">{sourceUrlError}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="qc-tags">
                Tags{' '}
                <span className="text-muted-foreground font-normal text-xs">
                  (optional, Komma-getrennt)
                </span>
              </Label>
              <Input
                id="qc-tags"
                value={tagsInput}
                onChange={e => { setTagsInput(e.target.value); setIsDirty(true) }}
                placeholder="z.B. midjourney, portrait, stil"
              />
            </div>

            <div className="space-y-1">
              <Label>
                Bilder{' '}
                <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </Label>
              <QuickImageDrop
                items={dropItems}
                accept={IMAGE_TYPES.join(',')}
                onFiles={handleFiles}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={tryClose} disabled={saving}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving || isUploading}>
              {saving ? 'Speichern…' : isUploading ? 'Lädt hoch…' : 'Speichern'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quick Capture verwerfen?</AlertDialogTitle>
            <AlertDialogDescription>
              Du hast ungespeicherten Inhalt. Wenn du jetzt schließt, geht er verloren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus>Weiter bearbeiten</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwerfen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

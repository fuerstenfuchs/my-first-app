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

const ANALYZE_MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', note: '~0,003 €/Bild' },
  { id: 'gpt-4.1-mini',              label: 'GPT-4.1 mini', note: '~0,004 €/Bild' },
  { id: 'claude-sonnet-4-6',         label: 'Sonnet 4.6', note: '~0,012 €/Bild' },
  { id: 'gpt-4o',                    label: 'GPT-4o', note: '~0,012 €/Bild' },
] as const

type AnalyzeModelId = typeof ANALYZE_MODELS[number]['id']

export function QuickCaptureModal({ isOpen, onClose, initialValues }: QuickCaptureModalProps) {
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceUrlError, setSourceUrlError] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [personPlaceholder, setPersonPlaceholder] = useState(false)
  const [selectedModel, setSelectedModel] = useState<AnalyzeModelId>(() => {
    if (typeof window === 'undefined') return 'claude-haiku-4-5-20251001'
    return (localStorage.getItem('pdb:analyze-model') as AnalyzeModelId | null) ?? 'claude-haiku-4-5-20251001'
  })
  const [contentError, setContentError] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [sharedMediaUrls, setSharedMediaUrls] = useState<string[]>([])
  const [pendingSharedFiles, setPendingSharedFiles] = useState<File[]>([])
  const [pendingFilePreviewUrls, setPendingFilePreviewUrls] = useState<string[]>([])
  const draftId = useRef(crypto.randomUUID())
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { media, uploadFiles, clearMedia } = usePromptMedia()

  const dropItems = [
    ...sharedMediaUrls.map((url, i) => ({ id: `share-url-${i}`, url, status: 'done' as const })),
    ...pendingFilePreviewUrls.map((url, i) => ({ id: `pending-file-${i}`, url, status: 'done' as const })),
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

      // Revoke any leftover object URLs from a previous open
      setPendingFilePreviewUrls(prev => { prev.forEach(u => URL.revokeObjectURL(u)); return [] })
      setPendingSharedFiles([])

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

        // Images from Android share sheet: show preview immediately,
        // upload happens in handleSave after the prompt row is created
        if (initialValues.pending_files && initialValues.pending_files.length > 0) {
          const files = initialValues.pending_files
          const previews = files.map(f => URL.createObjectURL(f))
          setPendingSharedFiles(files)
          setPendingFilePreviewUrls(previews)
        }
      } else {
        setContent('')
        setTitle('')
        setTagsInput('')
        setSourceUrl('')
        setSharedMediaUrls([])
        setTimeout(() => textareaRef.current?.focus(), 50)
      }
    } else {
      // Revoke object URLs when modal closes to free memory
      setPendingFilePreviewUrls(prev => { prev.forEach(u => URL.revokeObjectURL(u)); return [] })
      setPendingSharedFiles([])
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

  const handleFiles = useCallback((files: File[]) => {
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
    // Store with Object URL preview — actual upload happens in handleSave
    // after the prompt row exists (avoids FK timing issues)
    const previews = imageFiles.map(f => URL.createObjectURL(f))
    setPendingSharedFiles(prev => [...prev, ...imageFiles])
    setPendingFilePreviewUrls(prev => [...prev, ...previews])
    setIsDirty(true)
  }, [])

  const hasImages = pendingFilePreviewUrls.length > 0 || sharedMediaUrls.length > 0 || media.length > 0

  async function handleAnalyzeImage() {
    setAnalyzing(true)
    try {
      let body: { imageUrl?: string; imageBase64?: string; mediaType?: string }

      if (pendingSharedFiles[0]) {
        const file = pendingSharedFiles[0]
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve((reader.result as string).split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        body = { imageBase64: base64, mediaType: file.type }
      } else if (sharedMediaUrls[0]) {
        body = { imageUrl: sharedMediaUrls[0] }
      } else if (media[0]) {
        body = { imageUrl: media[0].url }
      } else {
        return
      }

      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, model: selectedModel, personPlaceholder }),
      })
      if (!res.ok) throw new Error('failed')
      const { prompt } = await res.json() as { prompt: string }
      setContent(prompt)
      if (!title.trim()) setTitle(prompt.trim().slice(0, 55).trimEnd())
      setIsDirty(true)
      toast.success('Prompt generiert!')
    } catch {
      toast.error('Bildanalyse fehlgeschlagen — bitte erneut versuchen')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSave() {
    if (!content.trim() && !sourceUrl.trim()) {
      setContentError('Prompt-Text oder Quell-Link ist erforderlich')
      return
    }
    if (sourceUrl.trim() && !isValidUrl(sourceUrl.trim())) {
      setSourceUrlError('Bitte eine gültige URL eingeben (z.B. https://…)')
      return
    }
    // (no early-return for isUploading — uploads now happen inside handleSave)

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

    // Persist images that arrived via the share target as URLs (already in Storage)
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

    // Upload File objects from Android share sheet — prompt now exists so FK is satisfied
    let pendingUploadedMedia: { type: 'image' | 'video'; url: string; sort_order: number }[] = []
    if (pendingSharedFiles.length > 0) {
      const uploaded = await uploadFiles(pendingSharedFiles, draftId.current)
      pendingUploadedMedia = uploaded.map((m, i) => ({
        type: m.type,
        url: m.url,
        sort_order: sharedMediaUrls.length + i,
      }))
    }

    const sharedPreview = sharedMediaUrls.map((url, idx) => ({
      type: 'image' as const,
      url,
      sort_order: idx,
    }))
    const uploadedPreview = media
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m, i) => ({ type: m.type, url: m.url, sort_order: sharedPreview.length + pendingUploadedMedia.length + i }))

    // Auto-set cover image from first available media so the card shows the image immediately
    const allMedia = [...sharedPreview, ...pendingUploadedMedia, ...uploadedPreview]
    const autoCoverUrl = allMedia[0]?.url ?? null
    if (autoCoverUrl) {
      await supabase.from('prompts').update({ cover_image_url: autoCoverUrl }).eq('id', draftId.current)
    }

    const newPrompt: Prompt = {
      ...data,
      cover_image_url: autoCoverUrl,
      source_url: data.source_url ?? null,
      source_type: data.source_type ?? null,
      preview_media: allMedia.slice(0, 6),
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

            {hasImages && (
              <div className="space-y-2">
                <div className="flex gap-1 flex-wrap">
                  {ANALYZE_MODELS.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      title={m.note}
                      onClick={() => {
                        setSelectedModel(m.id)
                        localStorage.setItem('pdb:analyze-model', m.id)
                      }}
                      className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                        selectedModel === m.id
                          ? 'bg-violet-600 border-violet-600 text-white'
                          : 'border-border text-muted-foreground hover:border-foreground/50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={personPlaceholder}
                    onChange={e => setPersonPlaceholder(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-xs text-muted-foreground">
                    Person als <code className="bg-muted px-1 rounded text-[11px]">[Person]</code> ersetzen
                  </span>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyzeImage}
                  disabled={analyzing || saving}
                  className="w-full gap-2"
                >
                  {analyzing ? (
                    <>
                      <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" />
                      Bild wird analysiert…
                    </>
                  ) : (
                    '✨ Prompt aus Bild generieren'
                  )}
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={tryClose} disabled={saving}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Speichern…' : 'Speichern'}
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

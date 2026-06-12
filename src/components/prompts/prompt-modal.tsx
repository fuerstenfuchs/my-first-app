'use client'

import { useState, useEffect } from 'react'
import { Copy, Heart, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { MediaManager } from '@/components/prompts/media-manager'
import { MediaGallery } from '@/components/prompts/media-gallery'
import { StarRating } from '@/components/prompts/star-rating'
import { usePromptMedia } from '@/hooks/use-prompt-media'
import type { Prompt, PromptInput } from '@/hooks/use-prompts'

type ModalMode = 'view' | 'edit' | 'create'

interface PromptModalProps {
  open: boolean
  onClose: () => void
  prompt: Prompt | null
  mode: ModalMode
  onSave: (input: PromptInput, promptId?: string) => Promise<boolean>
  onCopy?: () => void
  onToggleFavorite?: () => void
  onSetRating?: (rating: number | null) => void
}

export function PromptModal({
  open,
  onClose,
  prompt,
  mode: initialMode,
  onSave,
  onCopy,
  onToggleFavorite,
  onSetRating,
}: PromptModalProps) {
  const [mode, setMode] = useState<ModalMode>(initialMode)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [draftPromptId] = useState<string>(() => crypto.randomUUID())
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({})
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)

  // View-mode media loading
  const { media: viewMedia, fetchMedia: fetchViewMedia } = usePromptMedia()

  useEffect(() => {
    if (open) {
      setMode(initialMode)
      setErrors({})
      setGalleryIndex(null)
      if (prompt) {
        setTitle(prompt.title)
        setContent(prompt.content)
        setDescription(prompt.description ?? '')
        setTagsInput(prompt.tags.join(', '))
        setCoverImageUrl(prompt.cover_image_url)
        if (initialMode === 'view') fetchViewMedia(prompt.id)
      } else {
        setTitle('')
        setContent('')
        setDescription('')
        setTagsInput('')
        setCoverImageUrl(null)
      }
    }
  }, [open, prompt, initialMode]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    const newErrors: { title?: string; content?: string } = {}
    if (!title.trim()) newErrors.title = 'Titel ist erforderlich'
    if (!content.trim()) newErrors.content = 'Prompt-Text ist erforderlich'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setSaving(true)
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    const input: PromptInput = {
      title: title.trim(),
      content: content.trim(),
      description: description.trim() || undefined,
      tags,
      cover_image_url: coverImageUrl,
    }
    // Pass draftPromptId for create mode so media already uploaded links up
    const success = await onSave(input, mode === 'create' ? draftPromptId : undefined)
    setSaving(false)
    if (success) onClose()
  }

  const isForm = mode === 'edit' || mode === 'create'
  const editingPromptId = mode === 'edit' && prompt ? prompt.id : draftPromptId

  const dialogTitle =
    mode === 'create' ? 'Neuer Prompt' : mode === 'edit' ? 'Prompt bearbeiten' : (prompt?.title ?? '')

  return (
    <>
      <Dialog open={open} onOpenChange={o => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-6">{dialogTitle}</DialogTitle>
          </DialogHeader>

          {!isForm && prompt ? (
            <div className="space-y-4">
              {/* Media thumbnail strip */}
              {viewMedia.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {viewMedia.map((m, idx) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setGalleryIndex(idx)}
                      className="shrink-0 w-24 h-16 rounded-md overflow-hidden border border-white/10 hover:border-violet-500 transition-colors bg-black"
                    >
                      {m.type === 'video' ? (
                        <div className="w-full h-full flex items-center justify-center text-white/50 text-lg">▶</div>
                      ) : (
                        <img src={m.url} alt="" className="w-full h-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              {/* Fallback single cover (no prompt_media table yet) */}
              {viewMedia.length === 0 && prompt.cover_image_url && (
                <div
                  className="w-full rounded-lg overflow-hidden border border-border bg-black/40 cursor-pointer"
                  style={{ paddingBottom: '56.25%', position: 'relative' }}
                  onClick={() => setGalleryIndex(0)}
                >
                  <img
                    src={prompt.cover_image_url}
                    alt=""
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                </div>
              )}

              <div className="rounded-md bg-muted p-4">
                <p className="text-sm whitespace-pre-wrap font-mono leading-relaxed">{prompt.content}</p>
              </div>
              {prompt.description && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Beschreibung</p>
                  <p className="text-sm">{prompt.description}</p>
                </div>
              )}
              {prompt.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {prompt.tags.map(tag => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-foreground/70"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{prompt.usage_count}× kopiert</p>
                <div className="flex items-center gap-3">
                  {onSetRating && (
                    <StarRating value={prompt.rating} onChange={onSetRating} size="md" />
                  )}
                  {onToggleFavorite && (
                    <button onClick={onToggleFavorite} className="transition-colors">
                      <Heart
                        className={`h-5 w-5 ${
                          prompt.is_favorite
                            ? 'fill-rose-500 text-rose-500'
                            : 'text-muted-foreground hover:text-rose-400'
                        }`}
                      />
                      <span className="sr-only">Favorit</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="modal-title">Titel *</Label>
                <Input
                  id="modal-title"
                  value={title}
                  onChange={e => { setTitle(e.target.value); setErrors(p => ({ ...p, title: undefined })) }}
                  placeholder='z.B. „Blogpost-Einleitung schreiben"'
                />
                {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="modal-content">Prompt-Text *</Label>
                <Textarea
                  id="modal-content"
                  value={content}
                  onChange={e => { setContent(e.target.value); setErrors(p => ({ ...p, content: undefined })) }}
                  placeholder="Schreib hier deinen Prompt…"
                  rows={6}
                  className="resize-none font-mono text-sm"
                />
                {errors.content && <p className="text-xs text-destructive">{errors.content}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="modal-description">
                  Beschreibung{' '}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="modal-description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Kurze Beschreibung wofür dieser Prompt ist"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="modal-tags">
                  Tags{' '}
                  <span className="text-muted-foreground font-normal">(optional, Komma-getrennt)</span>
                </Label>
                <Input
                  id="modal-tags"
                  value={tagsInput}
                  onChange={e => setTagsInput(e.target.value)}
                  placeholder="z.B. schreiben, blog, deutsch"
                />
              </div>
              <Separator />
              <MediaManager
                promptId={editingPromptId}
                coverImageUrl={coverImageUrl}
                onCoverChange={setCoverImageUrl}
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {!isForm && prompt ? (
              <>
                <Button variant="outline" onClick={onClose}>
                  Schließen
                </Button>
                {onCopy && (
                  <Button variant="outline" onClick={onCopy}>
                    <Copy className="mr-2 h-4 w-4" />
                    Kopieren
                  </Button>
                )}
                <Button onClick={() => setMode('edit')}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Bearbeiten
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={mode === 'edit' ? () => setMode('view') : onClose}
                >
                  Abbrechen
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Speichern…' : 'Speichern'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gallery overlay — outside Dialog to avoid stacking context issues */}
      {galleryIndex !== null && (
        viewMedia.length > 0 ? (
          <MediaGallery
            items={viewMedia}
            initialIndex={galleryIndex}
            onClose={() => setGalleryIndex(null)}
          />
        ) : prompt?.cover_image_url ? (
          <MediaGallery
            items={[{
              id: 'cover',
              prompt_id: prompt.id,
              user_id: '',
              type: 'image',
              url: prompt.cover_image_url,
              sort_order: 0,
              created_at: '',
            }]}
            initialIndex={0}
            onClose={() => setGalleryIndex(null)}
          />
        ) : null
      )}
    </>
  )
}

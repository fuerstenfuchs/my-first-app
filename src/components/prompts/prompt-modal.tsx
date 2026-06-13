'use client'

import { useState, useEffect, useRef } from 'react'
import { Copy, ExternalLink, Heart, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { MediaManager, type MediaManagerHandle } from '@/components/prompts/media-manager'
import { MediaGallery } from '@/components/prompts/media-gallery'
import { StarRating } from '@/components/prompts/star-rating'
import { usePromptMedia } from '@/hooks/use-prompt-media'
import { createClient } from '@/lib/supabase'
import type { Prompt, PromptInput, PromptVariant } from '@/hooks/use-prompts'

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
  onVariantCountChange?: (promptId: string, count: number) => void
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
  onVariantCountChange,
}: PromptModalProps) {
  // ── Core prompt form state ───────────────────────────────────────────────
  const [mode, setMode] = useState<ModalMode>(initialMode)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceUrlError, setSourceUrlError] = useState('')
  const [draftPromptId] = useState<string>(() => crypto.randomUUID())
  const [saving, setSaving] = useState(false)
  const mediaManagerRef = useRef<MediaManagerHandle>(null)
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({})
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)

  // ── Variant state ────────────────────────────────────────────────────────
  const [variants, setVariants] = useState<PromptVariant[]>([])
  const [variantsLoading, setVariantsLoading] = useState(false)
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null)
  const [variantContent, setVariantContent] = useState('')
  const [variantContentDirty, setVariantContentDirty] = useState(false)
  const [variantNameEditing, setVariantNameEditing] = useState(false)
  const [variantNameDraft, setVariantNameDraft] = useState('')
  const [variantSaving, setVariantSaving] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // ── View-mode media loading ──────────────────────────────────────────────
  const { media: viewMedia, fetchMedia: fetchViewMedia } = usePromptMedia()

  // ── Derived ─────────────────────────────────────────────────────────────
  const activeVariant = variants.find(v => v.id === activeVariantId) ?? null
  const hasVariants = variants.length >= 2

  // ── Load variants from Supabase ──────────────────────────────────────────
  async function loadVariants(promptId: string): Promise<PromptVariant[]> {
    setVariantsLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('prompt_variants')
      .select('id, prompt_id, name, content, sort_order, created_at')
      .eq('prompt_id', promptId)
      .order('sort_order', { ascending: true })
    const loaded = (!error && data) ? (data as PromptVariant[]) : []
    setVariants(loaded)
    if (loaded.length > 0) {
      setActiveVariantId(loaded[0].id)
      setVariantContent(loaded[0].content)
      setVariantContentDirty(false)
    }
    setVariantsLoading(false)
    return loaded
  }

  // ── Modal open effect ────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setMode(initialMode)
      setErrors({})
      setSourceUrlError('')
      setGalleryIndex(null)
      // Reset variant state
      setVariants([])
      setActiveVariantId(null)
      setVariantContent('')
      setVariantContentDirty(false)
      setVariantNameEditing(false)
      setShowNewForm(false)
      setNewContent('')
      setNewName('')
      setDeleteConfirmId(null)

      if (prompt) {
        setTitle(prompt.title)
        setContent(prompt.content)
        setDescription(prompt.description ?? '')
        setTagsInput(prompt.tags.join(', '))
        setCoverImageUrl(prompt.cover_image_url)
        setSourceUrl(prompt.source_url ?? '')
        if (initialMode === 'view') {
          fetchViewMedia(prompt.id)
          if (prompt.variant_count > 0) {
            loadVariants(prompt.id)
          }
        }
      } else {
        setTitle('')
        setContent('')
        setDescription('')
        setTagsInput('')
        setCoverImageUrl(null)
        setSourceUrl('')
      }
    }
  }, [open, prompt, initialMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Variant tab switch ───────────────────────────────────────────────────
  function handleSelectVariant(id: string) {
    const v = variants.find(v => v.id === id)
    if (!v) return
    setActiveVariantId(id)
    setVariantContent(v.content)
    setVariantContentDirty(false)
    setVariantNameEditing(false)
  }

  // ── Save variant content ─────────────────────────────────────────────────
  async function handleSaveVariantContent() {
    if (!activeVariantId || !variantContentDirty) return
    setVariantSaving(true)
    try {
      const res = await fetch(`/api/variants/${activeVariantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: variantContent }),
      })
      if (res.ok) {
        setVariants(prev => prev.map(v => v.id === activeVariantId ? { ...v, content: variantContent } : v))
        setVariantContentDirty(false)
        toast.success('Variante gespeichert')
      } else {
        toast.error('Speichern fehlgeschlagen')
      }
    } finally {
      setVariantSaving(false)
    }
  }

  // ── Save variant name ────────────────────────────────────────────────────
  async function handleSaveVariantName() {
    if (!activeVariantId) { setVariantNameEditing(false); return }
    const trimmed = variantNameDraft.trim()
    if (!trimmed) { setVariantNameEditing(false); return }
    try {
      const res = await fetch(`/api/variants/${activeVariantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (res.ok) {
        setVariants(prev => prev.map(v => v.id === activeVariantId ? { ...v, name: trimmed } : v))
        toast.success('Name gespeichert')
      } else {
        toast.error('Umbenennen fehlgeschlagen')
      }
    } finally {
      setVariantNameEditing(false)
    }
  }

  // ── Delete variant ───────────────────────────────────────────────────────
  async function handleDeleteVariant(id: string) {
    try {
      const res = await fetch(`/api/variants/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Löschen fehlgeschlagen'); return }
      const { reverted } = await res.json()
      setDeleteConfirmId(null)
      if (reverted) {
        setVariants([])
        setActiveVariantId(null)
        setVariantContent('')
        setVariantContentDirty(false)
        onVariantCountChange?.(prompt!.id, 0)
        toast.success('Variante gelöscht — Prompt hat wieder einen einzigen Text')
      } else {
        const remaining = variants.filter(v => v.id !== id)
        setVariants(remaining)
        const next = remaining[0]
        setActiveVariantId(next?.id ?? null)
        setVariantContent(next?.content ?? '')
        setVariantContentDirty(false)
        onVariantCountChange?.(prompt!.id, remaining.length)
        toast.success('Variante gelöscht')
      }
    } catch {
      toast.error('Fehler beim Löschen')
    }
  }

  // ── Create new variant ───────────────────────────────────────────────────
  async function handleCreateVariant() {
    if (!prompt || !newContent.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt_id: prompt.id,
          content: newContent.trim(),
          name: newName.trim() || undefined,
        }),
      })
      if (!res.ok) { toast.error('Erstellen fehlgeschlagen'); return }
      const loaded = await loadVariants(prompt.id)
      // Switch to the newly created variant (last = highest sort_order)
      if (loaded.length > 0) {
        const newest = loaded[loaded.length - 1]
        setActiveVariantId(newest.id)
        setVariantContent(newest.content)
      }
      onVariantCountChange?.(prompt.id, loaded.length)
      setShowNewForm(false)
      setNewContent('')
      setNewName('')
      toast.success('Variante erstellt')
    } catch {
      toast.error('Fehler beim Erstellen')
    } finally {
      setCreating(false)
    }
  }

  // ── Prompt form helpers ──────────────────────────────────────────────────
  function isValidUrl(url: string): boolean {
    if (!url.trim()) return true
    try { new URL(url); return true } catch { return false }
  }

  async function handleSave() {
    const newErrors: { title?: string; content?: string } = {}
    if (!title.trim()) newErrors.title = 'Titel ist erforderlich'
    if (!content.trim()) newErrors.content = 'Prompt-Text ist erforderlich'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }
    if (sourceUrl.trim() && !isValidUrl(sourceUrl.trim())) {
      setSourceUrlError('Bitte eine gültige URL eingeben (z.B. https://…)')
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
      source_url: sourceUrl.trim() || null,
    }
    const success = await onSave(input, mode === 'create' ? draftPromptId : undefined)
    if (success && mode === 'create') {
      await mediaManagerRef.current?.commitDeferredMedia()
    }
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

              {/* Variant loading skeleton */}
              {variantsLoading && (
                <div className="h-9 rounded-md bg-muted animate-pulse" />
              )}

              {/* Variant tab strip — shown when ≥2 variants loaded */}
              {!variantsLoading && hasVariants && (
                <div className="flex items-center gap-2">
                  {variants.length <= 4 ? (
                    <Tabs value={activeVariantId ?? ''} onValueChange={handleSelectVariant} className="flex-1 min-w-0">
                      <TabsList className="w-full justify-start h-8">
                        {variants.map(v => (
                          <TabsTrigger key={v.id} value={v.id} className="text-xs h-7 px-2.5">
                            {v.name ?? `Variante ${v.sort_order}`}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  ) : (
                    <Select value={activeVariantId ?? ''} onValueChange={handleSelectVariant}>
                      <SelectTrigger className="flex-1 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {variants.map(v => (
                          <SelectItem key={v.id} value={v.id} className="text-xs">
                            {v.name ?? `Variante ${v.sort_order}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs shrink-0"
                    onClick={() => {
                      setNewContent(variantContent)
                      setShowNewForm(s => !s)
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Neue
                  </Button>
                </div>
              )}

              {/* Active variant panel */}
              {!variantsLoading && hasVariants && activeVariant && !showNewForm && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 min-h-[28px]">
                    {variantNameEditing ? (
                      <Input
                        value={variantNameDraft}
                        onChange={e => setVariantNameDraft(e.target.value)}
                        onBlur={handleSaveVariantName}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveVariantName()
                          if (e.key === 'Escape') setVariantNameEditing(false)
                        }}
                        className="h-7 text-sm flex-1"
                        autoFocus
                      />
                    ) : (
                      <button
                        className="text-sm font-medium hover:text-violet-400 transition-colors flex items-center gap-1.5 text-left"
                        onClick={() => {
                          setVariantNameDraft(activeVariant.name ?? `Variante ${activeVariant.sort_order}`)
                          setVariantNameEditing(true)
                        }}
                      >
                        {activeVariant.name ?? `Variante ${activeVariant.sort_order}`}
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                    <div className="ml-auto flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Variante kopieren"
                        onClick={() =>
                          navigator.clipboard.writeText(variantContent).then(() => toast.success('Kopiert!'))
                        }
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Variante löschen"
                        onClick={() => setDeleteConfirmId(activeVariant.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={variantContent}
                    onChange={e => { setVariantContent(e.target.value); setVariantContentDirty(true) }}
                    rows={6}
                    className="resize-none font-mono text-sm"
                  />
                  {variantContentDirty && (
                    <Button size="sm" onClick={handleSaveVariantContent} disabled={variantSaving}>
                      {variantSaving ? 'Speichern…' : 'Variante speichern'}
                    </Button>
                  )}
                </div>
              )}

              {/* Original content — no variants loaded */}
              {!variantsLoading && !hasVariants && !showNewForm && (
                <div className="rounded-md bg-muted p-4">
                  <p className="text-sm whitespace-pre-wrap font-mono leading-relaxed">{prompt.content}</p>
                </div>
              )}

              {/* New variant form */}
              {!variantsLoading && showNewForm && (
                <div className="rounded-md border border-dashed border-violet-500/50 bg-violet-500/5 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Neue Variante</p>
                  <Input
                    placeholder="Name (optional, z.B. Mit [Person])"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Textarea
                    placeholder="Prompt-Text…"
                    value={newContent}
                    onChange={e => setNewContent(e.target.value)}
                    rows={4}
                    className="resize-none font-mono text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleCreateVariant}
                      disabled={creating || !newContent.trim()}
                    >
                      {creating ? 'Erstellen…' : 'Erstellen'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setShowNewForm(false); setNewContent(''); setNewName('') }}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </div>
              )}

              {/* "+ Neue Variante" subtle link — only when no variants and no form */}
              {!variantsLoading && !hasVariants && !showNewForm && (
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground h-7 px-2"
                    onClick={() => { setNewContent(prompt.content); setShowNewForm(true) }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Neue Variante
                  </Button>
                </div>
              )}

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
              {prompt.source_url && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Quelle</p>
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <a
                      href={prompt.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-violet-400 hover:text-violet-300 transition-colors truncate"
                    >
                      {prompt.source_url}
                    </a>
                  </div>
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
              <div className="space-y-1">
                <Label htmlFor="modal-source">
                  Quell-Link{' '}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="modal-source"
                  type="url"
                  value={sourceUrl}
                  onChange={e => { setSourceUrl(e.target.value); setSourceUrlError('') }}
                  placeholder="https://..."
                />
                {sourceUrlError && <p className="text-xs text-destructive">{sourceUrlError}</p>}
              </div>
              <Separator />
              <MediaManager
                ref={mediaManagerRef}
                promptId={editingPromptId}
                coverImageUrl={coverImageUrl}
                onCoverChange={setCoverImageUrl}
                deferred={mode === 'create'}
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

      {/* Gallery overlay */}
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

      {/* Delete variant confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={o => !o && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Variante löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {variants.length <= 2
                ? 'Dies ist die letzte zusätzliche Variante. Der Prompt kehrt zurück zum einfachen Modus.'
                : 'Diese Variante wird dauerhaft gelöscht.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmId && handleDeleteVariant(deleteConfirmId)}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

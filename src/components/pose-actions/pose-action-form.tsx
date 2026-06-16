'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { POSE_CATEGORIES, type PoseAction, type PoseActionInput, type PoseCategory } from '@/hooks/use-pose-actions'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  poseAction?: PoseAction | null
  defaultCategory?: PoseCategory
  onSave: (input: PoseActionInput, coverFile?: File | null) => Promise<PoseAction | boolean | null>
}

export function PoseActionForm({ open, onClose, poseAction, defaultCategory, onSave }: Props) {
  const isEdit = !!poseAction
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]       = useState<PoseCategory>(defaultCategory ?? 'sonstiges')
  const [tagsRaw, setTagsRaw]         = useState('')
  const [sourceUrl, setSourceUrl]     = useState('')
  const [sourceTitle, setSourceTitle] = useState('')
  const [coverFile, setCoverFile]     = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(poseAction?.name ?? '')
      setDescription(poseAction?.description ?? '')
      setCategory(poseAction?.category ?? defaultCategory ?? 'sonstiges')
      setTagsRaw(poseAction?.tags.join(', ') ?? '')
      setSourceUrl(poseAction?.source_url ?? '')
      setSourceTitle(poseAction?.source_title ?? '')
      setCoverFile(null)
      setCoverPreview(null)
    }
  }, [open, poseAction, defaultCategory])

  useEffect(() => {
    return () => { if (coverPreview) URL.revokeObjectURL(coverPreview) }
  }, [coverPreview])

  function handleFileChange(file: File) {
    setCoverFile(file)
    if (coverPreview) URL.revokeObjectURL(coverPreview)
    setCoverPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const input: PoseActionInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      tags: tagsRaw.split(',').map(t => t.trim()).filter(Boolean),
      source_url: sourceUrl.trim() || null,
      source_title: sourceTitle.trim() || null,
    }
    const result = await onSave(input, coverFile)
    setSaving(false)
    if (result) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Pose / Aktion bearbeiten' : 'Neue Pose / Aktion'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          {/* Category */}
          <div className="space-y-1.5">
            <Label>Kategorie</Label>
            <div className="grid grid-cols-5 gap-1">
              {POSE_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategory(cat.key)}
                  className={cn(
                    'flex flex-col items-center px-1 py-2 rounded-lg border text-[10px] transition-colors',
                    category === cat.key
                      ? 'bg-purple-500/15 border-purple-500/50 text-purple-300'
                      : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                  )}
                >
                  <span className="text-base leading-none">{cat.emoji}</span>
                  <span className="truncate w-full text-center mt-0.5">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="pa-name">Name *</Label>
            <Input
              id="pa-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z.B. Lässig an Wand lehnen, Arme verschränkt"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="pa-desc">Beschreibung</Label>
            <Textarea
              id="pa-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Körperhaltung, Bewegungsrichtung, Ausdruck…"
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="pa-tags">Tags</Label>
            <Input
              id="pa-tags"
              value={tagsRaw}
              onChange={e => setTagsRaw(e.target.value)}
              placeholder="lässig, selbstbewusst, dynamisch, elegant"
            />
          </div>

          {/* Cover image */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Referenzbild <span className="text-muted-foreground font-normal">(optional)</span></Label>
              {coverPreview ? (
                <div className="relative w-full h-32 rounded-xl overflow-hidden border border-border/50 group">
                  <img src={coverPreview} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setCoverFile(null); setCoverPreview(null) }}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-white"
                  >
                    Entfernen
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-20 rounded-xl border-2 border-dashed border-border/40 hover:border-purple-500/40 text-xs text-muted-foreground hover:text-purple-400 transition-colors flex items-center justify-center"
                >
                  Bild auswählen
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(f); e.target.value = '' }} />
            </div>
          )}

          {/* Source */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pa-source-url">Quelle URL</Label>
              <Input id="pa-source-url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://…" type="url" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pa-source-title">Quelle Titel</Label>
              <Input id="pa-source-title" value={sourceTitle} onChange={e => setSourceTitle(e.target.value)} placeholder="Seitenname" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? 'Speichern…' : isEdit ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { Sparkles, Loader2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { LookGradingItem, LookGradingInput, LookGradingType } from '@/hooks/use-look-grading'

interface Props {
  open:      boolean
  onClose:   () => void
  type:      LookGradingType
  item?:     LookGradingItem | null
  onSave:    (input: LookGradingInput, coverFile?: File | null) => Promise<unknown>
}

export function LookGradingForm({ open, onClose, type, item, onSave }: Props) {
  const isEdit = !!item
  const label  = type === 'style' ? 'Stil' : 'Grading'

  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt]           = useState('')
  const [tagsRaw, setTagsRaw]         = useState('')
  const [coverFile, setCoverFile]     = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [aiInput, setAiInput]   = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError]   = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(item?.name ?? '')
      setDescription(item?.description ?? '')
      setPrompt(item?.prompt ?? '')
      setTagsRaw(item?.tags.join(', ') ?? '')
      setCoverFile(null)
      setCoverPreview(null)
      setAiInput('')
      setAiError(null)
    }
  }, [open, item])

  useEffect(() => {
    return () => { if (coverPreview) URL.revokeObjectURL(coverPreview) }
  }, [coverPreview])

  function handleFileChange(file: File) {
    setCoverFile(file)
    if (coverPreview) URL.revokeObjectURL(coverPreview)
    setCoverPreview(URL.createObjectURL(file))
  }

  async function handleGenerate() {
    if (!aiInput.trim()) return
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch('/api/generate-look-grading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, input: aiInput.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      const result = await res.json() as { name?: string; description?: string; prompt?: string; tags?: string[] }
      setName(result.name ?? aiInput.trim())
      setDescription(result.description ?? '')
      setPrompt(result.prompt ?? '')
      setTagsRaw((result.tags ?? []).join(', '))
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'KI-Generierung fehlgeschlagen')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !prompt.trim()) return
    setSaving(true)
    const input: LookGradingInput = {
      name:        name.trim(),
      description: description.trim() || undefined,
      prompt:      prompt.trim(),
      tags:        tagsRaw.split(',').map(t => t.trim()).filter(Boolean),
    }
    const result = await onSave(input, coverFile)
    setSaving(false)
    if (result) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `${label} bearbeiten` : `Neuer ${label}`}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          {/* AI assistant */}
          {!isEdit && (
            <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-3 space-y-2">
              <Label className="flex items-center gap-1.5 text-fuchsia-300">
                <Sparkles className="h-3.5 w-3.5" />
                Mit KI erzeugen
              </Label>
              <div className="flex gap-2">
                <Input
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleGenerate() } }}
                  placeholder={type === 'style' ? 'z.B. Netflix Drama, Herr der Ringe Epic' : 'z.B. 80er VHS, Pastell Traum'}
                  className="h-8 text-sm"
                />
                <Button type="button" size="sm" className="h-8 shrink-0 bg-fuchsia-600 hover:bg-fuchsia-500"
                  onClick={handleGenerate} disabled={aiLoading || !aiInput.trim()}>
                  {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Erzeugen'}
                </Button>
              </div>
              {aiError && (
                <div className="flex items-start gap-1.5 text-[11px] text-destructive">
                  <span className="flex-1">{aiError}</span>
                  <button type="button" onClick={() => setAiError(null)}><X className="h-3 w-3" /></button>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground/50">
                Füllt Name, Beschreibung, Prompt und Tags vor — du kannst danach noch alles bearbeiten.
              </p>
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="lg-name">Name *</Label>
            <Input
              id="lg-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={type === 'style' ? 'z.B. Netflix Drama' : 'z.B. Kodak Gold'}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="lg-desc">Beschreibung</Label>
            <Textarea
              id="lg-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Kurze Notiz zur Bildwirkung…"
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Prompt */}
          <div className="space-y-1.5">
            <Label htmlFor="lg-prompt">Prompt *</Label>
            <Textarea
              id="lg-prompt"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Englischer Prompt-Baustein für die Bild-KI…"
              rows={3}
              className="resize-none font-mono text-xs"
              required
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="lg-tags">Tags</Label>
            <Input
              id="lg-tags"
              value={tagsRaw}
              onChange={e => setTagsRaw(e.target.value)}
              placeholder="cinematic, warm, vintage"
            />
          </div>

          {/* Cover image */}
          <div className="space-y-1.5">
            <Label>Coverbild <span className="text-muted-foreground font-normal">(optional)</span></Label>
            {coverPreview ? (
              <div className="relative w-full h-32 rounded-xl overflow-hidden border border-border/50 bg-muted/30 group">
                <img src={coverPreview} alt="" className="w-full h-full object-contain" />
                <button
                  type="button"
                  onClick={() => { setCoverFile(null); setCoverPreview(null) }}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-white"
                >
                  Entfernen
                </button>
              </div>
            ) : item?.cover_image_url && !coverFile ? (
              <div className="relative w-full h-32 rounded-xl overflow-hidden border border-border/50 bg-muted/30 group">
                <img src={item.cover_image_url} alt="" className="w-full h-full object-contain" />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-white"
                >
                  Ersetzen
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full h-20 rounded-xl border-2 border-dashed border-border/40 hover:border-fuchsia-500/40 text-xs text-muted-foreground hover:text-fuchsia-400 transition-colors flex items-center justify-center"
              >
                Bild auswählen
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(f); e.target.value = '' }} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={saving || !name.trim() || !prompt.trim()} className="bg-fuchsia-600 hover:bg-fuchsia-500">
              {saving ? 'Speichern…' : isEdit ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

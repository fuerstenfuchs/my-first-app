'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Loader2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { LocationArchetype, LocationArchetypeInput } from '@/hooks/use-location-archetypes'

interface Props {
  open:       boolean
  onClose:    () => void
  item?:      LocationArchetype | null
  categories: { key: string; label: string; emoji: string }[]
  defaultCategory?: string
  onSave:     (input: LocationArchetypeInput) => Promise<unknown>
}

export function LocationArchetypeForm({ open, onClose, item, categories, defaultCategory, onSave }: Props) {
  const isEdit = !!item

  const [name, setName]                       = useState('')
  const [category, setCategory]               = useState(defaultCategory ?? 'sonstiges')
  const [shortDescription, setShortDescription] = useState('')
  const [longDescription, setLongDescription]   = useState('')
  const [prompt, setPrompt]                    = useState('')
  const [tagsRaw, setTagsRaw]                  = useState('')
  const [saving, setSaving]                    = useState(false)

  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError]     = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(item?.name ?? '')
      setCategory(item?.category ?? defaultCategory ?? 'sonstiges')
      setShortDescription(item?.short_description ?? '')
      setLongDescription(item?.long_description ?? '')
      setPrompt(item?.prompt ?? '')
      setTagsRaw(item?.tags.join(', ') ?? '')
      setAiError(null)
    }
  }, [open, item])

  async function handleGenerate() {
    if (!name.trim()) return
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch('/api/generate-location-archetype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: name.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      const result = await res.json() as {
        short_description?: string; long_description?: string; prompt?: string; tags?: string[]
      }
      setShortDescription(result.short_description ?? '')
      setLongDescription(result.long_description ?? '')
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
    if (!name.trim()) return
    setSaving(true)
    const input: LocationArchetypeInput = {
      name:               name.trim(),
      category,
      short_description:  shortDescription.trim() || undefined,
      long_description:   longDescription.trim() || undefined,
      prompt:              prompt.trim() || undefined,
      tags:                tagsRaw.split(',').map(t => t.trim()).filter(Boolean),
    }
    const result = await onSave(input)
    setSaving(false)
    if (result) onClose()
  }

  const isBareWord = !isEdit && !!name.trim() && !shortDescription.trim() && !prompt.trim()

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Archetyp bearbeiten' : 'Neuer Archetyp'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="la-name">Name *</Label>
            <div className="flex gap-2">
              <Input
                id="la-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="z.B. Bar, Rooftop, Luxusvilla"
                required
                className="flex-1"
              />
              <Button type="button" size="sm" className="shrink-0 bg-teal-600 hover:bg-teal-500"
                onClick={handleGenerate} disabled={aiLoading || !name.trim()}>
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Sparkles className="mr-1 h-3.5 w-3.5" />Mit KI erweitern</>}
              </Button>
            </div>
            {isBareWord && (
              <p className="text-[11px] text-amber-400/90">
                Ein Archetyp soll nicht nur aus einem einzelnen Wort bestehen — klicke „Mit KI erweitern", um Beschreibung und Prompt automatisch zu erzeugen.
              </p>
            )}
            {aiError && (
              <div className="flex items-start gap-1.5 text-[11px] text-destructive">
                <span className="flex-1">{aiError}</span>
                <button type="button" onClick={() => setAiError(null)}><X className="h-3 w-3" /></button>
              </div>
            )}
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Kategorie</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {categories.map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategory(cat.key)}
                  className={cn(
                    'flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs transition-colors text-left',
                    category === cat.key
                      ? 'bg-teal-500/15 border-teal-500/50 text-teal-300'
                      : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                  )}
                >
                  <span className="text-base leading-none shrink-0">{cat.emoji}</span>
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Short description */}
          <div className="space-y-1.5">
            <Label htmlFor="la-short">Kurze Beschreibung</Label>
            <Textarea
              id="la-short"
              value={shortDescription}
              onChange={e => setShortDescription(e.target.value)}
              placeholder="z.B. Moderne stilvolle Bar mit gemütlicher Atmosphäre."
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Long description */}
          <div className="space-y-1.5">
            <Label htmlFor="la-long">Lange Beschreibung</Label>
            <Textarea
              id="la-long"
              value={longDescription}
              onChange={e => setLongDescription(e.target.value)}
              placeholder="Ausführliche Beschreibung der Atmosphäre und Details…"
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Prompt */}
          <div className="space-y-1.5">
            <Label htmlFor="la-prompt">Prompt</Label>
            <Textarea
              id="la-prompt"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Englischer Prompt-Baustein für die Bild-KI…"
              rows={3}
              className="resize-none font-mono text-xs"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="la-tags">Tags</Label>
            <Input
              id="la-tags"
              value={tagsRaw}
              onChange={e => setTagsRaw(e.target.value)}
              placeholder="bar, cocktail, interior, hospitality, nightlife"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={saving || !name.trim()} className="bg-teal-600 hover:bg-teal-500">
              {saving ? 'Speichern…' : isEdit ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

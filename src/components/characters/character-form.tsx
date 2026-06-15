'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import type { Character, CharacterInput } from '@/hooks/use-characters'

interface Props {
  open: boolean
  onClose: () => void
  character?: Character | null
  onSave: (input: CharacterInput, firstVariantName?: string) => Promise<boolean | Character | null>
}

export function CharacterForm({ open, onClose, character, onSave }: Props) {
  const isEdit = !!character
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [firstVariant, setFirstVariant] = useState('Standard')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(character?.name ?? '')
      setDescription(character?.description ?? '')
      setTags(character?.tags ?? [])
      setTagInput('')
      setFirstVariant('Standard')
    }
  }, [open, character])

  function addTag(raw: string) {
    const t = raw.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const input: CharacterInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      tags,
    }
    const result = await onSave(input, isEdit ? undefined : firstVariant)
    setSaving(false)
    if (result) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-md border-border/60"
        style={{ background: 'linear-gradient(160deg, hsl(142,60%,10%) 0%, hsl(130,20%,6%) 45%, hsl(25,50%,9%) 100%)' } as React.CSSProperties}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Charakter bearbeiten' : 'Neuer Charakter'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="char-name">Name *</Label>
            <Input
              id="char-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z.B. Emma Carter"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="char-desc">Beschreibung</Label>
            <Textarea
              id="char-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Kurze Beschreibung des Charakters…"
              className="resize-none h-20"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="char-tags">Tags</Label>
            <Input
              id="char-tags"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) }
                if (e.key === ',' || e.key === ' ') { e.preventDefault(); addTag(tagInput) }
              }}
              onBlur={() => tagInput.trim() && addTag(tagInput)}
              placeholder="Tag eingeben, Enter drücken"
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                    {tag}
                    <button type="button" onClick={() => setTags(prev => prev.filter(t => t !== tag))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="first-variant">Erste Variante</Label>
              <Input
                id="first-variant"
                value={firstVariant}
                onChange={e => setFirstVariant(e.target.value)}
                placeholder="Standard"
              />
              <p className="text-xs text-muted-foreground">
                Wird automatisch als erste Variante angelegt.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
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

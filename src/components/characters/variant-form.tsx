'use client'

import { useState, useEffect } from 'react'
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
import type { CharacterVariant, VariantInput } from '@/hooks/use-characters'

interface Props {
  open: boolean
  onClose: () => void
  variant?: CharacterVariant | null
  onSave: (input: VariantInput) => Promise<boolean | CharacterVariant | null>
}

export function VariantForm({ open, onClose, variant, onSave }: Props) {
  const isEdit = !!variant
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(variant?.name ?? '')
      setDescription(variant?.description ?? '')
      setPrompt(variant?.prompt ?? '')
    }
  }, [open, variant])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const result = await onSave({ name: name.trim(), description, prompt })
    setSaving(false)
    if (result) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-lg border-border/60"
        style={{ background: 'linear-gradient(160deg, hsl(142,60%,10%) 0%, hsl(130,20%,6%) 45%, hsl(25,50%,9%) 100%)' } as React.CSSProperties}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Variante bearbeiten' : 'Neue Variante'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="var-name">Name *</Label>
            <Input
              id="var-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z.B. Lederhose, Business, Cowboy…"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="var-desc">Beschreibung</Label>
            <Input
              id="var-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Kurze Beschreibung dieser Variante"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="var-prompt">Prompt</Label>
            <Textarea
              id="var-prompt"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Prompt der für diese Variante verwendet wurde…"
              className="resize-none h-28 font-mono text-xs"
            />
          </div>

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

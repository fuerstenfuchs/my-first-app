'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (label: string, emoji: string) => Promise<unknown>
}

export function CustomCategoryDialog({ open, onClose, onSave }: Props) {
  const [label, setLabel] = useState('')
  const [emoji, setEmoji] = useState('📦')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) { setLabel(''); setEmoji('📦') }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    setSaving(true)
    const result = await onSave(label.trim(), emoji.trim() || '📦')
    setSaving(false)
    if (result) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Neue Kategorie</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div className="flex gap-3">
            <div className="space-y-1.5 w-16 shrink-0">
              <Label htmlFor="cat-emoji">Emoji</Label>
              <Input id="cat-emoji" value={emoji} onChange={e => setEmoji(e.target.value)}
                className="text-center text-lg" maxLength={4} />
            </div>
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="cat-label">Name *</Label>
              <Input id="cat-label" value={label} onChange={e => setLabel(e.target.value)}
                placeholder="z.B. Industrie, Wüste, Tempel…" autoFocus required />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={saving || !label.trim()}>
              {saving ? 'Erstelle…' : 'Erstellen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

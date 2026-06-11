'use client'

import { useState, useEffect } from 'react'
import { Copy, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { Textarea } from '@/components/ui/textarea'
import type { Prompt, PromptInput } from '@/hooks/use-prompts'

type ModalMode = 'view' | 'edit' | 'create'

interface PromptModalProps {
  open: boolean
  onClose: () => void
  prompt: Prompt | null
  mode: ModalMode
  onSave: (input: PromptInput) => Promise<boolean>
  onCopy?: () => void
}

export function PromptModal({ open, onClose, prompt, mode: initialMode, onSave, onCopy }: PromptModalProps) {
  const [mode, setMode] = useState<ModalMode>(initialMode)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({})

  useEffect(() => {
    if (open) {
      setMode(initialMode)
      setErrors({})
      if (prompt) {
        setTitle(prompt.title)
        setContent(prompt.content)
        setDescription(prompt.description ?? '')
        setTagsInput(prompt.tags.join(', '))
      } else {
        setTitle('')
        setContent('')
        setDescription('')
        setTagsInput('')
      }
    }
  }, [open, prompt, initialMode])

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
    const success = await onSave({
      title: title.trim(),
      content: content.trim(),
      description: description.trim() || undefined,
      tags,
    })
    setSaving(false)
    if (success) onClose()
  }

  const isForm = mode === 'edit' || mode === 'create'
  const dialogTitle = mode === 'create'
    ? 'Neuer Prompt'
    : mode === 'edit'
    ? 'Prompt bearbeiten'
    : (prompt?.title ?? '')

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6">{dialogTitle}</DialogTitle>
        </DialogHeader>

        {!isForm && prompt ? (
          <div className="space-y-4">
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
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{prompt.usage_count}× kopiert</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="title">Titel *</Label>
              <Input
                id="title"
                value={title}
                onChange={e => { setTitle(e.target.value); setErrors(p => ({ ...p, title: undefined })) }}
                placeholder='z.B. „Blogpost-Einleitung schreiben"'
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="content">Prompt-Text *</Label>
              <Textarea
                id="content"
                value={content}
                onChange={e => { setContent(e.target.value); setErrors(p => ({ ...p, content: undefined })) }}
                placeholder="Schreib hier deinen Prompt…"
                rows={8}
                className="resize-none font-mono text-sm"
              />
              {errors.content && <p className="text-xs text-destructive">{errors.content}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">
                Beschreibung <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Kurze Beschreibung wofür dieser Prompt ist"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tags">
                Tags <span className="text-muted-foreground font-normal">(optional, Komma-getrennt)</span>
              </Label>
              <Input
                id="tags"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="z.B. schreiben, blog, deutsch"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {!isForm && prompt ? (
            <>
              <Button variant="outline" onClick={onClose}>Schließen</Button>
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
  )
}

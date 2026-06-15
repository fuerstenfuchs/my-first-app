'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Upload } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import type { CharacterVariant, VariantInput } from '@/hooks/use-characters'

interface Props {
  open: boolean
  onClose: () => void
  variant?: CharacterVariant | null
  onSave: (input: VariantInput, files: File[]) => Promise<boolean | CharacterVariant | null>
}

export function VariantForm({ open, onClose, variant, onSave }: Props) {
  const isEdit = !!variant
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(variant?.name ?? '')
      setDescription(variant?.description ?? '')
      setPrompt(variant?.prompt ?? '')
      setFiles([])
      setPreviews([])
    }
  }, [open, variant])

  // Clean up preview object URLs on unmount / change
  useEffect(() => {
    return () => { previews.forEach(p => URL.revokeObjectURL(p)) }
  }, [previews])

  const addFiles = useCallback((incoming: File[]) => {
    const images = incoming.filter(f => f.type.startsWith('image/'))
    if (images.length === 0) return
    setFiles(prev => [...prev, ...images])
    setPreviews(prev => [...prev, ...images.map(f => URL.createObjectURL(f))])
  }, [])

  function removeFile(idx: number) {
    URL.revokeObjectURL(previews[idx])
    setFiles(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const result = await onSave({ name: name.trim(), description, prompt }, files)
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
              className="resize-none h-24 font-mono text-xs"
            />
          </div>

          {/* Image upload — only on create */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Bilder <span className="text-muted-foreground font-normal">(optional)</span></Label>

              <div
                className={cn(
                  'rounded-lg border-2 border-dashed transition-colors p-3 cursor-pointer',
                  isDragOver ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 hover:border-white/20',
                )}
                onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Upload className="h-4 w-4 shrink-0" />
                  <span className="text-xs">Bilder hierher ziehen oder klicken zum Auswählen</span>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onClick={e => e.stopPropagation()}
                  onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }}
                />
              </div>

              {/* Previews */}
              {previews.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {previews.map((src, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-md overflow-hidden border border-white/10 group">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      >
                        <X className="h-4 w-4 text-white" />
                      </button>
                      {idx === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 text-[9px] text-center bg-amber-500/80 text-black font-semibold py-0.5">
                          Cover
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving
                ? (files.length > 0 ? `Erstellen & ${files.length} Bild${files.length > 1 ? 'er' : ''} hochladen…` : 'Speichern…')
                : isEdit ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

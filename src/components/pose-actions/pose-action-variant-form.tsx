'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { PoseActionVariant, PoseActionVariantInput } from '@/hooks/use-pose-actions'

interface Props {
  open: boolean
  onClose: () => void
  variant?: PoseActionVariant | null
  defaultName?: string
  onSave: (input: PoseActionVariantInput, files: File[]) => Promise<boolean | PoseActionVariant | null>
}

export function PoseActionVariantForm({ open, onClose, variant, defaultName, onSave }: Props) {
  const isEdit = !!variant
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles]             = useState<File[]>([])
  const [previews, setPreviews]       = useState<string[]>([])
  const [isDragOver, setIsDragOver]   = useState(false)
  const [saving, setSaving]           = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(variant?.name ?? defaultName ?? '')
      setDescription(variant?.description ?? '')
      setFiles([])
      setPreviews([])
    }
  }, [open, variant, defaultName])

  useEffect(() => {
    return () => { previews.forEach(p => URL.revokeObjectURL(p)) }
  }, [previews])

  const addFiles = useCallback((incoming: File[]) => {
    const images = incoming.filter(f => f.type.startsWith('image/'))
    if (!images.length) return
    setFiles(prev => [...prev, ...images])
    setPreviews(prev => [...prev, ...images.map(f => URL.createObjectURL(f))])
  }, [])

  function removeFile(idx: number) {
    URL.revokeObjectURL(previews[idx])
    setFiles(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const result = await onSave({ name: name.trim(), description }, files)
    setSaving(false)
    if (result) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Variante bearbeiten' : 'Neue Variante'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="pav-name">Name *</Label>
            <Input
              id="pav-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z.B. Langsam, Schnell, Elegant, Selbstbewusst…"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pav-desc">Beschreibung</Label>
            <Input
              id="pav-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Kurze Beschreibung dieser Variante"
            />
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Bilder <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <div
                className={cn(
                  'rounded-lg border-2 border-dashed transition-colors p-3 cursor-pointer',
                  isDragOver ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 hover:border-white/20',
                )}
                onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={e => { e.preventDefault(); setIsDragOver(false); addFiles(Array.from(e.dataTransfer.files)) }}
                onClick={() => fileRef.current?.click()}
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Upload className="h-4 w-4 shrink-0" />
                  <span className="text-xs">Bilder hierher ziehen oder klicken</span>
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
              {previews.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {previews.map((src, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-md overflow-hidden border border-white/10 group">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeFile(idx)}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <X className="h-4 w-4 text-white" />
                      </button>
                      {idx === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 text-[9px] text-center bg-purple-500/80 text-white font-semibold py-0.5">Cover</div>
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

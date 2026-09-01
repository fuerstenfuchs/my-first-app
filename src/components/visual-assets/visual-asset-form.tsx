'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  CAMERA_CATEGORIES, LIGHTING_CATEGORIES, EXPRESSION_CATEGORIES,
  type VisualAsset, type VisualAssetInput, type AssetType, type VisualCategory,
} from '@/hooks/use-visual-assets'
import { cn } from '@/lib/utils'

interface Props {
  open:         boolean
  onClose:      () => void
  asset?:       VisualAsset | null
  assetType:    AssetType
  defaultCategory?: VisualCategory
  onSave:       (input: VisualAssetInput, coverFile?: File | null) => Promise<VisualAsset | boolean | null>
}

export function VisualAssetForm({ open, onClose, asset, assetType, defaultCategory, onSave }: Props) {
  const isEdit     = !!asset
  const categories = assetType === 'camera' ? CAMERA_CATEGORIES : assetType === 'lighting' ? LIGHTING_CATEGORIES : EXPRESSION_CATEGORIES
  const label      = assetType === 'camera' ? 'Kamera-Shot' : assetType === 'lighting' ? 'Licht-Stil' : 'Gesichtsausdruck'
  const showCategoryPicker = categories.length > 1

  const [name, setName]           = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]   = useState<VisualCategory>(defaultCategory ?? categories[0].key)
  const [tagsRaw, setTagsRaw]     = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceTitle, setSourceTitle] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(asset?.name ?? '')
      setDescription(asset?.description ?? '')
      setCategory(asset?.category ?? defaultCategory ?? categories[0].key)
      setTagsRaw(asset?.tags.join(', ') ?? '')
      setSourceUrl(asset?.source_url ?? '')
      setSourceTitle(asset?.source_title ?? '')
      setCoverFile(null)
      setCoverPreview(null)
    }
  }, [open, asset, defaultCategory, categories])

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
    const input: VisualAssetInput = {
      asset_type:  assetType,
      name:        name.trim(),
      description: description.trim() || undefined,
      category,
      tags:        tagsRaw.split(',').map(t => t.trim()).filter(Boolean),
      source_url:  sourceUrl.trim() || null,
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
          <DialogTitle>{isEdit ? `${label} bearbeiten` : `Neuer ${label}`}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          {/* Category */}
          {showCategoryPicker && (
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
                        ? 'bg-sky-500/15 border-sky-500/50 text-sky-300'
                        : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                    )}
                  >
                    <span className="text-base leading-none shrink-0">{cat.emoji}</span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="va-name">Name *</Label>
            <Input
              id="va-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={assetType === 'camera' ? 'z.B. Extreme Close-Up, Dutch Angle' : assetType === 'lighting' ? 'z.B. Golden Hour, Neon' : 'z.B. Neutral, Freundliches Lächeln'}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="va-desc">Beschreibung</Label>
            <Textarea
              id="va-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={assetType === 'camera' ? 'Kamera-Einstellung, Bildwirkung…' : assetType === 'lighting' ? 'Lichtstimmung, Farbtemperatur, Wirkung…' : 'Mimik, Stimmung…'}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="va-tags">Tags</Label>
            <Input
              id="va-tags"
              value={tagsRaw}
              onChange={e => setTagsRaw(e.target.value)}
              placeholder={assetType === 'camera' ? 'cinematic, tight, detail' : assetType === 'lighting' ? 'warm, golden, soft' : 'happy, calm, intense'}
            />
          </div>

          {/* Cover image */}
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
            ) : asset?.cover_image_url && !coverFile ? (
              <div className="relative w-full h-32 rounded-xl overflow-hidden border border-border/50 group">
                <img src={asset.cover_image_url} alt="" className="w-full h-full object-cover" />
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
                className="w-full h-20 rounded-xl border-2 border-dashed border-border/40 hover:border-sky-500/40 text-xs text-muted-foreground hover:text-sky-400 transition-colors flex items-center justify-center"
              >
                Bild auswählen
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(f); e.target.value = '' }} />
          </div>

          {/* Source */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="va-source-url">Quelle URL</Label>
              <Input id="va-source-url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://…" type="url" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="va-source-title">Quelle Titel</Label>
              <Input id="va-source-title" value={sourceTitle} onChange={e => setSourceTitle(e.target.value)} placeholder="Seitenname" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={saving || !name.trim()} className="bg-sky-600 hover:bg-sky-500">
              {saving ? 'Speichern…' : isEdit ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

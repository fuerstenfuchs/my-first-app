'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ImagePlus } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  FASHION_CATEGORIES, type FashionAsset, type FashionAssetInput, type FashionCategory,
} from '@/hooks/use-fashion-assets'

interface Props {
  open: boolean
  onClose: () => void
  asset?: FashionAsset | null
  defaultCategory?: FashionCategory
  onSave: (input: FashionAssetInput, coverFile?: File | null) => Promise<boolean | FashionAsset | null>
}

export function FashionAssetForm({ open, onClose, asset, defaultCategory, onSave }: Props) {
  const isEdit = !!asset

  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]       = useState<FashionCategory>(defaultCategory ?? 'oberteile')
  const [tagInput, setTagInput]       = useState('')
  const [tags, setTags]               = useState<string[]>([])
  const [coverFile, setCoverFile]     = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(asset?.name ?? '')
      setDescription(asset?.description ?? '')
      setCategory(asset?.category ?? defaultCategory ?? 'oberteile')
      setTags(asset?.tags ?? [])
      setTagInput('')
      if (coverPreview) URL.revokeObjectURL(coverPreview)
      setCoverFile(null)
      setCoverPreview(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, asset, defaultCategory])

  function setFile(f: File | null) {
    if (coverPreview) URL.revokeObjectURL(coverPreview)
    setCoverFile(f)
    setCoverPreview(f ? URL.createObjectURL(f) : null)
  }

  function addTag(raw: string) {
    const t = raw.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const input: FashionAssetInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      tags,
    }
    const result = await onSave(input, coverFile)
    setSaving(false)
    if (result) { setFile(null); onClose() }
  }

  const selectedCat = FASHION_CATEGORIES.find(c => c.key === category)

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-lg border-border/60"
        style={{ background: 'linear-gradient(160deg, hsl(330,40%,9%) 0%, hsl(300,15%,7%) 50%, hsl(240,20%,8%) 100%)' } as React.CSSProperties}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Asset bearbeiten' : 'Neues Fashion Asset'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Category */}
          <div className="space-y-1.5">
            <Label>Kategorie *</Label>
            <div className="flex flex-wrap gap-1.5">
              {FASHION_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategory(cat.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                    category === cat.key
                      ? 'bg-rose-500/20 border-rose-500/60 text-rose-300'
                      : 'bg-white/5 border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground'
                  )}
                >
                  <span>{cat.emoji}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="fa-name">
              Name * <span className="text-muted-foreground font-normal text-xs">{selectedCat && `(${selectedCat.label})`}</span>
            </Label>
            <Input
              id="fa-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={
                category === 'oberteile' ? 'z.B. Weißes Hemd, Schwarzes T-Shirt…' :
                category === 'unterteile' ? 'z.B. Jeans, Lederhose…' :
                category === 'kleider' ? 'z.B. Sommerkleid, Abendkleid…' :
                category === 'jacken' ? 'z.B. Lederjacke, Blazer…' :
                category === 'schuhe' ? 'z.B. Sneaker, High Heels…' :
                category === 'accessoires' ? 'z.B. Sonnenbrille, Uhr…' :
                'z.B. Cowboyhut, Basecap…'
              }
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="fa-desc">Beschreibung</Label>
            <Textarea
              id="fa-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Kurze Beschreibung dieses Assets…"
              className="resize-none h-16"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="fa-tags">Tags</Label>
            <Input
              id="fa-tags"
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
              <div className="flex flex-wrap gap-1.5 mt-1">
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

          {/* Cover image */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Titelbild <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <div
                className={cn(
                  'relative aspect-video rounded-lg border-2 border-dashed cursor-pointer overflow-hidden transition-colors',
                  coverPreview ? 'border-rose-500/40' : 'border-white/10 hover:border-white/25 bg-white/5'
                )}
                onClick={() => fileRef.current?.click()}
              >
                {coverPreview ? (
                  <>
                    <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setFile(null) }}
                      className="absolute top-2 right-2 bg-black/60 rounded-full p-1 hover:bg-black/80"
                    >
                      <X className="h-3.5 w-3.5 text-white" />
                    </button>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground/40">
                    <ImagePlus className="h-7 w-7" />
                    <span className="text-xs">Klicken oder Bild hierher ziehen</span>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={e => { setFile(e.target.files?.[0] ?? null); e.target.value = '' }}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? (coverFile ? 'Erstellen & Bild hochladen…' : 'Erstellen…') : isEdit ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

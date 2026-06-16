'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LOCATION_CATEGORIES, LOCATION_TYPES, type Location, type LocationInput, type LocationCategory, type LocationType } from '@/hooks/use-locations'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  location?: Location | null
  defaultCategory?: LocationCategory
  onSave: (input: LocationInput, coverFile?: File | null) => Promise<Location | boolean | null>
}

export function LocationForm({ open, onClose, location, defaultCategory, onSave }: Props) {
  const isEdit = !!location
  const [name, setName]             = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]     = useState<LocationCategory>(defaultCategory ?? 'sonstiges')
  const [locationType, setLocationType] = useState<LocationType | null>(null)
  const [tagsRaw, setTagsRaw]       = useState('')
  const [sourceUrl, setSourceUrl]   = useState('')
  const [sourceTitle, setSourceTitle] = useState('')
  const [coverFile, setCoverFile]   = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(location?.name ?? '')
      setDescription(location?.description ?? '')
      setCategory(location?.category ?? defaultCategory ?? 'sonstiges')
      setLocationType(location?.location_type ?? null)
      setTagsRaw(location?.tags.join(', ') ?? '')
      setSourceUrl(location?.source_url ?? '')
      setSourceTitle(location?.source_title ?? '')
      setCoverFile(null)
      setCoverPreview(null)
    }
  }, [open, location, defaultCategory])

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
    const input: LocationInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      location_type: locationType,
      tags: tagsRaw.split(',').map(t => t.trim()).filter(Boolean),
      source_url: sourceUrl.trim() || null,
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
          <DialogTitle>{isEdit ? 'Location bearbeiten' : 'Neue Location'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          {/* Category */}
          <div className="space-y-1.5">
            <Label>Kategorie</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {LOCATION_CATEGORIES.map(cat => (
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

          {/* Location Type */}
          <div className="space-y-1.5">
            <Label>
              Location-Typ
              <span className="ml-1.5 text-muted-foreground font-normal text-[11px]">(optional)</span>
            </Label>
            <div className="grid grid-cols-4 gap-1">
              {LOCATION_TYPES.map(lt => (
                <button
                  key={lt.key}
                  type="button"
                  onClick={() => setLocationType(locationType === lt.key ? null : lt.key)}
                  title={lt.description}
                  className={cn(
                    'flex flex-col items-center px-1 py-1.5 rounded-lg border text-[10px] transition-colors',
                    locationType === lt.key
                      ? 'bg-teal-500/15 border-teal-500/50 text-teal-300'
                      : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                  )}
                >
                  <span className="text-base leading-none shrink-0">{lt.emoji}</span>
                  <span className="truncate w-full text-center mt-0.5 leading-tight">{lt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="loc-name">Name *</Label>
            <Input
              id="loc-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z.B. Reeperbahn Hamburg, Times Square New York"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="loc-desc">Beschreibung</Label>
            <Textarea
              id="loc-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Atmosphäre, Lichtstimmung, Besonderheiten…"
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="loc-tags">Tags</Label>
            <Input
              id="loc-tags"
              value={tagsRaw}
              onChange={e => setTagsRaw(e.target.value)}
              placeholder="nacht, regen, neon, urban, cinematic"
            />
          </div>

          {/* Cover image */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Cover-Bild <span className="text-muted-foreground font-normal">(optional)</span></Label>
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
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-20 rounded-xl border-2 border-dashed border-border/40 hover:border-teal-500/40 text-xs text-muted-foreground hover:text-teal-400 transition-colors flex items-center justify-center"
                >
                  Bild auswählen
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(f); e.target.value = '' }} />
            </div>
          )}

          {/* Source */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="loc-source-url">Quelle URL</Label>
              <Input id="loc-source-url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://…" type="url" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-source-title">Quelle Titel</Label>
              <Input id="loc-source-title" value={sourceTitle} onChange={e => setSourceTitle(e.target.value)} placeholder="Seitenname" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
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

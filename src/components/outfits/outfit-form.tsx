'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
import type { Outfit, OutfitInput, InitialOutfitSlot } from '@/hooks/use-outfits'
import {
  OUTFIT_KATEGORIEN, OUTFIT_KATEGORIE_STANDARD, type OutfitKategorie,
} from '@/lib/outfit-kategorien'
import { FORMULAR_SLOTS } from '@/lib/outfit-kette'

/**
 * Die vier Slots stehen seit PROJ-54 in `@/lib/outfit-kette` und nicht mehr
 * hier: Die Referenzkette darf mit keinem von ihnen denselben Variantennamen
 * benutzen, sonst hielte sie ein von Hand hochgeladenes Foto für ein erzeugtes
 * Blatt. Nur wenn beide Listen an EINEM Ort liegen, kann ein Test sie
 * gegeneinander halten, ohne eine davon abzuschreiben.
 */
const PREDEFINED_SLOTS = FORMULAR_SLOTS

type SlotKey = typeof PREDEFINED_SLOTS[number]['key']

interface Props {
  open: boolean
  onClose: () => void
  outfit?: Outfit | null
  /** Womit die Auswahl startet — die gerade geöffnete Kategorie der Seite. */
  defaultCategory?: OutfitKategorie
  onSave: (input: OutfitInput, slots: InitialOutfitSlot[]) => Promise<boolean | Outfit | null>
}

/** Beispielnamen je Kategorie — aus dem Fashion-Formular übernommen. */
const NAME_BEISPIEL: Record<OutfitKategorie, string> = {
  komplett:        'z.B. Schlager-Auftritt, Business, Cowboy…',
  oberteile:       'z.B. Weißes Hemd, Schwarzes T-Shirt…',
  unterteile:      'z.B. Jeans, Lederhose…',
  kleider:         'z.B. Sommerkleid, Abendkleid…',
  jacken:          'z.B. Lederjacke, Blazer…',
  schuhe:          'z.B. Sneaker, High Heels…',
  accessoires:     'z.B. Sonnenbrille, Uhr…',
  kopfbedeckungen: 'z.B. Cowboyhut, Basecap…',
  sonstiges:       'z.B. Gürtel, Schal…',
}

export function OutfitForm({ open, onClose, outfit, defaultCategory, onSave }: Props) {
  const isEdit = !!outfit

  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]       = useState<OutfitKategorie>(defaultCategory ?? OUTFIT_KATEGORIE_STANDARD)
  const [tagInput, setTagInput]       = useState('')
  const [tags, setTags]               = useState<string[]>([])
  const [saving, setSaving]           = useState(false)

  const [slotFiles, setSlotFiles]       = useState<Record<SlotKey, File | null>>({ vorne: null, seite: null, hinten: null, detail: null })
  const [slotPreviews, setSlotPreviews] = useState<Record<SlotKey, string | null>>({ vorne: null, seite: null, hinten: null, detail: null })

  const fileRefs = {
    vorne:  useRef<HTMLInputElement>(null),
    seite:  useRef<HTMLInputElement>(null),
    hinten: useRef<HTMLInputElement>(null),
    detail: useRef<HTMLInputElement>(null),
  }

  useEffect(() => {
    if (open) {
      setName(outfit?.name ?? '')
      setDescription(outfit?.description ?? '')
      setCategory(outfit?.category ?? defaultCategory ?? OUTFIT_KATEGORIE_STANDARD)
      setTags(outfit?.tags ?? [])
      setTagInput('')
      clearSlots()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, outfit, defaultCategory])

  function clearSlots() {
    Object.values(slotPreviews).forEach(u => u && URL.revokeObjectURL(u))
    setSlotFiles({ vorne: null, seite: null, hinten: null, detail: null })
    setSlotPreviews({ vorne: null, seite: null, hinten: null, detail: null })
  }

  const setSlot = useCallback((key: SlotKey, file: File | null) => {
    setSlotPreviews(prev => {
      if (prev[key]) URL.revokeObjectURL(prev[key]!)
      return { ...prev, [key]: file ? URL.createObjectURL(file) : null }
    })
    setSlotFiles(prev => ({ ...prev, [key]: file }))
  }, [])

  function addTag(raw: string) {
    const t = raw.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const input: OutfitInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      tags,
    }

    const slots: InitialOutfitSlot[] = PREDEFINED_SLOTS
      .filter(s => slotFiles[s.key] !== null)
      .map(s => ({ name: s.label, file: slotFiles[s.key] as File }))

    const result = await onSave(input, slots)
    setSaving(false)
    if (result) { clearSlots(); onClose() }
  }

  const filledSlots = PREDEFINED_SLOTS.filter(s => slotFiles[s.key] !== null).length
  const selectedCat = OUTFIT_KATEGORIEN.find(c => c.key === category) ?? OUTFIT_KATEGORIEN[0]

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-lg border-border/60"
        style={{ background: 'linear-gradient(160deg, hsl(20,60%,9%) 0%, hsl(15,20%,6%) 45%, hsl(200,30%,8%) 100%)' } as React.CSSProperties}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Eintrag bearbeiten' : 'Neuer Outfit-Eintrag'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Kategorie — ein Komplett-Look oder ein einzelnes Kleidungsstück */}
          <div className="space-y-1.5">
            <Label>Kategorie *</Label>
            <div className="flex flex-wrap gap-1.5">
              {OUTFIT_KATEGORIEN.map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategory(cat.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                    category === cat.key
                      ? 'bg-orange-500/20 border-orange-500/60 text-orange-300'
                      : 'bg-white/5 border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground'
                  )}
                >
                  <span>{cat.emoji}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="outfit-name">
              Name * <span className="text-muted-foreground font-normal text-xs">({selectedCat.label})</span>
            </Label>
            <Input
              id="outfit-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={NAME_BEISPIEL[category]}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="outfit-desc">Beschreibung</Label>
            <Textarea
              id="outfit-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Kurze Beschreibung des Outfits…"
              className="resize-none h-16"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="outfit-tags">Tags</Label>
            <Input
              id="outfit-tags"
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

          {!isEdit && (
            <div className="space-y-2">
              <Label>
                Referenzbilder{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Jedes Bild wird als eigene Variante gespeichert.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {PREDEFINED_SLOTS.map(slot => {
                  const preview = slotPreviews[slot.key]
                  const hasFile = !!slotFiles[slot.key]
                  return (
                    <div key={slot.key} className="space-y-1">
                      <p className="text-xs text-center text-muted-foreground font-medium truncate">{slot.label}</p>
                      <div
                        className={cn(
                          'relative aspect-[3/4] rounded-lg border-2 border-dashed transition-colors cursor-pointer overflow-hidden',
                          hasFile ? 'border-orange-500/50' : 'border-white/10 hover:border-white/25 bg-white/5'
                        )}
                        onClick={() => fileRefs[slot.key].current?.click()}
                      >
                        {preview ? (
                          <>
                            <img src={preview} alt={slot.label} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); setSlot(slot.key, null) }}
                              className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 hover:bg-black/80"
                            >
                              <X className="h-3 w-3 text-white" />
                            </button>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground/40">
                            <ImagePlus className="h-5 w-5" />
                            <span className="text-[9px] text-center leading-tight px-1">Klicken</span>
                          </div>
                        )}
                      </div>
                      <input
                        ref={fileRefs[slot.key]}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0] ?? null
                          setSlot(slot.key, f)
                          e.target.value = ''
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving
                ? filledSlots > 0
                  ? `Erstellen & ${filledSlots} Bild${filledSlots > 1 ? 'er' : ''} hochladen…`
                  : 'Erstellen…'
                : isEdit ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Upload, ImagePlus } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import type { Character, CharacterInput, InitialSlot } from '@/hooks/use-characters'
import { KOPF_ORIGINAL_VARIANTE, KOERPERFOTO_VARIANTE } from '@/lib/referenzkette'

/**
 * Die Bilder, die Mark selbst mitbringt — beide freiwillig, keines Pflicht.
 *
 * Bis zum 03.09.2026 standen hier „Kopf", „Ausdrücke" und „Gesichtsdetails",
 * also drei Fächer aus der Zeit VOR der Referenzkette. Zwei Probleme damit:
 * „Ausdrücke" und „Gesichtsdetails" sind Blätter, die die KI erzeugt, keine
 * Fotos, die man mitbringt — und ein Bild im Fach „Kopf" ließ die
 * Referenzkette glauben, das Kopf-Sheet sei schon fertig.
 *
 * Jetzt genau die zwei Ausgangsbilder, die die Kette wirklich als Vorlage
 * nimmt: das Gesicht und (falls vorhanden) der Körperbau. Die Namen kommen
 * aus `referenzkette.ts` und werden NICHT hier abgeschrieben — der Name ist
 * zugleich der Variantenname, unter dem die Kette danach sucht.
 */
const PREDEFINED_SLOTS = [
  { key: 'kopf_original',    label: KOPF_ORIGINAL_VARIANTE },
  { key: 'koerper_original', label: KOERPERFOTO_VARIANTE },
] as const

type SlotKey = typeof PREDEFINED_SLOTS[number]['key']

interface Props {
  open: boolean
  onClose: () => void
  character?: Character | null
  onSave: (input: CharacterInput, slots: InitialSlot[]) => Promise<boolean | Character | null>
}

export function CharacterForm({ open, onClose, character, onSave }: Props) {
  const isEdit = !!character

  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [tagInput, setTagInput]       = useState('')
  const [tags, setTags]               = useState<string[]>([])
  const [saving, setSaving]           = useState(false)

  const [slotFiles, setSlotFiles]       = useState<Record<SlotKey, File | null>>({ kopf_original: null, koerper_original: null })
  const [slotPreviews, setSlotPreviews] = useState<Record<SlotKey, string | null>>({ kopf_original: null, koerper_original: null })

  const fileRefs = {
    kopf_original:    useRef<HTMLInputElement>(null),
    koerper_original: useRef<HTMLInputElement>(null),
  }

  useEffect(() => {
    if (open) {
      setName(character?.name ?? '')
      setDescription(character?.description ?? '')
      setTags(character?.tags ?? [])
      setTagInput('')
      clearSlots()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, character])

  function clearSlots() {
    Object.values(slotPreviews).forEach(u => u && URL.revokeObjectURL(u))
    setSlotFiles({ kopf_original: null, koerper_original: null })
    setSlotPreviews({ kopf_original: null, koerper_original: null })
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

    const input: CharacterInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      tags,
    }

    const slots: InitialSlot[] = PREDEFINED_SLOTS
      .filter(s => slotFiles[s.key] !== null)
      .map(s => ({ name: s.label, file: slotFiles[s.key] as File }))

    const result = await onSave(input, slots)
    setSaving(false)
    if (result) { clearSlots(); onClose() }
  }

  const filledSlots = PREDEFINED_SLOTS.filter(s => slotFiles[s.key] !== null).length

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-lg border-border/60"
        style={{ background: 'linear-gradient(160deg, hsl(142,60%,10%) 0%, hsl(130,20%,6%) 45%, hsl(25,50%,9%) 100%)' } as React.CSSProperties}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Charakter bearbeiten' : 'Neuer Charakter'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="char-name">Name *</Label>
            <Input
              id="char-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z.B. Emma Carter, Sepp, Sarah…"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="char-desc">Beschreibung</Label>
            <Textarea
              id="char-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Kurze Beschreibung des Charakters…"
              className="resize-none h-16"
            />
          </div>

          {/* Tags */}
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

          {/* Predefined image slots — only on create */}
          {!isEdit && (
            <div className="space-y-2">
              <Label>
                Referenzbilder{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Deine eigenen Ausgangsbilder — beides freiwillig, eines reicht.
                Die Referenzkette nimmt „{KOPF_ORIGINAL_VARIANTE}" fürs Gesicht
                und „{KOERPERFOTO_VARIANTE}" für den Körperbau; ohne
                „{KOERPERFOTO_VARIANTE}" benutzt sie fürs Gesicht wie für den
                Körper das Titelbild.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {PREDEFINED_SLOTS.map(slot => {
                  const preview = slotPreviews[slot.key]
                  const hasFile = !!slotFiles[slot.key]
                  return (
                    <div key={slot.key} className="space-y-1">
                      <p className="text-xs text-center text-muted-foreground font-medium truncate">{slot.label}</p>
                      <div
                        className={cn(
                          'relative aspect-[3/4] rounded-lg border-2 border-dashed transition-colors cursor-pointer overflow-hidden',
                          hasFile
                            ? 'border-violet-500/50'
                            : 'border-white/10 hover:border-white/25 bg-white/5'
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
                            <ImagePlus className="h-6 w-6" />
                            <span className="text-[10px]">Klicken oder ziehen</span>
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

          {/* Actions */}
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

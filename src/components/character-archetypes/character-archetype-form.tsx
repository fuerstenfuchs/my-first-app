'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Loader2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AttributeField } from '@/components/archetypes/attribute-field'
import { CHARACTER_ATTRIBUTE_OPTIONS } from '@/lib/archetype-attribute-options'
import type { CharacterArchetype, CharacterArchetypeInput, CharacterArchetypeAttributes } from '@/hooks/use-character-archetypes'

interface Props {
  open:    boolean
  onClose: () => void
  item?:   CharacterArchetype | null
  onSave:  (input: CharacterArchetypeInput) => Promise<unknown>
}

const ATTRIBUTE_FIELDS: { key: keyof CharacterArchetypeAttributes; label: string }[] = [
  { key: 'geschlecht',      label: 'Geschlecht' },
  { key: 'alter',           label: 'Alter' },
  { key: 'koerperbau',      label: 'Körperbau' },
  { key: 'groesse',         label: 'Größe' },
  { key: 'haarfarbe',       label: 'Haarfarbe' },
  { key: 'haarstil',        label: 'Haarstil' },
  { key: 'augenfarbe',      label: 'Augenfarbe' },
  { key: 'bart',            label: 'Bart' },
  { key: 'hauttyp',         label: 'Hauttyp' },
  { key: 'nationalitaet',   label: 'Nationalität' },
  { key: 'beruf',           label: 'Beruf' },
  { key: 'persoenlichkeit', label: 'Persönlichkeit' },
  { key: 'ausstrahlung',    label: 'Ausstrahlung' },
  { key: 'stimmung',        label: 'Stimmung' },
  { key: 'besonderheiten',  label: 'Besondere Merkmale' },
]

export function CharacterArchetypeForm({ open, onClose, item, onSave }: Props) {
  const isEdit = !!item

  const [name, setName]                         = useState('')
  const [shortDescription, setShortDescription] = useState('')
  const [longDescription, setLongDescription]   = useState('')
  const [prompt, setPrompt]                      = useState('')
  const [tagsRaw, setTagsRaw]                    = useState('')
  const [attributes, setAttributes]              = useState<CharacterArchetypeAttributes>({})
  const [saving, setSaving]                      = useState(false)

  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError]     = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(item?.name ?? '')
      setShortDescription(item?.short_description ?? '')
      setLongDescription(item?.long_description ?? '')
      setPrompt(item?.prompt ?? '')
      setTagsRaw(item?.tags.join(', ') ?? '')
      setAttributes(item?.attributes ?? {})
      setAiError(null)
    }
  }, [open, item])

  function setAttr(key: keyof CharacterArchetypeAttributes, value: string) {
    setAttributes(prev => ({ ...prev, [key]: value }))
  }

  async function handleGenerate() {
    if (!name.trim()) return
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch('/api/generate-character-archetype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), attributes }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      const result = await res.json() as {
        short_description?: string; long_description?: string; prompt?: string; tags?: string[]
        attributes?: CharacterArchetypeAttributes
      }
      setShortDescription(result.short_description ?? '')
      setLongDescription(result.long_description ?? '')
      setPrompt(result.prompt ?? '')
      setTagsRaw((result.tags ?? []).join(', '))
      setAttributes(result.attributes ?? {})
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'KI-Generierung fehlgeschlagen')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const input: CharacterArchetypeInput = {
      name:               name.trim(),
      short_description:  shortDescription.trim() || undefined,
      long_description:   longDescription.trim() || undefined,
      prompt:              prompt.trim() || undefined,
      tags:                tagsRaw.split(',').map(t => t.trim()).filter(Boolean),
      attributes:          Object.fromEntries(Object.entries(attributes).filter(([, v]) => v?.trim())),
    }
    const result = await onSave(input)
    setSaving(false)
    if (result) onClose()
  }

  const isBareWord = !isEdit && !!name.trim() && !shortDescription.trim() && !prompt.trim()

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Archetyp bearbeiten' : 'Neuer Character Archetype'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="ca-name">Name *</Label>
            <div className="flex gap-2">
              <Input
                id="ca-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="z.B. Schlagerstar, Polizistin, Cowboy"
                required
                className="flex-1"
              />
              <Button type="button" size="sm" className="shrink-0 bg-teal-600 hover:bg-teal-500"
                onClick={handleGenerate} disabled={aiLoading || !name.trim()}>
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Sparkles className="mr-1 h-3.5 w-3.5" />Mit KI erzeugen</>}
              </Button>
            </div>
            {isBareWord && (
              <p className="text-[11px] text-amber-400/90">
                Klicke „Mit KI erzeugen", um Beschreibung, Prompt und Attribute automatisch zu erzeugen — vorhandene Angaben bleiben dabei erhalten.
              </p>
            )}
            {aiError && (
              <div className="flex items-start gap-1.5 text-[11px] text-destructive">
                <span className="flex-1">{aiError}</span>
                <button type="button" onClick={() => setAiError(null)}><X className="h-3 w-3" /></button>
              </div>
            )}
          </div>

          {/* Attributes */}
          <div className="space-y-2.5">
            <Label>Attribute <span className="text-muted-foreground font-normal">(alle optional — leer lassen, damit die KI entscheidet)</span></Label>
            {ATTRIBUTE_FIELDS.map(f => (
              <AttributeField
                key={f.key}
                label={f.label}
                value={attributes[f.key] ?? ''}
                onChange={v => setAttr(f.key, v)}
                options={CHARACTER_ATTRIBUTE_OPTIONS[f.key].options}
                allowCustom={CHARACTER_ATTRIBUTE_OPTIONS[f.key].allowCustom}
                multi={CHARACTER_ATTRIBUTE_OPTIONS[f.key].multi}
              />
            ))}
          </div>

          {/* Short description */}
          <div className="space-y-1.5">
            <Label htmlFor="ca-short">Kurze Beschreibung</Label>
            <Textarea
              id="ca-short"
              value={shortDescription}
              onChange={e => setShortDescription(e.target.value)}
              placeholder="z.B. Erfahrene deutsche Schlagersängerin mit charismatischer Bühnenpräsenz."
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Long description */}
          <div className="space-y-1.5">
            <Label htmlFor="ca-long">Lange Beschreibung</Label>
            <Textarea
              id="ca-long"
              value={longDescription}
              onChange={e => setLongDescription(e.target.value)}
              placeholder="Ausführliche Beschreibung von Erscheinung und Ausstrahlung…"
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Prompt */}
          <div className="space-y-1.5">
            <Label htmlFor="ca-prompt">Prompt</Label>
            <Textarea
              id="ca-prompt"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Englischer Prompt-Baustein für die Bild-KI…"
              rows={3}
              className="resize-none font-mono text-xs"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="ca-tags">Tags</Label>
            <Input
              id="ca-tags"
              value={tagsRaw}
              onChange={e => setTagsRaw(e.target.value)}
              placeholder="schlager, sängerin, bühne, charismatisch"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={saving || !name.trim()} className="bg-teal-600 hover:bg-teal-500">
              {saving ? 'Speichern…' : isEdit ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

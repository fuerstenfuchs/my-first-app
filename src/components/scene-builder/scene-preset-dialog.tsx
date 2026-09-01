'use client'

import { useState, useRef, useMemo } from 'react'
import {
  Plus, X, Lock, Copy, Download, Upload, Trash2, Sparkles, Check,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import type { ScenePresetItem, ScenePresetInput } from '@/hooks/use-scene-presets'
import type { ScenePresetConfig } from '@/lib/scene-preset-types'
import { PRESET_CATEGORIES } from '@/lib/scene-presets-standard'
import {
  SCENE_TYPES, TIME_OF_DAY, SEASONS, WEATHERS, LIGHT_SOURCES, LIGHT_STYLES, LIGHT_MODIFIERS,
  SHOT_TYPES, CAMERA_ANGLES, LENSES, DEPTH_OF_FIELDS, ASPECT_RATIOS, STUDIO_BACKGROUNDS,
} from '@/lib/scene-builder-options'

interface NamedRef { id: string; name: string; cover_image_url?: string | null }

interface Props {
  open:    boolean
  onClose: () => void
  items:   ScenePresetItem[]
  loading: boolean
  currentConfig: ScenePresetConfig
  autoCoverUrl:  string | null
  onApply:    (config: ScenePresetConfig) => void
  onCreate:   (input: ScenePresetInput, coverFile?: File | null) => Promise<unknown>
  onDelete:   (id: string) => Promise<boolean>
  onDuplicate: (item: ScenePresetItem) => Promise<unknown>
  onExport:    (item: ScenePresetItem) => void
  onImport:    (file: File) => Promise<unknown>
  // Lookups so the detail view can show readable names instead of raw IDs
  characters: NamedRef[]
  characterArchetypes: NamedRef[]
  outfits:    NamedRef[]
  outfitArchetypes: NamedRef[]
  locations:  NamedRef[]
  locationArchetypes: NamedRef[]
  poseActions: NamedRef[]
  expressions: NamedRef[]
  cameras:     NamedRef[]
  styles:      NamedRef[]
  gradings:    NamedRef[]
}

function findLabel(list: { key: string; label: string; emoji: string }[], value: string | null): string | null {
  if (!value) return null
  const found = list.find(o => o.key === value)
  return found ? `${found.emoji} ${found.label}` : null
}

export function ScenePresetDialog({
  open, onClose, items, loading, currentConfig, autoCoverUrl,
  onApply, onCreate, onDelete, onDuplicate, onExport, onImport,
  characters, characterArchetypes, outfits, outfitArchetypes, locations, locationArchetypes,
  poseActions, expressions, cameras, styles, gradings,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saveOpen, setSaveOpen]     = useState(false)
  const [deleteId, setDeleteId]     = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  // Save form state
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]       = useState<string>('Eigene')
  const [coverFile, setCoverFile]     = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)

  const selected = selectedId ? items.find(i => i.id === selectedId) ?? null : null

  function handleClose() {
    onClose()
    setSelectedId(null)
    setSaveOpen(false)
  }

  function openSaveForm() {
    setName('')
    setDescription('')
    setCategory('Eigene')
    setCoverFile(null)
    setCoverPreview(null)
    setSaveOpen(true)
  }

  function handleCoverFileChange(file: File) {
    setCoverFile(file)
    if (coverPreview) URL.revokeObjectURL(coverPreview)
    setCoverPreview(URL.createObjectURL(file))
  }

  async function handleSaveSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      config: currentConfig,
      cover_image_url: coverFile ? undefined : autoCoverUrl,
    }, coverFile)
    setSaving(false)
    setSaveOpen(false)
  }

  function handleImportFile(file: File) {
    onImport(file)
  }

  const badges = useMemo(() => {
    if (!selected) return []
    const c = selected.config
    const list: { emoji: string; label: string }[] = []
    const sceneType = SCENE_TYPES.find(t => t.key === c.scene_type)
    if (sceneType) list.push({ emoji: sceneType.emoji, label: sceneType.label })
    if (c.scene_type === 'outdoor') {
      const a = findLabel(TIME_OF_DAY, c.time_of_day); if (a) list.push({ emoji: a.split(' ')[0], label: a.slice(a.indexOf(' ') + 1) })
      const b = findLabel(SEASONS, c.season);          if (b) list.push({ emoji: b.split(' ')[0], label: b.slice(b.indexOf(' ') + 1) })
      const w = findLabel(WEATHERS, c.weather);         if (w) list.push({ emoji: w.split(' ')[0], label: w.slice(w.indexOf(' ') + 1) })
    } else {
      const ls = findLabel(LIGHT_SOURCES, c.light_source); if (ls) list.push({ emoji: ls.split(' ')[0], label: ls.slice(ls.indexOf(' ') + 1) })
      const lst = findLabel(LIGHT_STYLES, c.light_style);  if (lst) list.push({ emoji: lst.split(' ')[0], label: lst.slice(lst.indexOf(' ') + 1) })
      for (const m of c.light_modifiers) {
        const mod = findLabel(LIGHT_MODIFIERS, m); if (mod) list.push({ emoji: mod.split(' ')[0], label: mod.slice(mod.indexOf(' ') + 1) })
      }
    }
    if (!c.location_id && !c.location_archetype_id && c.background) {
      const bg = findLabel(STUDIO_BACKGROUNDS, c.background); if (bg) list.push({ emoji: bg.split(' ')[0], label: bg.slice(bg.indexOf(' ') + 1) })
    }
    const cam = [
      findLabel(SHOT_TYPES, c.shot_type), findLabel(CAMERA_ANGLES, c.camera_angle), findLabel(LENSES, c.lens),
      findLabel(DEPTH_OF_FIELDS, c.depth_of_field), findLabel(ASPECT_RATIOS, c.aspect_ratio),
    ]
    for (const item of cam) if (item) list.push({ emoji: item.split(' ')[0], label: item.slice(item.indexOf(' ') + 1) })
    return list
  }, [selected])

  const assetRefs = useMemo(() => {
    if (!selected) return []
    const c = selected.config
    const result: { label: string; name: string }[] = []
    const char = c.character_id ? characters.find(x => x.id === c.character_id) : null
    if (char) result.push({ label: 'Charakter', name: char.name })
    const charArchetype = c.character_archetype_id ? characterArchetypes.find(x => x.id === c.character_archetype_id) : null
    if (charArchetype) result.push({ label: 'Charakter-Archetyp', name: charArchetype.name })
    const outfit = c.outfit_id ? outfits.find(x => x.id === c.outfit_id) : null
    if (outfit) result.push({ label: 'Outfit', name: outfit.name })
    const outfitArchetype = c.outfit_archetype_id ? outfitArchetypes.find(x => x.id === c.outfit_archetype_id) : null
    if (outfitArchetype) result.push({ label: 'Outfit-Archetyp', name: outfitArchetype.name })
    const loc = c.location_id ? locations.find(x => x.id === c.location_id) : null
    if (loc) result.push({ label: 'Location', name: loc.name })
    const archetype = c.location_archetype_id ? locationArchetypes.find(x => x.id === c.location_archetype_id) : null
    if (archetype) result.push({ label: 'Archetyp', name: archetype.name })
    const pose = c.pose_id ? poseActions.find(x => x.id === c.pose_id) : null
    if (pose) result.push({ label: 'Pose', name: pose.name })
    const expr = c.expression_id ? expressions.find(x => x.id === c.expression_id) : null
    if (expr) result.push({ label: 'Mimik', name: expr.name })
    const cam = c.camera_id ? cameras.find(x => x.id === c.camera_id) : null
    if (cam) result.push({ label: 'Kamera-Asset', name: cam.name })
    const style = c.style_id ? styles.find(x => x.id === c.style_id) : null
    if (style) result.push({ label: 'Stil', name: style.name })
    const grading = c.grading_id ? gradings.find(x => x.id === c.grading_id) : null
    if (grading) result.push({ label: 'Grading', name: grading.name })
    return result
  }, [selected, characters, characterArchetypes, outfits, outfitArchetypes, locations, locationArchetypes, poseActions, expressions, cameras, styles, gradings])

  return (
    <>
      <Dialog open={open} onOpenChange={v => !v && handleClose()}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b shrink-0 flex-row items-center gap-2 space-y-0">
            <DialogTitle className="flex-1 text-base">📁 Presets</DialogTitle>
            <Button size="sm" variant="outline" onClick={() => importRef.current?.click()}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />Importieren
            </Button>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-500" onClick={openSaveForm}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />Preset speichern
            </Button>
            <input ref={importRef} type="file" accept="application/json" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = '' }} />
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex min-w-0">
            {/* Gallery */}
            <div className="flex-1 overflow-y-auto p-4 min-w-0">
              {loading ? (
                <p className="text-xs text-muted-foreground">Lade Presets…</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedId(prev => prev === item.id ? null : item.id)}
                      className={cn(
                        'relative rounded-xl overflow-hidden border-2 transition-all text-left group bg-card/60',
                        selectedId === item.id
                          ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-lg shadow-amber-500/10'
                          : 'border-border/40 hover:border-amber-500/40'
                      )}
                    >
                      <div className="aspect-[4/3] bg-muted/30 relative overflow-hidden">
                        {item.cover_image_url ? (
                          <img src={item.cover_image_url} alt={item.name} className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl text-muted-foreground/20">📁</div>
                        )}
                        {item.isStandard && (
                          <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 text-[9px] bg-black/60 text-white/70 px-1.5 py-0.5 rounded font-medium">
                            <Lock className="h-2.5 w-2.5" />Standard
                          </div>
                        )}
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="text-xs font-medium leading-tight truncate">{item.name}</p>
                        {item.category && <p className="text-[10px] text-muted-foreground/60 truncate">{item.category}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Detail */}
            {selected && (
              <div className="w-80 shrink-0 border-l border-border overflow-y-auto p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold truncate">{selected.name}</h4>
                    {selected.category && <p className="text-[11px] text-muted-foreground/60">{selected.category}</p>}
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setSelectedId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {selected.cover_image_url && (
                  <img src={selected.cover_image_url} alt={selected.name} className="w-full rounded-lg object-contain max-h-40 bg-black/10" />
                )}

                {selected.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{selected.description}</p>
                )}

                {badges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {badges.map((b, i) => (
                      <span key={i} className="flex items-center gap-1 text-[11px] bg-muted/40 px-1.5 py-0.5 rounded text-muted-foreground">
                        {b.emoji} {b.label}
                      </span>
                    ))}
                  </div>
                )}

                {assetRefs.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Assets</p>
                    {assetRefs.map((r, i) => (
                      <p key={i} className="text-xs text-muted-foreground"><span className="text-muted-foreground/50">{r.label}:</span> {r.name}</p>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5 pt-1">
                  <Button className="w-full bg-amber-600 hover:bg-amber-500" onClick={() => { onApply(selected.config); handleClose() }}>
                    <Check className="mr-1.5 h-3.5 w-3.5" />Preset anwenden
                  </Button>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => onDuplicate(selected)}>
                      <Copy className="mr-1.5 h-3 w-3" />Duplizieren
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onExport(selected)}>
                      <Download className="mr-1.5 h-3 w-3" />Exportieren
                    </Button>
                  </div>
                  {!selected.isStandard && (
                    <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(selected.id)}>
                      <Trash2 className="mr-1.5 h-3 w-3" />Löschen
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Save form (nested dialog) ── */}
      <Dialog open={saveOpen} onOpenChange={v => !v && setSaveOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-400" />Preset speichern</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveSubmit} className="space-y-4 mt-1">
            <div className="space-y-1.5">
              <Label htmlFor="preset-name">Preset-Name *</Label>
              <Input id="preset-name" value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Mein Sommer-Look" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preset-desc">Beschreibung</Label>
              <Textarea id="preset-desc" value={description} onChange={e => setDescription(e.target.value)} rows={2} className="resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label>Kategorie</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_CATEGORIES.map(cat => (
                  <button key={cat} type="button" onClick={() => setCategory(cat)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg border text-xs transition-colors',
                      category === cat ? 'bg-amber-500/15 border-amber-500/50 text-amber-300' : 'border-border/50 text-muted-foreground hover:border-border'
                    )}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Coverbild</Label>
              {coverPreview ? (
                <img src={coverPreview} alt="" className="w-full h-28 object-contain rounded-lg border border-border/50 bg-muted/30" />
              ) : autoCoverUrl ? (
                <div className="space-y-1">
                  <img src={autoCoverUrl} alt="" className="w-full h-28 object-contain rounded-lg border border-border/50 bg-muted/30" />
                  <p className="text-[10px] text-muted-foreground/50">Automatisch aus der aktuellen Szene übernommen.</p>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground/50">Kein Vorschaubild verfügbar — wähle Charakter/Outfit/Location für ein automatisches Coverbild, oder lade eines hoch.</p>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('preset-cover-input')?.click()}>
                Eigenes Bild hochladen
              </Button>
              <input id="preset-cover-input" type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverFileChange(f); e.target.value = '' }} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setSaveOpen(false)}>Abbrechen</Button>
              <Button type="submit" disabled={saving || !name.trim()} className="bg-amber-600 hover:bg-amber-500">
                {saving ? 'Speichern…' : 'Speichern'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Preset löschen?</AlertDialogTitle>
            <AlertDialogDescription>Das Preset wird unwiderruflich gelöscht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteId) return
                await onDelete(deleteId)
                if (selectedId === deleteId) setSelectedId(null)
                setDeleteId(null)
              }}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

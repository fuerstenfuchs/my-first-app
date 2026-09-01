'use client'

import { useState, useMemo, useCallback } from 'react'
import { Copy, Sparkles, X, Plus, Loader2, ImageOff } from 'lucide-react'
import { toast } from 'sonner'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCharacters, type Character } from '@/hooks/use-characters'
import { useOutfits, type Outfit } from '@/hooks/use-outfits'
import { useLocations, type Location } from '@/hooks/use-locations'
import { useLocationArchetypes, type LocationArchetype } from '@/hooks/use-location-archetypes'
import { useCharacterArchetypes, type CharacterArchetype } from '@/hooks/use-character-archetypes'
import { useOutfitArchetypes, type OutfitArchetype } from '@/hooks/use-outfit-archetypes'
import { usePoseActions, type PoseAction } from '@/hooks/use-pose-actions'
import { useVisualAssets, type VisualAsset } from '@/hooks/use-visual-assets'
import { useLookGrading, type LookGradingItem } from '@/hooks/use-look-grading'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  type SceneType, type TimeOfDayKey, type SeasonKey, type WeatherKey,
  type LightSourceKey, type LightStyleKey, type LightModifierKey, type BackgroundKey,
  type ShotTypeKey, type CameraAngleKey, type LensKey, type DepthOfFieldKey, type AspectRatioKey,
  SCENE_TYPES, OUTDOOR_ONLY_TIMES, TIME_OF_DAY, SEASONS, WEATHERS,
  LIGHT_SOURCES, LIGHT_STYLES, LIGHT_MODIFIERS, STUDIO_BACKGROUNDS,
  SHOT_TYPES, CAMERA_ANGLES, LENSES, DEPTH_OF_FIELDS, ASPECT_RATIOS,
} from '@/lib/scene-builder-options'
import { useScenePresets } from '@/hooks/use-scene-presets'
import { ScenePresetDialog } from '@/components/scene-builder/scene-preset-dialog'
import { QueueButton } from '@/components/scene-builder/queue-button'
import type { Referenz, ReferenzRolle } from '@/lib/image-generation'
import type { ScenePresetConfig } from '@/lib/scene-preset-types'

// ── Types ─────────────────────────────────────────────────────────────────────

type RefImage = { url: string; label: string }

type SceneRefs = {
  character: RefImage | null
  character_archetype: RefImage | null
  outfit:    RefImage | null
  outfit_archetype: RefImage | null
  location:  RefImage | null
  location_archetype: RefImage | null
}

type Scene = {
  scene_type: SceneType
  time_of_day: TimeOfDayKey | null
  season:      SeasonKey | null
  weather:     WeatherKey | null
  light_source: LightSourceKey | null
  light_style:  LightStyleKey | null
  light_modifiers: LightModifierKey[]
  shot_type:      ShotTypeKey | null
  camera_angle:   CameraAngleKey | null
  lens:           LensKey | null
  depth_of_field: DepthOfFieldKey | null
  aspect_ratio:   AspectRatioKey | null
  character: Character | null
  character_archetype: CharacterArchetype | null
  outfit:    Outfit | null
  outfit_archetype: OutfitArchetype | null
  location:  Location | null
  location_archetype: LocationArchetype | null
  pose:      PoseAction | null
  expression: VisualAsset | null
  camera:    VisualAsset | null
  style:     LookGradingItem | null
  grading:   LookGradingItem | null
  background: BackgroundKey | null
}

type TabKey = 'charaktere' | 'charakter_archetypen' | 'outfits' | 'outfit_archetypen' | 'locations' | 'archetypen' | 'posen' | 'ausdruck' | 'kamera' | 'stil' | 'grading'

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: 'charaktere', label: 'Charaktere', emoji: '👤' },
  { key: 'charakter_archetypen', label: 'Charakter-Archetyp', emoji: '👥' },
  { key: 'outfits',    label: 'Outfits',    emoji: '👗' },
  { key: 'outfit_archetypen', label: 'Outfit-Archetyp', emoji: '🧥' },
  { key: 'locations',  label: 'Locations',  emoji: '📍' },
  { key: 'archetypen', label: 'Archetyp',   emoji: '🏛️' },
  { key: 'posen',      label: 'Posen',      emoji: '🎭' },
  { key: 'ausdruck',   label: 'Mimik',      emoji: '😊' },
  { key: 'kamera',     label: 'Kamera-Asset', emoji: '📷' },
  { key: 'stil',       label: 'Stil',       emoji: '🎥' },
  { key: 'grading',    label: 'Grading',    emoji: '🎨' },
]

type SlotKey = keyof Pick<Scene, 'character' | 'character_archetype' | 'outfit' | 'outfit_archetype' | 'location' | 'location_archetype' | 'pose' | 'expression' | 'camera' | 'style' | 'grading'>
type RefSlotKey = keyof SceneRefs

const SLOTS: { key: SlotKey; label: string; emoji: string; tab: TabKey }[] = [
  { key: 'character', label: 'Charakter', emoji: '👤', tab: 'charaktere' },
  { key: 'character_archetype', label: 'Charakter-Archetyp', emoji: '👥', tab: 'charakter_archetypen' },
  { key: 'outfit',    label: 'Outfit',    emoji: '👗', tab: 'outfits'    },
  { key: 'outfit_archetype', label: 'Outfit-Archetyp', emoji: '🧥', tab: 'outfit_archetypen' },
  { key: 'location',  label: 'Location',  emoji: '📍', tab: 'locations'  },
  { key: 'location_archetype', label: 'Archetyp', emoji: '🏛️', tab: 'archetypen' },
  { key: 'pose',      label: 'Pose',      emoji: '🎭', tab: 'posen'      },
  { key: 'expression',label: 'Mimik',     emoji: '😊', tab: 'ausdruck'   },
  { key: 'camera',    label: 'Kamera-Asset', emoji: '📷', tab: 'kamera' },
  { key: 'style',     label: 'Stil',       emoji: '🎥', tab: 'stil'    },
  { key: 'grading',   label: 'Grading',    emoji: '🎨', tab: 'grading' },
]

const REF_SLOTS: RefSlotKey[] = ['character', 'character_archetype', 'outfit', 'outfit_archetype', 'location', 'location_archetype']

// ── Prompt generator ──────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Merges the active environmental/lighting parameters into one natural, flowing sentence
// instead of stacking the raw selected terms underneath each other.
function buildEnvironmentSentence(scene: Scene): string | null {
  const clauses: string[] = []

  if (scene.scene_type === 'outdoor') {
    if (scene.time_of_day) clauses.push(TIME_OF_DAY.find(t => t.key === scene.time_of_day)!.prompt)
    if (scene.season)      clauses.push(SEASONS.find(s => s.key === scene.season)!.prompt)
    if (scene.weather)     clauses.push(WEATHERS.find(w => w.key === scene.weather)!.prompt)
    if (clauses.length === 0) return null
    clauses.push('natural outdoor lighting', 'atmospheric depth', 'realistic environmental illumination')
  } else {
    if (scene.light_style)  clauses.push(LIGHT_STYLES.find(s => s.key === scene.light_style)!.prompt)
    if (scene.light_source) clauses.push(LIGHT_SOURCES.find(s => s.key === scene.light_source)!.prompt)
    for (const m of scene.light_modifiers) clauses.push(LIGHT_MODIFIERS.find(x => x.key === m)!.prompt)
    if (clauses.length === 0) return null
    clauses.push('clean indoor lighting setup', 'natural skin tones')
  }

  return capitalize(clauses.join(', ')) + '.'
}

// A few shot type + lens pairings read much better as one tailored, professionally
// phrased sentence than as a naive concatenation of their individual fragments.
const CAMERA_COMBO_OVERRIDES: { shot_type: ShotTypeKey; lens: LensKey; prompt: string }[] = [
  { shot_type: 'closeup',   lens: '135mm', prompt: 'Professional close-up portrait, 135mm telephoto lens, strong background compression, flattering facial proportions, shallow depth of field.' },
  { shot_type: 'full_body', lens: '24mm',  prompt: 'Full body environmental shot, 24mm wide-angle lens, strong sense of place, natural environmental context.' },
]

// Merges the structured camera settings into one natural, professionally phrased
// sentence instead of listing the selected technical terms as raw keywords.
function buildCameraSentence(scene: Scene): string | null {
  const override = CAMERA_COMBO_OVERRIDES.find(c => c.shot_type === scene.shot_type && c.lens === scene.lens)
  if (override) return override.prompt

  const clauses: string[] = []
  if (scene.shot_type)      clauses.push(SHOT_TYPES.find(s => s.key === scene.shot_type)!.prompt)
  if (scene.camera_angle)   clauses.push(CAMERA_ANGLES.find(a => a.key === scene.camera_angle)!.prompt)
  if (scene.lens)           clauses.push(LENSES.find(l => l.key === scene.lens)!.prompt)
  if (scene.depth_of_field) clauses.push(DEPTH_OF_FIELDS.find(d => d.key === scene.depth_of_field)!.prompt)
  if (scene.aspect_ratio)   clauses.push(ASPECT_RATIOS.find(r => r.key === scene.aspect_ratio)!.prompt)

  if (clauses.length === 0) return null
  return capitalize(clauses.join(', ')) + '.'
}

// Same three-case blending as buildLocationSection below, applied to Character Archetypes:
// real Character + Archetype → real image is the reference, Archetype contributes text only;
// Archetype alone → its own image (if any) or just its text; neither → no-op.
function buildCharacterSection(scene: Scene, sceneRefs: SceneRefs): string[] {
  const out: string[] = []
  const archetype = scene.character_archetype
  const archPrompt = archetype?.prompt?.trim() || null

  if (scene.character) {
    out.push('Use the provided character reference.')
    if (archetype) {
      out.push(`Depict the character as a ${archetype.name.toLowerCase()}.`)
      if (archPrompt) out.push(`Follow this character description:\n\n${archPrompt}`)
    }
  } else if (archetype) {
    if (sceneRefs.character_archetype) {
      out.push('Use the provided character reference.')
      if (archPrompt) out.push(`Additionally follow this character description:\n\n${archPrompt}`)
    } else if (archPrompt) {
      out.push(`Use the following character description:\n\n${archPrompt}`)
    }
  }

  return out
}

// Same three-case blending as buildLocationSection below, applied to Outfit Archetypes.
function buildOutfitSection(scene: Scene, sceneRefs: SceneRefs): string[] {
  const out: string[] = []
  const archetype = scene.outfit_archetype
  const archPrompt = archetype?.prompt?.trim() || null

  if (scene.outfit) {
    out.push('Use the provided outfit reference.')
    if (archetype) {
      out.push(`Dress the character in a ${archetype.name.toLowerCase()}.`)
      if (archPrompt) out.push(`Follow this outfit description:\n\n${archPrompt}`)
    }
  } else if (archetype) {
    if (sceneRefs.outfit_archetype) {
      out.push('Use the provided outfit reference.')
      if (archPrompt) out.push(`Additionally follow this outfit description:\n\n${archPrompt}`)
    } else if (archPrompt) {
      out.push(`Use the following outfit description:\n\n${archPrompt}`)
    }
  }

  return out
}

// The location section has three combination cases: a generic Archetype alone
// (with or without its own chosen reference image), a real Location alone, or
// both together — where the real Location supplies the visual reference and the
// Archetype only contributes its textual description, blended via one sentence.
function buildLocationSection(scene: Scene, sceneRefs: SceneRefs): string[] {
  const out: string[] = []
  const archetype = scene.location_archetype
  const archPrompt = archetype?.prompt?.trim() || null

  if (scene.location) {
    out.push('Use the provided location reference.')
    if (archetype) {
      out.push(`Create a ${archetype.name.toLowerCase()} within the ${scene.location.name} environment.`)
      if (archPrompt) out.push(`Follow this location description:\n\n${archPrompt}`)
    }
  } else if (archetype) {
    if (sceneRefs.location_archetype) {
      out.push('Use the provided location reference.')
      if (archPrompt) out.push(`Additionally follow this location description:\n\n${archPrompt}`)
    } else if (archPrompt) {
      out.push(`Use the following location description:\n\n${archPrompt}`)
    }
  } else if (scene.background) {
    out.push(capitalize(STUDIO_BACKGROUNDS.find(b => b.key === scene.background)!.prompt) + '.')
  }

  return out
}

function buildPrompt(scene: Scene, sceneRefs: SceneRefs): string {
  const parts: string[] = []

  parts.push(scene.scene_type === 'indoor' ? 'Indoor scene.' : 'Outdoor scene.')

  const envSentence = buildEnvironmentSentence(scene)
  if (envSentence) parts.push(envSentence)

  const cameraSentence = buildCameraSentence(scene)
  if (cameraSentence) parts.push(cameraSentence)

  parts.push(...buildCharacterSection(scene, sceneRefs))
  parts.push(...buildOutfitSection(scene, sceneRefs))
  parts.push(...buildLocationSection(scene, sceneRefs))

  if (scene.pose) {
    parts.push(scene.pose.description?.trim() || `The character is in a ${scene.pose.name} pose.`)
  }

  if (scene.expression) {
    parts.push(scene.expression.description?.trim() || `${scene.expression.name} facial expression.`)
  }

  if (scene.camera) {
    parts.push(scene.camera.description?.trim() || `${scene.camera.name}.`)
  }

  if (scene.style) {
    const p = scene.style.prompt.trim()
    parts.push(/[.!?]$/.test(p) ? p : p + '.')
  }

  if (scene.grading) {
    const p = scene.grading.prompt.trim()
    parts.push(/[.!?]$/.test(p) ? p : p + '.')
  }

  if (parts.length > 0) parts.push('Photorealistic.')

  return parts.join('\n\n')
}

// ── Load reference images from Supabase ───────────────────────────────────────

async function loadRefImages(
  table: 'character_variants' | 'outfit_variants' | 'location_variants',
  fk: 'character_id' | 'outfit_id' | 'location_id',
  assetId: string,
): Promise<RefImage[]> {
  const supabase = createClient()
  const imageTable = table === 'character_variants' ? 'character_images'
    : table === 'outfit_variants' ? 'outfit_images' : 'location_images'

  const { data, error } = await supabase
    .from(table)
    .select(`name, images:${imageTable}(url, sort_order)`)
    .eq(fk, assetId)
    .order('sort_order', { ascending: true })

  if (error || !data) return []

  const results: RefImage[] = []
  for (const variant of data as Array<{ name: string; images: Array<{ url: string; sort_order: number }> }>) {
    const sorted = [...(variant.images ?? [])].sort((a, b) => a.sort_order - b.sort_order)
    for (const img of sorted) {
      if (img.url) results.push({ url: img.url, label: variant.name })
    }
  }
  return results
}

// Archetype images (Character/Outfit/Location) have no variant grouping — they hang
// directly off the archetype, so this is a flat lookup instead of the variant+images join above.
async function loadArchetypeRefImages(
  table: 'character_archetype_images' | 'outfit_archetype_images' | 'location_archetype_images',
  archetypeId: string,
): Promise<RefImage[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from(table)
    .select('url, sort_order')
    .eq('archetype_id', archetypeId)
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return (data as Array<{ url: string }>)
    .filter(img => img.url)
    .map(img => ({ url: img.url, label: 'Referenzbild' }))
}

// ── Small asset thumbnail card (left panel) ───────────────────────────────────

function AssetThumb({
  name, imageUrl, emoji, isSelected, onClick,
}: {
  name: string; imageUrl: string | null; emoji: string
  isSelected: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative rounded-lg overflow-hidden border-2 transition-all text-left group w-full',
        isSelected
          ? 'border-orange-500 ring-1 ring-orange-500/30'
          : 'border-border/40 hover:border-orange-500/40'
      )}
    >
      <div className="aspect-[3/4] bg-muted/30 relative overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl text-muted-foreground/20">
            {emoji}
          </div>
        )}
        {isSelected && (
          <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">✓</span>
            </div>
          </div>
        )}
      </div>
      <div className="px-1.5 py-1">
        <p className="text-[10px] font-medium leading-tight truncate">{name}</p>
      </div>
    </button>
  )
}

// ── Reference picker strip (inside SceneSlot) ─────────────────────────────────

function RefPicker({
  images, selectedUrl, onSelect, loading,
}: {
  images: RefImage[]; selectedUrl: string | null; onSelect: (img: RefImage | null) => void; loading: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-1.5 gap-1">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/40" />
        <span className="text-[9px] text-muted-foreground/40">Lade Bilder…</span>
      </div>
    )
  }

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center py-1.5 gap-1">
        <ImageOff className="h-3 w-3 text-muted-foreground/20" />
        <span className="text-[9px] text-muted-foreground/30">Keine Bilder</span>
      </div>
    )
  }

  return (
    <div className="flex gap-1 overflow-x-auto px-1 py-1 scrollbar-hide">
      {/* "Kein Bild" option */}
      <button
        onClick={() => onSelect(null)}
        title="Kein Referenzbild"
        className={cn(
          'shrink-0 w-7 h-7 rounded border flex items-center justify-center text-[8px] transition-colors',
          selectedUrl === null
            ? 'border-orange-500 bg-orange-500/15 text-orange-300'
            : 'border-border/30 text-muted-foreground/30 hover:border-border/60'
        )}
      >
        ✕
      </button>
      {images.map((img, i) => (
        <button
          key={i}
          onClick={() => onSelect(img)}
          title={img.label}
          className={cn(
            'shrink-0 w-7 h-7 rounded overflow-hidden border-2 transition-all',
            selectedUrl === img.url
              ? 'border-orange-500 ring-1 ring-orange-500/30'
              : 'border-border/30 hover:border-orange-400/60'
          )}
        >
          <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  )
}

// ── Scene slot card (middle canvas) ──────────────────────────────────────────

function SceneSlot({
  slot, asset, refImages, refLoading, selectedRef, onSelectRef, onClear, onSelect,
}: {
  slot: typeof SLOTS[number]
  asset: { name: string; cover_image_url?: string | null } | null
  refImages?: RefImage[]
  refLoading?: boolean
  selectedRef?: RefImage | null
  onSelectRef?: (img: RefImage | null) => void
  onClear: () => void
  onSelect: () => void
}) {
  const hasRefPicker = Boolean(onSelectRef)
  const displayImage = (hasRefPicker && selectedRef?.url) ? selectedRef.url : asset?.cover_image_url

  return (
    <div className={cn(
      'relative rounded-xl border-2 overflow-hidden transition-all',
      asset ? 'border-orange-500/60' : 'border-border/30 border-dashed'
    )}>
      {asset ? (
        <>
          <div className="aspect-[3/4] bg-muted/30 relative overflow-hidden">
            {displayImage ? (
              <img src={displayImage} alt={asset.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl text-muted-foreground/20">
                {slot.emoji}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5">
              <p className="text-[9px] font-medium text-white/60 uppercase tracking-wider">{slot.label}</p>
              <p className="text-xs font-semibold text-white leading-tight truncate">{asset.name}</p>
              {hasRefPicker && selectedRef && (
                <p className="text-[8px] text-orange-300/80 truncate">{selectedRef.label}</p>
              )}
            </div>
          </div>

          {/* Reference picker strip for character/outfit/location */}
          {hasRefPicker && onSelectRef && (
            <div className="bg-black/20 border-t border-border/20">
              <p className="text-[8px] text-muted-foreground/40 px-1 pt-0.5 uppercase tracking-wider">Referenz</p>
              <RefPicker
                images={refImages ?? []}
                selectedUrl={selectedRef?.url ?? null}
                onSelect={onSelectRef}
                loading={refLoading ?? false}
              />
            </div>
          )}

          <button
            onClick={onClear}
            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/70 hover:bg-red-600/80 flex items-center justify-center z-10"
          >
            <X className="h-3 w-3 text-white" />
          </button>
        </>
      ) : (
        <button
          onClick={onSelect}
          className="w-full aspect-[3/4] flex flex-col items-center justify-center gap-2 text-muted-foreground/30 hover:text-orange-400/60 transition-colors"
        >
          <span className="text-3xl">{slot.emoji}</span>
          <span className="text-[10px] font-medium">{slot.label}</span>
          <div className="w-6 h-6 rounded-full border border-current flex items-center justify-center">
            <Plus className="h-3 w-3" />
          </div>
        </button>
      )}
    </div>
  )
}

// ── Chip selector (Tageszeit / Jahreszeit / Wetter) ───────────────────────────

function ChipGroup<T extends string>({
  label, options, selected, onSelect,
}: {
  label: string
  options: { key: T; label: string; emoji: string }[]
  selected: T | null
  onSelect: (key: T | null) => void
}) {
  return (
    <div>
      <span className="text-[10px] font-medium text-muted-foreground/60">{label}</span>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {options.map(opt => (
          <button
            key={opt.key}
            onClick={() => onSelect(selected === opt.key ? null : opt.key)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-colors',
              selected === opt.key
                ? 'bg-orange-500/15 border-orange-500/50 text-orange-300'
                : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground'
            )}
          >
            <span>{opt.emoji}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function MultiChipGroup<T extends string>({
  label, options, selected, onToggle,
}: {
  label: string
  options: { key: T; label: string; emoji: string }[]
  selected: T[]
  onToggle: (key: T) => void
}) {
  return (
    <div>
      <span className="text-[10px] font-medium text-muted-foreground/60">{label}</span>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {options.map(opt => (
          <button
            key={opt.key}
            onClick={() => onToggle(opt.key)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-colors',
              selected.includes(opt.key)
                ? 'bg-orange-500/15 border-orange-500/50 text-orange-300'
                : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground'
            )}
          >
            <span>{opt.emoji}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Reference export card (right panel) ───────────────────────────────────────

function RefExportCard({ label, emoji, asset, refImage }: {
  label: string; emoji: string
  asset: { name: string; cover_image_url?: string | null } | null
  refImage?: RefImage | null
}) {
  if (!asset) return null

  const imageUrl = refImage?.url ?? asset.cover_image_url
  const sublabel = refImage?.label ?? null

  return (
    <div className="flex items-start gap-2.5">
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted/30 shrink-0 border border-border/40">
        {imageUrl ? (
          <img src={imageUrl} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg">{emoji}</div>
        )}
      </div>
      <div className="min-w-0 py-0.5">
        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">{label}</p>
        <p className="text-xs font-semibold truncate">{asset.name}</p>
        {sublabel ? (
          <p className="text-[10px] text-orange-400/70 truncate">{sublabel}</p>
        ) : (
          <p className="text-[10px] text-muted-foreground/30 truncate">Titelbild</p>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SceneBuilderPage() {
  const { characters, loading: loadingChars } = useCharacters()
  const { archetypes: characterArchetypes, loading: loadingCharArchetypes } = useCharacterArchetypes()
  const { outfits,    loading: loadingOutfits } = useOutfits()
  const { archetypes: outfitArchetypes, loading: loadingOutfitArchetypes } = useOutfitArchetypes()
  const { locations,  loading: loadingLocs } = useLocations()
  const { archetypes: locationArchetypes, loading: loadingArchetypes } = useLocationArchetypes()
  const { poseActions, loading: loadingPoses } = usePoseActions()
  const { assets: visualAssets, loading: loadingVisual } = useVisualAssets()
  const { styles, gradings, loading: loadingLookGrading } = useLookGrading()
  const {
    items: presetItems, loading: loadingPresets, createPreset, deletePreset,
    duplicatePreset, exportPreset, importPresetFromFile,
  } = useScenePresets()
  const [presetsOpen, setPresetsOpen] = useState(false)

  const cameras  = useMemo(() => visualAssets.filter(a => a.asset_type === 'camera'),  [visualAssets])
  const expressions = useMemo(() => visualAssets.filter(a => a.asset_type === 'expression'), [visualAssets])

  const [activeTab, setActiveTab] = useState<TabKey>('charaktere')
  const [scene, setScene] = useState<Scene>({
    scene_type: 'outdoor', time_of_day: null, season: null, weather: null,
    light_source: null, light_style: null, light_modifiers: [],
    shot_type: null, camera_angle: null, lens: null, depth_of_field: null, aspect_ratio: null,
    character: null, character_archetype: null, outfit: null, outfit_archetype: null,
    location: null, location_archetype: null, pose: null, expression: null, camera: null,
    style: null, grading: null, background: null,
  })

  // Reference images loaded from DB per asset (keyed by asset ID)
  const [refImagesMap, setRefImagesMap] = useState<Record<string, RefImage[]>>({})
  const [refLoadingMap, setRefLoadingMap] = useState<Record<string, boolean>>({})

  // Selected reference image per ref slot
  const [sceneRefs, setSceneRefs] = useState<SceneRefs>({
    character: null, character_archetype: null, outfit: null, outfit_archetype: null,
    location: null, location_archetype: null,
  })

  const prompt = useMemo(() => buildPrompt(scene, sceneRefs), [scene, sceneRefs])
  const hasAnyAsset = Boolean(
    scene.character || scene.character_archetype || scene.outfit || scene.outfit_archetype ||
    scene.location || scene.location_archetype || scene.pose || scene.expression || scene.camera || scene.style || scene.grading
  )
  const hasAnyCondition = Boolean(
    scene.time_of_day || scene.season || scene.weather || scene.light_source || scene.light_style || scene.light_modifiers.length > 0
  )
  const hasAnyCameraSetting = Boolean(
    scene.shot_type || scene.camera_angle || scene.lens || scene.depth_of_field || scene.aspect_ratio
  )

  // Indoor and Outdoor use mutually exclusive lighting parameters — switching scene type
  // clears whichever set no longer applies, so e.g. "Indoor + Gewitter" can never occur.
  function setSceneType(type: SceneType) {
    setScene(prev => {
      if (type === 'indoor') {
        return {
          ...prev,
          scene_type: type,
          weather: null,
          season: null,
          time_of_day: prev.time_of_day && OUTDOOR_ONLY_TIMES.includes(prev.time_of_day) ? null : prev.time_of_day,
        }
      }
      return {
        ...prev,
        scene_type: type,
        light_source: null,
        light_style: null,
        light_modifiers: [],
      }
    })
  }

  function setCondition<K extends 'time_of_day' | 'season' | 'weather' | 'light_source' | 'light_style'>(key: K, value: Scene[K]) {
    setScene(prev => ({ ...prev, [key]: value }))
  }

  function setBackground(value: BackgroundKey | null) {
    setScene(prev => ({ ...prev, background: value }))
  }

  function setCameraSetting<K extends 'shot_type' | 'camera_angle' | 'lens' | 'depth_of_field' | 'aspect_ratio'>(key: K, value: Scene[K]) {
    setScene(prev => ({ ...prev, [key]: value }))
  }

  function toggleLightModifier(key: LightModifierKey) {
    setScene(prev => ({
      ...prev,
      light_modifiers: prev.light_modifiers.includes(key)
        ? prev.light_modifiers.filter(m => m !== key)
        : [...prev.light_modifiers, key],
    }))
  }

  const loadRefImages_forSlot = useCallback(async (
    slotKey: RefSlotKey,
    assetId: string,
  ) => {
    if (refImagesMap[assetId] !== undefined) return // already loaded
    setRefLoadingMap(prev => ({ ...prev, [assetId]: true }))
    let imgs: RefImage[]
    if (slotKey === 'character_archetype' || slotKey === 'outfit_archetype' || slotKey === 'location_archetype') {
      const table = slotKey === 'character_archetype' ? 'character_archetype_images'
        : slotKey === 'outfit_archetype' ? 'outfit_archetype_images' : 'location_archetype_images'
      imgs = await loadArchetypeRefImages(table, assetId)
    } else {
      const table = slotKey === 'character' ? 'character_variants'
        : slotKey === 'outfit' ? 'outfit_variants' : 'location_variants'
      const fk = slotKey === 'character' ? 'character_id'
        : slotKey === 'outfit' ? 'outfit_id' : 'location_id'
      imgs = await loadRefImages(table, fk, assetId)
    }
    setRefImagesMap(prev => ({ ...prev, [assetId]: imgs }))
    setRefLoadingMap(prev => ({ ...prev, [assetId]: false }))
  }, [refImagesMap])

  function setSlot(key: SlotKey, value: Scene[SlotKey]) {
    setScene(prev => ({ ...prev, [key]: value }))

    // Auto-load ref images for character/outfit/location
    if (REF_SLOTS.includes(key as RefSlotKey) && value) {
      const slotKey = key as RefSlotKey
      const asset = value as { id: string }
      // Reset selected ref when changing asset
      setSceneRefs(prev => ({ ...prev, [slotKey]: null }))
      loadRefImages_forSlot(slotKey, asset.id)
    }
  }

  function clearSlot(key: SlotKey) {
    setScene(prev => ({ ...prev, [key]: null }))
    if (REF_SLOTS.includes(key as RefSlotKey)) {
      setSceneRefs(prev => ({ ...prev, [key as RefSlotKey]: null }))
    }
  }

  function clearAll() {
    setScene({
      scene_type: 'outdoor', time_of_day: null, season: null, weather: null,
      light_source: null, light_style: null, light_modifiers: [],
      shot_type: null, camera_angle: null, lens: null, depth_of_field: null, aspect_ratio: null,
      character: null, character_archetype: null, outfit: null, outfit_archetype: null,
      location: null, location_archetype: null, pose: null, expression: null, camera: null,
      style: null, grading: null, background: null,
    })
    setSceneRefs({
      character: null, character_archetype: null, outfit: null, outfit_archetype: null,
      location: null, location_archetype: null,
    })
  }

  function handleCopy() {
    if (!prompt) return
    navigator.clipboard.writeText(prompt)
    toast.success('Prompt kopiert!')
  }

  // ── Bildgenerierung (PROJ-37) ──────────────────────────────────────────────

  /**
   * Genau die Bilder, die im Abschnitt „Referenz-Export" angezeigt werden.
   * Dieselbe Vorrangregel wie dort und in buildPrompt: ein echtes Asset
   * verdrängt seinen Archetyp, und das gewählte Referenzbild schlägt das
   * Titelbild des Assets.
   */
  const referenzen = useMemo(() => {
    type MitTitelbild = { cover_image_url?: string | null } | null
    // Die Rolle geht mit, sonst weiß das Bildmodell nicht, welches Bild wofür
    // steht — und nimmt schon mal die Person aus dem Outfit-Bild.
    const paare: [MitTitelbild, RefImage | null, ReferenzRolle][] = [
      [scene.character,          sceneRefs.character,           'character'],
      [scene.character ? null : scene.character_archetype, sceneRefs.character_archetype, 'character'],
      [scene.outfit,             sceneRefs.outfit,              'outfit'],
      [scene.outfit ? null : scene.outfit_archetype,       sceneRefs.outfit_archetype,    'outfit'],
      [scene.location,           sceneRefs.location,            'location'],
      [scene.location ? null : scene.location_archetype,   sceneRefs.location_archetype,  'location'],
    ]
    const gesammelt: Referenz[] = []
    for (const [asset, ref, rolle] of paare) {
      if (!asset) continue
      const url = ref?.url ?? asset.cover_image_url
      if (url && !gesammelt.some(r => r.url === url)) gesammelt.push({ url, rolle })
    }
    return gesammelt
  }, [scene, sceneRefs])

  // ── Presets (PROJ-31A) ──────────────────────────────────────────────────────

  function buildPresetConfigFromScene(): ScenePresetConfig {
    return {
      scene_type: scene.scene_type,
      time_of_day: scene.time_of_day,
      season: scene.season,
      weather: scene.weather,
      light_source: scene.light_source,
      light_style: scene.light_style,
      light_modifiers: scene.light_modifiers,
      shot_type: scene.shot_type,
      camera_angle: scene.camera_angle,
      lens: scene.lens,
      depth_of_field: scene.depth_of_field,
      aspect_ratio: scene.aspect_ratio,
      background: scene.background,
      character_id: scene.character?.id ?? null,
      character_archetype_id: scene.character_archetype?.id ?? null,
      outfit_id: scene.outfit?.id ?? null,
      outfit_archetype_id: scene.outfit_archetype?.id ?? null,
      location_id: scene.location?.id ?? null,
      location_archetype_id: scene.location_archetype?.id ?? null,
      pose_id: scene.pose?.id ?? null,
      expression_id: scene.expression?.id ?? null,
      camera_id: scene.camera?.id ?? null,
      style_id: scene.style?.id ?? null,
      grading_id: scene.grading?.id ?? null,
      refs: {
        character: sceneRefs.character, character_archetype: sceneRefs.character_archetype,
        outfit: sceneRefs.outfit, outfit_archetype: sceneRefs.outfit_archetype,
        location: sceneRefs.location, location_archetype: sceneRefs.location_archetype,
      },
    }
  }

  const autoPresetCoverUrl =
    sceneRefs.location?.url ?? scene.location?.cover_image_url ??
    sceneRefs.location_archetype?.url ?? scene.location_archetype?.cover_image_url ??
    sceneRefs.character?.url ?? scene.character?.cover_image_url ??
    sceneRefs.character_archetype?.url ?? scene.character_archetype?.cover_image_url ??
    sceneRefs.outfit?.url ?? scene.outfit?.cover_image_url ??
    sceneRefs.outfit_archetype?.url ?? scene.outfit_archetype?.cover_image_url ??
    scene.style?.cover_image_url ?? scene.grading?.cover_image_url ?? null

  function applyPresetConfig(config: ScenePresetConfig) {
    setScene({
      scene_type: config.scene_type,
      time_of_day: config.time_of_day as TimeOfDayKey | null,
      season: config.season as SeasonKey | null,
      weather: config.weather as WeatherKey | null,
      light_source: config.light_source as LightSourceKey | null,
      light_style: config.light_style as LightStyleKey | null,
      light_modifiers: config.light_modifiers as LightModifierKey[],
      shot_type: config.shot_type as ShotTypeKey | null,
      camera_angle: config.camera_angle as CameraAngleKey | null,
      lens: config.lens as LensKey | null,
      depth_of_field: config.depth_of_field as DepthOfFieldKey | null,
      aspect_ratio: config.aspect_ratio as AspectRatioKey | null,
      background: config.background as BackgroundKey | null,
      character: config.character_id ? characters.find(c => c.id === config.character_id) ?? null : null,
      character_archetype: config.character_archetype_id ? characterArchetypes.find(a => a.id === config.character_archetype_id) ?? null : null,
      outfit: config.outfit_id ? outfits.find(o => o.id === config.outfit_id) ?? null : null,
      outfit_archetype: config.outfit_archetype_id ? outfitArchetypes.find(a => a.id === config.outfit_archetype_id) ?? null : null,
      location: config.location_id ? locations.find(l => l.id === config.location_id) ?? null : null,
      location_archetype: config.location_archetype_id ? locationArchetypes.find(a => a.id === config.location_archetype_id) ?? null : null,
      pose: config.pose_id ? poseActions.find(p => p.id === config.pose_id) ?? null : null,
      expression: config.expression_id ? expressions.find(e => e.id === config.expression_id) ?? null : null,
      camera: config.camera_id ? cameras.find(c => c.id === config.camera_id) ?? null : null,
      style: config.style_id ? styles.find(s => s.id === config.style_id) ?? null : null,
      grading: config.grading_id ? gradings.find(g => g.id === config.grading_id) ?? null : null,
    })
    setSceneRefs({
      character: config.refs.character,
      character_archetype: config.refs.character_archetype,
      outfit: config.refs.outfit,
      outfit_archetype: config.refs.outfit_archetype,
      location: config.refs.location,
      location_archetype: config.refs.location_archetype,
    })
    if (config.character_id) loadRefImages_forSlot('character', config.character_id)
    if (config.character_archetype_id) loadRefImages_forSlot('character_archetype', config.character_archetype_id)
    if (config.outfit_id) loadRefImages_forSlot('outfit', config.outfit_id)
    if (config.outfit_archetype_id) loadRefImages_forSlot('outfit_archetype', config.outfit_archetype_id)
    if (config.location_id) loadRefImages_forSlot('location', config.location_id)
    if (config.location_archetype_id) loadRefImages_forSlot('location_archetype', config.location_archetype_id)
    toast.success('Preset angewendet')
  }

  // ── Left panel content per tab ─────────────────────────────────────────────

  const leftContent = useMemo(() => {
    switch (activeTab) {
      case 'charaktere': return {
        loading: loadingChars,
        items: characters.map(c => ({ id: c.id, name: c.name, imageUrl: c.cover_image_url, isSelected: scene.character?.id === c.id, onSelect: () => setSlot('character', c) }))
      }
      case 'charakter_archetypen': return {
        loading: loadingCharArchetypes,
        items: characterArchetypes.map(a => ({ id: a.id, name: a.name, imageUrl: a.cover_image_url, isSelected: scene.character_archetype?.id === a.id, onSelect: () => setSlot('character_archetype', a) }))
      }
      case 'outfits': return {
        loading: loadingOutfits,
        items: outfits.map(o => ({ id: o.id, name: o.name, imageUrl: o.cover_image_url, isSelected: scene.outfit?.id === o.id, onSelect: () => setSlot('outfit', o) }))
      }
      case 'outfit_archetypen': return {
        loading: loadingOutfitArchetypes,
        items: outfitArchetypes.map(a => ({ id: a.id, name: a.name, imageUrl: a.cover_image_url, isSelected: scene.outfit_archetype?.id === a.id, onSelect: () => setSlot('outfit_archetype', a) }))
      }
      case 'locations': return {
        loading: loadingLocs,
        items: locations.map(l => ({ id: l.id, name: l.name, imageUrl: l.cover_image_url, isSelected: scene.location?.id === l.id, onSelect: () => setSlot('location', l) }))
      }
      case 'archetypen': return {
        loading: loadingArchetypes,
        items: locationArchetypes.map(a => ({ id: a.id, name: a.name, imageUrl: a.cover_image_url, isSelected: scene.location_archetype?.id === a.id, onSelect: () => setSlot('location_archetype', a) }))
      }
      case 'posen': return {
        loading: loadingPoses,
        items: poseActions.map(p => ({ id: p.id, name: p.name, imageUrl: p.cover_image_url, isSelected: scene.pose?.id === p.id, onSelect: () => setSlot('pose', p) }))
      }
      case 'ausdruck': return {
        loading: loadingVisual,
        items: expressions.map(e => ({ id: e.id, name: e.name, imageUrl: e.cover_image_url, isSelected: scene.expression?.id === e.id, onSelect: () => setSlot('expression', e) }))
      }
      case 'kamera': return {
        loading: loadingVisual,
        items: cameras.map(c => ({ id: c.id, name: c.name, imageUrl: c.cover_image_url, isSelected: scene.camera?.id === c.id, onSelect: () => setSlot('camera', c) }))
      }
      case 'stil': return {
        loading: loadingLookGrading,
        items: styles.map(s => ({ id: s.id, name: s.name, imageUrl: s.cover_image_url, isSelected: scene.style?.id === s.id, onSelect: () => setSlot('style', s) }))
      }
      case 'grading': return {
        loading: loadingLookGrading,
        items: gradings.map(g => ({ id: g.id, name: g.name, imageUrl: g.cover_image_url, isSelected: scene.grading?.id === g.id, onSelect: () => setSlot('grading', g) }))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, characters, characterArchetypes, outfits, outfitArchetypes, locations, locationArchetypes, poseActions, expressions, cameras, styles, gradings, scene, loadingChars, loadingCharArchetypes, loadingOutfits, loadingOutfitArchetypes, loadingLocs, loadingArchetypes, loadingPoses, loadingVisual, loadingLookGrading])

  const currentTab = TABS.find(t => t.key === activeTab)!

  return (
    <div className="flex h-svh min-w-0 overflow-hidden">

      {/* ── Col 1: Asset Selection ── */}
      <div className="w-[26rem] shrink-0 flex flex-col border-r border-border">
        <header className="border-b shrink-0 px-3 py-3 flex items-center gap-2">
          <SidebarTrigger />
          <span className="text-sm font-semibold">Scene Builder</span>
        </header>

        {/* Tabs */}
        <div className="border-b shrink-0 px-2 py-1.5 grid grid-cols-4 gap-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg text-[10px] font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-orange-500/15 text-orange-300'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <span className="text-base leading-none">{tab.emoji}</span>
              <span className="truncate w-full text-center leading-tight">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Asset list */}
        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden p-2" style={{ right: '-17px' }}>
            {leftContent.loading ? (
              <div className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[3/4] rounded-lg" />
                ))}
              </div>
            ) : leftContent.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-40 gap-2 text-center">
                <span className="text-3xl opacity-20">{currentTab.emoji}</span>
                <p className="text-[10px] text-muted-foreground/60">Noch keine {currentTab.label}</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {leftContent.items.map(item => (
                  <AssetThumb
                    key={item.id}
                    name={item.name}
                    imageUrl={item.imageUrl}
                    emoji={currentTab.emoji}
                    isSelected={item.isSelected}
                    onClick={item.onSelect}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Col 2: Scene Canvas ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="border-b shrink-0 px-4 py-2.5 flex items-center gap-3">
          <span className="font-semibold text-sm">🎬 Szene</span>
          <Button size="sm" variant="outline" className="h-7 text-xs ml-auto" onClick={() => setPresetsOpen(true)}>
            📁 Presets
          </Button>
          {hasAnyAsset && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={clearAll}>
              <X className="mr-1 h-3 w-3" />Leeren
            </Button>
          )}
        </header>

        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden p-4" style={{ right: '-17px' }}>

            {/* Szenentyp */}
            <div className="max-w-2xl mx-auto mb-4">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                🌍 Szenentyp
              </span>
              <div className="flex gap-2 mt-1.5">
                {SCENE_TYPES.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setSceneType(t.key)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                      scene.scene_type === t.key
                        ? 'bg-orange-500/15 border-orange-500/50 text-orange-300'
                        : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground'
                    )}
                  >
                    <span className={cn(
                      'w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0',
                      scene.scene_type === t.key ? 'border-orange-400' : 'border-current'
                    )}>
                      {scene.scene_type === t.key && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                    </span>
                    <span>{t.emoji}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Szenenbedingungen */}
            <div className="max-w-2xl mx-auto mb-4 space-y-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                🌤 Szenenbedingungen
              </span>
              <ChipGroup
                label="🌅 Tageszeit"
                options={scene.scene_type === 'indoor' ? TIME_OF_DAY.filter(t => !OUTDOOR_ONLY_TIMES.includes(t.key)) : TIME_OF_DAY}
                selected={scene.time_of_day}
                onSelect={v => setCondition('time_of_day', v)}
              />
              {scene.scene_type === 'outdoor' ? (
                <>
                  <ChipGroup label="🍂 Jahreszeit" options={SEASONS} selected={scene.season} onSelect={v => setCondition('season', v)} />
                  <ChipGroup label="🌧 Wetter" options={WEATHERS} selected={scene.weather} onSelect={v => setCondition('weather', v)} />
                </>
              ) : (
                <>
                  <ChipGroup label="💡 Lichtquelle" options={LIGHT_SOURCES} selected={scene.light_source} onSelect={v => setCondition('light_source', v)} />
                  <ChipGroup label="🎨 Lichtstil" options={LIGHT_STYLES} selected={scene.light_style} onSelect={v => setCondition('light_style', v)} />
                  <MultiChipGroup label="➕ Lichtmodifier" options={LIGHT_MODIFIERS} selected={scene.light_modifiers} onToggle={toggleLightModifier} />
                </>
              )}
            </div>

            {/* Kamera-Einstellungen */}
            <div className="max-w-2xl mx-auto mb-4 space-y-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                📷 Kamera-Einstellungen
              </span>
              <ChipGroup label="🖼️ Bildausschnitt" options={SHOT_TYPES} selected={scene.shot_type} onSelect={v => setCameraSetting('shot_type', v)} />
              <ChipGroup label="📐 Kamerawinkel" options={CAMERA_ANGLES} selected={scene.camera_angle} onSelect={v => setCameraSetting('camera_angle', v)} />
              <ChipGroup label="🔭 Objektiv" options={LENSES} selected={scene.lens} onSelect={v => setCameraSetting('lens', v)} />
              <ChipGroup label="🎯 Tiefenschärfe" options={DEPTH_OF_FIELDS} selected={scene.depth_of_field} onSelect={v => setCameraSetting('depth_of_field', v)} />
              <ChipGroup label="🖥️ Bildorientierung" options={ASPECT_RATIOS} selected={scene.aspect_ratio} onSelect={v => setCameraSetting('aspect_ratio', v)} />
            </div>

            {/* Studio-Hintergrund — nur relevant, solange keine Location/Archetyp gewählt ist */}
            {!scene.location && !scene.location_archetype && (
              <div className="max-w-2xl mx-auto mb-4 space-y-2.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  🖼️ Studio-Hintergrund
                </span>
                <p className="text-[10px] text-muted-foreground/40 -mt-1">
                  Wird ignoriert, sobald unten eine Location oder ein Location Archetype gewählt wird.
                </p>
                <ChipGroup label="🎨 Hintergrundfarbe" options={STUDIO_BACKGROUNDS} selected={scene.background} onSelect={setBackground} />
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto">
              {SLOTS.map(slot => {
                const assetId = (scene[slot.key] as { id: string } | null)?.id
                // An Archetype's own reference picker only matters when there is no matching
                // real asset — once a real Character/Outfit/Location is chosen, its image takes
                // over that role and the Archetype contributes its text description only.
                const archetypeRefSuppressed =
                  (slot.key === 'character_archetype' && Boolean(scene.character)) ||
                  (slot.key === 'outfit_archetype' && Boolean(scene.outfit)) ||
                  (slot.key === 'location_archetype' && Boolean(scene.location))
                const hasRef = REF_SLOTS.includes(slot.key as RefSlotKey) && !archetypeRefSuppressed
                return (
                  <div key={slot.key} className="group">
                    <SceneSlot
                      slot={slot}
                      asset={scene[slot.key] as { name: string; cover_image_url?: string | null } | null}
                      refImages={hasRef && assetId ? (refImagesMap[assetId] ?? []) : undefined}
                      refLoading={hasRef && assetId ? (refLoadingMap[assetId] ?? false) : undefined}
                      selectedRef={hasRef ? sceneRefs[slot.key as RefSlotKey] : undefined}
                      onSelectRef={hasRef ? (img) => setSceneRefs(prev => ({ ...prev, [slot.key]: img })) : undefined}
                      onClear={() => clearSlot(slot.key)}
                      onSelect={() => setActiveTab(slot.tab)}
                    />
                  </div>
                )
              })}
            </div>

            {!hasAnyAsset && (
              <p className="text-center text-xs text-muted-foreground/40 mt-8">
                Asset links auswählen → erscheint in der Szene
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Col 3: Prompt & References ── */}
      <div className="w-80 shrink-0 border-l border-border flex flex-col overflow-hidden">
        <header className="border-b shrink-0 px-3 py-2.5 flex items-center gap-2">
          <span className="text-sm font-semibold flex-1">Prompt & Referenzen</span>
          <Button size="sm" onClick={handleCopy} disabled={!prompt}
            className="h-7 text-[11px] bg-orange-600 hover:bg-orange-500 disabled:opacity-40 shrink-0">
            <Copy className="mr-1 h-3 w-3" />Kopieren
          </Button>
        </header>

        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden p-3 space-y-4" style={{ right: '-17px' }}>

            {/* Bildgenerierung (PROJ-37) — der Prompt bleibt unverändert, er wird nur weitergereicht */}
            <QueueButton
              prompt={prompt}
              referenzen={referenzen}
              aspectRatio={scene.aspect_ratio}
              sceneMeta={buildPresetConfigFromScene() as unknown as Record<string, unknown>}
            />

            {/* Szenentyp + Bedingungen badges */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 text-xs font-medium text-orange-300">
                <span>🌍</span>
                <span>{SCENE_TYPES.find(t => t.key === scene.scene_type)?.label}</span>
              </span>
              {hasAnyCondition && (
                <>
                  {scene.time_of_day && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                      {TIME_OF_DAY.find(t => t.key === scene.time_of_day)?.emoji} {TIME_OF_DAY.find(t => t.key === scene.time_of_day)?.label}
                    </span>
                  )}
                  {scene.scene_type === 'outdoor' && scene.season && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                      {SEASONS.find(s => s.key === scene.season)?.emoji} {SEASONS.find(s => s.key === scene.season)?.label}
                    </span>
                  )}
                  {scene.scene_type === 'outdoor' && scene.weather && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                      {WEATHERS.find(w => w.key === scene.weather)?.emoji} {WEATHERS.find(w => w.key === scene.weather)?.label}
                    </span>
                  )}
                  {scene.scene_type === 'indoor' && scene.light_source && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                      {LIGHT_SOURCES.find(s => s.key === scene.light_source)?.emoji} {LIGHT_SOURCES.find(s => s.key === scene.light_source)?.label}
                    </span>
                  )}
                  {scene.scene_type === 'indoor' && scene.light_style && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                      {LIGHT_STYLES.find(s => s.key === scene.light_style)?.emoji} {LIGHT_STYLES.find(s => s.key === scene.light_style)?.label}
                    </span>
                  )}
                  {scene.scene_type === 'indoor' && scene.light_modifiers.map(m => (
                    <span key={m} className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                      {LIGHT_MODIFIERS.find(x => x.key === m)?.emoji} {LIGHT_MODIFIERS.find(x => x.key === m)?.label}
                    </span>
                  ))}
                </>
              )}
              {hasAnyCameraSetting && (
                <>
                  {scene.shot_type && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                      {SHOT_TYPES.find(s => s.key === scene.shot_type)?.emoji} {SHOT_TYPES.find(s => s.key === scene.shot_type)?.label}
                    </span>
                  )}
                  {scene.camera_angle && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                      {CAMERA_ANGLES.find(a => a.key === scene.camera_angle)?.emoji} {CAMERA_ANGLES.find(a => a.key === scene.camera_angle)?.label}
                    </span>
                  )}
                  {scene.lens && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                      {LENSES.find(l => l.key === scene.lens)?.emoji} {LENSES.find(l => l.key === scene.lens)?.label}
                    </span>
                  )}
                  {scene.depth_of_field && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                      {DEPTH_OF_FIELDS.find(d => d.key === scene.depth_of_field)?.emoji} {DEPTH_OF_FIELDS.find(d => d.key === scene.depth_of_field)?.label}
                    </span>
                  )}
                  {scene.aspect_ratio && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                      {ASPECT_RATIOS.find(r => r.key === scene.aspect_ratio)?.emoji} {ASPECT_RATIOS.find(r => r.key === scene.aspect_ratio)?.label}
                    </span>
                  )}
                </>
              )}
              {!scene.location && !scene.location_archetype && scene.background && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                  {STUDIO_BACKGROUNDS.find(b => b.key === scene.background)?.emoji} {STUDIO_BACKGROUNDS.find(b => b.key === scene.background)?.label}
                </span>
              )}
            </div>

            {/* Prompt section */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-orange-400" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Prompt</span>
              </div>

              {prompt ? (
                <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                  <pre className="text-xs text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">{prompt}</pre>
                </div>
              ) : (
                <div className="rounded-xl border border-border/20 border-dashed p-6 flex flex-col items-center gap-2 text-center">
                  <span className="text-3xl opacity-20">✨</span>
                  <p className="text-[11px] text-muted-foreground/50">
                    Füge Assets zur Szene hinzu — der Prompt wird automatisch erzeugt.
                  </p>
                </div>
              )}
            </div>

            {/* Referenz-Export section */}
            {(scene.character || scene.character_archetype || scene.outfit || scene.outfit_archetype ||
              scene.location || scene.location_archetype) && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Referenz-Export
                </span>
                <p className="text-[10px] text-muted-foreground/40 -mt-1">
                  Diese Bilder werden als Referenz übergeben.
                </p>
                <div className="space-y-2.5">
                  <RefExportCard label="Charakter" emoji="👤" asset={scene.character} refImage={sceneRefs.character} />
                  {!scene.character && (
                    <RefExportCard label="Charakter-Archetyp" emoji="👥" asset={scene.character_archetype} refImage={sceneRefs.character_archetype} />
                  )}
                  <RefExportCard label="Outfit"    emoji="👗" asset={scene.outfit}    refImage={sceneRefs.outfit}    />
                  {!scene.outfit && (
                    <RefExportCard label="Outfit-Archetyp" emoji="🧥" asset={scene.outfit_archetype} refImage={sceneRefs.outfit_archetype} />
                  )}
                  <RefExportCard label="Location"  emoji="📍" asset={scene.location}  refImage={sceneRefs.location}  />
                  {!scene.location && (
                    <RefExportCard label="Archetyp" emoji="🏛️" asset={scene.location_archetype} refImage={sceneRefs.location_archetype} />
                  )}
                </div>
                {scene.character && scene.character_archetype && (
                  <p className="text-[10px] text-amber-400/80">
                    👥 Kombiniert mit Charakter-Archetyp „{scene.character_archetype.name}" — wird textlich in den Prompt eingebaut.
                  </p>
                )}
                {scene.outfit && scene.outfit_archetype && (
                  <p className="text-[10px] text-amber-400/80">
                    🧥 Kombiniert mit Outfit-Archetyp „{scene.outfit_archetype.name}" — wird textlich in den Prompt eingebaut.
                  </p>
                )}
                {scene.location && scene.location_archetype && (
                  <p className="text-[10px] text-amber-400/80">
                    🏛️ Kombiniert mit Archetyp „{scene.location_archetype.name}" — wird textlich in den Prompt eingebaut.
                  </p>
                )}
              </div>
            )}

            {/* Other assets (pose/expression/camera/style/grading) */}
            {(scene.pose || scene.expression || scene.camera || scene.style || scene.grading) && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Stil & Komposition
                </span>
                <div className="space-y-2">
                  {scene.pose && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-muted/30 shrink-0 border border-border/40 flex items-center justify-center text-sm">
                        {scene.pose.cover_image_url
                          ? <img src={scene.pose.cover_image_url} alt={scene.pose.name} className="w-full h-full object-cover" />
                          : '🎭'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Pose</p>
                        <p className="text-xs font-medium truncate">{scene.pose.name}</p>
                      </div>
                    </div>
                  )}
                  {scene.expression && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-muted/30 shrink-0 border border-border/40 flex items-center justify-center text-sm">
                        {scene.expression.cover_image_url
                          ? <img src={scene.expression.cover_image_url} alt={scene.expression.name} className="w-full h-full object-cover" />
                          : '😊'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Mimik</p>
                        <p className="text-xs font-medium truncate">{scene.expression.name}</p>
                      </div>
                    </div>
                  )}
                  {scene.camera && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-muted/30 shrink-0 border border-border/40 flex items-center justify-center text-sm">
                        {scene.camera.cover_image_url
                          ? <img src={scene.camera.cover_image_url} alt={scene.camera.name} className="w-full h-full object-cover" />
                          : '📷'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Kamera-Asset</p>
                        <p className="text-xs font-medium truncate">{scene.camera.name}</p>
                      </div>
                    </div>
                  )}
                  {scene.style && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-muted/30 shrink-0 border border-border/40 flex items-center justify-center text-sm">
                        {scene.style.cover_image_url
                          ? <img src={scene.style.cover_image_url} alt={scene.style.name} className="w-full h-full object-cover" />
                          : '🎥'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Stil</p>
                        <p className="text-xs font-medium truncate">{scene.style.name}</p>
                      </div>
                    </div>
                  )}
                  {scene.grading && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-muted/30 shrink-0 border border-border/40 flex items-center justify-center text-sm">
                        {scene.grading.cover_image_url
                          ? <img src={scene.grading.cover_image_url} alt={scene.grading.name} className="w-full h-full object-cover" />
                          : '🎨'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Grading</p>
                        <p className="text-xs font-medium truncate">{scene.grading.name}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <ScenePresetDialog
        open={presetsOpen}
        onClose={() => setPresetsOpen(false)}
        items={presetItems}
        loading={loadingPresets}
        currentConfig={buildPresetConfigFromScene()}
        autoCoverUrl={autoPresetCoverUrl}
        onApply={applyPresetConfig}
        onCreate={createPreset}
        onDelete={deletePreset}
        onDuplicate={duplicatePreset}
        onExport={exportPreset}
        onImport={importPresetFromFile}
        characters={characters}
        characterArchetypes={characterArchetypes}
        outfits={outfits}
        outfitArchetypes={outfitArchetypes}
        locations={locations}
        locationArchetypes={locationArchetypes}
        poseActions={poseActions}
        expressions={expressions}
        cameras={cameras}
        styles={styles}
        gradings={gradings}
      />
    </div>
  )
}

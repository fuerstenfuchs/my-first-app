/**
 * Die Prompt-Erzeugung des Scene Builders — die Regeln, ohne Oberfläche.
 *
 * Wörtlich aus der Scene-Builder-Seite herausgelöst (PROJ-51), Zeichen für
 * Zeichen unverändert. Die Seite importiert sie jetzt von hier.
 *
 * WARUM DIE VERSCHIEBUNG: Der Knopf „Titelbild erzeugen" im Charakter-Bereich
 * braucht denselben Prompt wie der Scene Builder. Eine zweite Umsetzung wäre
 * genau die Doppelung, die später auseinanderläuft — und die es hier besonders
 * teuer täte, weil ein Prompt-Unterschied nicht als Fehler auffällt, sondern
 * als leicht anderes Bild.
 *
 * Absichtlich frei von React und Supabase: Diese Logik hatte bisher gar keine
 * Tests, weil sie in einer Seitenkomponente steckte. Als reine Funktionen ist
 * sie ohne Anmeldung prüfbar.
 */
import type { Character } from '@/hooks/use-characters'
import type { Outfit } from '@/hooks/use-outfits'
import type { Location } from '@/hooks/use-locations'
import type { LocationArchetype } from '@/hooks/use-location-archetypes'
import type { CharacterArchetype } from '@/hooks/use-character-archetypes'
import type { OutfitArchetype } from '@/hooks/use-outfit-archetypes'
import type { PoseAction } from '@/hooks/use-pose-actions'
import type { VisualAsset } from '@/hooks/use-visual-assets'
import type { LookGradingItem } from '@/hooks/use-look-grading'
import type { RefImage } from '@/lib/reference-images'
import {
  type SceneType, type TimeOfDayKey, type SeasonKey, type WeatherKey,
  type LightSourceKey, type LightStyleKey, type LightModifierKey, type BackgroundKey,
  type ShotTypeKey, type CameraAngleKey, type LensKey, type DepthOfFieldKey, type AspectRatioKey,
  TIME_OF_DAY, SEASONS, WEATHERS,
  LIGHT_SOURCES, LIGHT_STYLES, LIGHT_MODIFIERS, STUDIO_BACKGROUNDS,
  SHOT_TYPES, CAMERA_ANGLES, LENSES, DEPTH_OF_FIELDS, ASPECT_RATIOS,
} from '@/lib/scene-builder-options'

export type SceneRefs = {
  character: RefImage | null
  character_archetype: RefImage | null
  outfit:    RefImage | null
  outfit_archetype: RefImage | null
  location:  RefImage | null
  location_archetype: RefImage | null
}

export type Scene = {
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

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Merges the active environmental/lighting parameters into one natural, flowing sentence
// instead of stacking the raw selected terms underneath each other.
export function buildEnvironmentSentence(scene: Scene): string | null {
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
export function buildCameraSentence(scene: Scene): string | null {
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
export function buildCharacterSection(scene: Scene, sceneRefs: SceneRefs): string[] {
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
export function buildOutfitSection(scene: Scene, sceneRefs: SceneRefs): string[] {
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
export function buildLocationSection(scene: Scene, sceneRefs: SceneRefs): string[] {
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

export function buildPrompt(scene: Scene, sceneRefs: SceneRefs): string {
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
// Shared types for PROJ-31A (Scene Builder Preset-System).
// A preset config never embeds asset data itself — only IDs (resolved against the live
// characters/outfits/locations/etc. lists when applied) plus the chosen reference image
// for character/outfit/location, and all scalar Scene Builder configuration values.

export type SceneTypeKey = 'outdoor' | 'indoor'

export interface ScenePresetRef {
  url:   string
  label: string
}

export interface ScenePresetConfig {
  scene_type:      SceneTypeKey
  time_of_day:     string | null
  season:          string | null
  weather:         string | null
  light_source:    string | null
  light_style:     string | null
  light_modifiers: string[]
  shot_type:       string | null
  camera_angle:    string | null
  lens:            string | null
  depth_of_field:  string | null
  aspect_ratio:    string | null
  background:      string | null
  character_id:    string | null
  character_archetype_id: string | null
  outfit_id:       string | null
  outfit_archetype_id: string | null
  location_id:     string | null
  location_archetype_id: string | null
  pose_id:         string | null
  expression_id:   string | null
  camera_id:       string | null
  style_id:        string | null
  grading_id:      string | null
  refs: {
    character: ScenePresetRef | null
    character_archetype: ScenePresetRef | null
    outfit:    ScenePresetRef | null
    outfit_archetype: ScenePresetRef | null
    location:  ScenePresetRef | null
    location_archetype: ScenePresetRef | null
  }
}

export const EMPTY_PRESET_CONFIG: ScenePresetConfig = {
  scene_type: 'outdoor', time_of_day: null, season: null, weather: null,
  light_source: null, light_style: null, light_modifiers: [],
  shot_type: null, camera_angle: null, lens: null, depth_of_field: null, aspect_ratio: null,
  background: null,
  character_id: null, character_archetype_id: null, outfit_id: null, outfit_archetype_id: null,
  location_id: null, location_archetype_id: null, pose_id: null,
  expression_id: null, camera_id: null, style_id: null, grading_id: null,
  refs: { character: null, character_archetype: null, outfit: null, outfit_archetype: null, location: null, location_archetype: null },
}

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
  /** PROJ-56 — Boden und Wind als eigene Achsen. Alte Presets kennen sie
   *  nicht; `EMPTY_PRESET_CONFIG` unten faengt sie auf, wie schon bei den
   *  entfallenen Archetyp-Feldern. */
  ground:          string | null
  wind:            string | null
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
  outfit_id:       string | null
  location_id:     string | null
  pose_id:         string | null
  expression_id:   string | null
  camera_id:       string | null
  style_id:        string | null
  grading_id:      string | null
  refs: {
    character: ScenePresetRef | null
    outfit:    ScenePresetRef | null
    location:  ScenePresetRef | null
  }
}

/**
 * Der leere Grundzustand — und zugleich die Stelle, an der ALTE Presets
 * überleben.
 *
 * Mit PROJ-52 sind `character_archetype_id`, `outfit_archetype_id`,
 * `location_archetype_id` und die drei `refs.*_archetype` aus diesem Typ
 * entfallen. In der Datenbank stehen sie in gespeicherten Presets aber
 * weiterhin. Das Laden darf daran NICHT scheitern — und tut es auch nicht:
 * `use-scene-presets.ts` liest jedes Preset als
 * `{ ...EMPTY_PRESET_CONFIG, ...row.config }`. Ein unbekanntes Feld aus der
 * Datenbank wird dabei schlicht mitkopiert und danach von niemandem mehr
 * gelesen; ein FEHLENDES Feld bekommt seinen Wert von hier. Kein Schema-Check,
 * keine Ausnahme — deshalb ist der Rückbau für gespeicherte Presets
 * geräuschlos.
 */
export const EMPTY_PRESET_CONFIG: ScenePresetConfig = {
  scene_type: 'outdoor', time_of_day: null, season: null, weather: null,
  ground: null, wind: null,
  light_source: null, light_style: null, light_modifiers: [],
  shot_type: null, camera_angle: null, lens: null, depth_of_field: null, aspect_ratio: null,
  background: null,
  character_id: null, outfit_id: null,
  location_id: null, pose_id: null,
  expression_id: null, camera_id: null, style_id: null, grading_id: null,
  refs: { character: null, outfit: null, location: null },
}

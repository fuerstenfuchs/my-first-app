import { EMPTY_PRESET_CONFIG, type ScenePresetConfig } from './scene-preset-types'

export interface StandardScenePreset {
  key:         string
  name:        string
  description: string
  category:    string
  emoji:       string
  config:      ScenePresetConfig
}

// Mitgelieferte Standard-Presets (PROJ-31A). Referenzieren bewusst keine Charaktere/Outfits/
// Locations — die existieren nur als Nutzer-eigene Bibliothekseinträge und können nicht
// sinnvoll vorbefüllt werden. Style/Grading-Keys verweisen auf die Standard-Einträge aus
// look-grading-presets.ts (id-Schema "standard:<key>", siehe use-look-grading.ts).
export const STANDARD_SCENE_PRESETS: StandardScenePreset[] = [
  {
    key: 'luxury_portrait',
    name: 'Luxury Portrait',
    description: 'Edles Studio-Porträt mit Beauty-Light.',
    category: 'Portrait',
    emoji: '💎',
    config: {
      ...EMPTY_PRESET_CONFIG,
      scene_type: 'indoor',
      shot_type: 'headshot',
      light_source: 'beauty_dish',
      style_id: 'standard:luxury_portrait',
      grading_id: 'standard:natuerlich',
    },
  },
  {
    key: 'fashion_editorial',
    name: 'Fashion Editorial',
    description: 'Hochglanz-Modefotografie im Studio, High Key.',
    category: 'Fashion',
    emoji: '✨',
    config: {
      ...EMPTY_PRESET_CONFIG,
      scene_type: 'indoor',
      shot_type: 'full_body',
      light_style: 'high_key',
      style_id: 'standard:fashion_editorial',
    },
  },
  {
    key: 'netflix_drama',
    name: 'Netflix Drama',
    description: 'Dunkler, kinoreifer Serien-Look mit Moody Light.',
    category: 'Film',
    emoji: '🎬',
    config: {
      ...EMPTY_PRESET_CONFIG,
      scene_type: 'indoor',
      shot_type: 'half_body',
      light_style: 'moody',
      style_id: 'standard:netflix_drama',
      grading_id: 'standard:cinematic_cool',
    },
  },
  {
    key: 'music_video',
    name: 'Music Video',
    description: 'Clubbeleuchtung mit kräftigem Teal & Orange.',
    category: 'Musikvideo',
    emoji: '🎵',
    config: {
      ...EMPTY_PRESET_CONFIG,
      scene_type: 'indoor',
      light_style: 'club_lighting',
      style_id: 'standard:musikvideo',
      grading_id: 'standard:teal_orange',
    },
  },
  {
    key: 'instagram_lifestyle',
    name: 'Instagram Lifestyle',
    description: 'Lockerer Lifestyle-Look zur Golden Hour.',
    category: 'Social Media',
    emoji: '📱',
    config: {
      ...EMPTY_PRESET_CONFIG,
      scene_type: 'outdoor',
      time_of_day: 'golden_hour',
      style_id: 'standard:instagram_lifestyle',
      grading_id: 'standard:cinematic_warm',
    },
  },
  {
    key: 'documentary',
    name: 'Documentary',
    description: 'Natürliches Licht, unaufdringliche Reportage-Optik.',
    category: 'Film',
    emoji: '🎥',
    config: {
      ...EMPTY_PRESET_CONFIG,
      scene_type: 'outdoor',
      style_id: 'standard:dokumentarisch',
      grading_id: 'standard:natuerlich',
    },
  },
  {
    key: 'street_photography',
    name: 'Street Photography',
    description: 'Rohe urbane Straßenfotografie, gedämpfte Farben.',
    category: 'Outdoor',
    emoji: '🏙️',
    config: {
      ...EMPTY_PRESET_CONFIG,
      scene_type: 'outdoor',
      style_id: 'standard:street_photography',
      grading_id: 'standard:muted_colors',
    },
  },
  {
    key: 'epic_fantasy',
    name: 'Epic Fantasy',
    description: 'Episches Fantasy-Bildgefühl, warmes Cinematic Grading.',
    category: 'Film',
    emoji: '🐉',
    config: {
      ...EMPTY_PRESET_CONFIG,
      scene_type: 'outdoor',
      style_id: 'standard:fantasy_epic',
      grading_id: 'standard:cinematic_warm',
    },
  },
  {
    key: 'scifi',
    name: 'Sci-Fi',
    description: 'Futuristische Science-Fiction-Ästhetik, kühles Grading.',
    category: 'Film',
    emoji: '🛰️',
    config: {
      ...EMPTY_PRESET_CONFIG,
      scene_type: 'indoor',
      style_id: 'standard:scifi_cinematic',
      grading_id: 'standard:cinematic_cool',
    },
  },
]

export const PRESET_CATEGORIES = [
  'Portrait', 'Fashion', 'Film', 'Musikvideo', 'Studio', 'Outdoor', 'Social Media', 'Eigene',
] as const

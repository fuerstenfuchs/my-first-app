/**
 * Titelbild aus dem Preset „Calvanize Studio" (PROJ-51) — die Regeln, ohne
 * Oberfläche und ohne Supabase.
 *
 * Mark macht das heute von Hand: Scene Builder öffnen, sein Preset laden, das
 * Referenzsheet des Charakters als Charakter-Referenz einsetzen, erzeugen,
 * Ergebnis von Hand als Titelbild setzen. Fünf Handgriffe, bei jedem Charakter.
 *
 * Hier steht die eine Stelle, an der aus einem gespeicherten Preset plus einem
 * Zielcharakter die Szene wird. Als reine Funktion, weil genau hier ein Fehler
 * teuer wäre — siehe `titelbildSzene` unten.
 */

import type { ScenePresetConfig } from './scene-preset-types'
import type { Scene, SceneRefs } from './szene-prompt'
import { VARIANTEN_NAME } from './referenzkette'
import type {
  SceneType, TimeOfDayKey, SeasonKey, WeatherKey,
  LightSourceKey, LightStyleKey, LightModifierKey, BackgroundKey,
  ShotTypeKey, CameraAngleKey, LensKey, DepthOfFieldKey, AspectRatioKey,
} from './scene-builder-options'
import type { Character } from '@/hooks/use-characters'
import type { PoseAction } from '@/hooks/use-pose-actions'
import type { VisualAsset } from '@/hooks/use-visual-assets'
import type { LookGradingItem } from '@/hooks/use-look-grading'

/**
 * Der Name des Presets, an dem der Knopf hängt.
 *
 * DAS IST MARKS EIGENES, IN DER DATENBANK GESPEICHERTES PRESET — kein
 * Standard-Preset aus dem Code. Es steht in der Tabelle `scene_presets` und
 * heißt dort genau so. Benennt Mark es um, findet der Knopf es nicht mehr;
 * deshalb nennt die Fehlermeldung den gesuchten Namen wörtlich, statt nur
 * „Preset nicht gefunden" zu sagen. Der Vergleich ignoriert
 * Groß-/Kleinschreibung — dieselbe Nachsicht wie überall sonst bei Namen in
 * diesem Projekt.
 */
export const TITELBILD_PRESET_NAME = 'Calvanize Studio'

/**
 * Die Variante, in die das erzeugte Titelbild gelegt wird.
 *
 * Eines der sieben Fächer, die seit PROJ-50 bei jedem neuen Charakter
 * bereitstehen (`STANDARD_VARIANTEN` in `charakter-varianten.ts`). Bei älteren
 * Charakteren fehlt es und wird angelegt.
 */
export const TITELBILD_VARIANTE = 'Calvanize'

/** Eine Variante, so weit sie für die Suche nach dem Referenzsheet zählt. */
export type VarianteMitBildern = {
  name: string
  images: { url: string; sort_order: number }[] | null
}

/**
 * Das Referenzsheet-Bild eines Charakters — oder `null`.
 *
 * Gesucht wird die Variante mit dem Namen aus `VARIANTEN_NAME.referenzsheet`,
 * Groß-/Kleinschreibung und umgebende Leerzeichen egal — genau wie
 * `varianteHolen` in `use-referenzkette.ts` vergleicht. Sonst gälte ein von
 * Hand angelegtes „referenzsheet" als etwas anderes und der Knopf bliebe
 * grundlos gesperrt.
 *
 * Genommen wird das Bild mit der HÖCHSTEN `sort_order`, also das jüngste: Wenn
 * Mark die Referenzkette ein zweites Mal laufen lässt, ist das neue Sheet
 * gemeint, nicht das alte.
 */
export function referenzsheetBild(varianten: readonly VarianteMitBildern[]): string | null {
  const treffer = varianten.find(
    v => String(v.name ?? '').trim().toLowerCase() === VARIANTEN_NAME.referenzsheet.toLowerCase(),
  )
  const bilder = treffer?.images ?? []
  if (bilder.length === 0) return null
  return [...bilder].sort((a, b) => b.sort_order - a.sort_order)[0]!.url
}

/**
 * Die Listen, gegen die ein Preset seine `*_id`-Felder auflöst.
 *
 * Dieselben, die auch der Scene Builder in `applyPresetConfig` benutzt —
 * hereingereicht statt hier geladen, damit die Regel ohne Anmeldung prüfbar
 * bleibt.
 */
export type Nachschlagelisten = {
  poseActions: PoseAction[]
  expressions: VisualAsset[]
  cameras:     VisualAsset[]
  styles:      LookGradingItem[]
  gradings:    LookGradingItem[]
}

export type Zielcharakter = {
  character: Character
  /** Die Adresse des Referenzsheet-Bildes dieses Charakters. */
  referenzsheetUrl: string
}

/**
 * Aus Preset plus Zielcharakter die Szene für `buildPrompt` bauen.
 *
 * DIE EINE REGEL, DIE HIER ZÄHLT: `character` und `sceneRefs.character` kommen
 * IMMER vom Zielcharakter — niemals aus dem Preset.
 *
 * Warum das ausdrücklich dasteht: In Marks gespeichertem Preset stecken noch
 * `character_id` und `refs.character` des FREMDEN Charakters, mit dem er das
 * Preset damals gebaut hat. Würden die durchgereicht, erzeugte der Knopf für
 * jeden Charakter das Gesicht dieser einen anderen Person — und zwar ohne
 * jede Fehlermeldung, denn technisch wäre alles in Ordnung. Aufgefallen wäre
 * es erst am fertigen, bezahlten Bild.
 *
 * Aus demselben Grund werden Charakter-Archetyp, Outfit, Outfit-Archetyp,
 * Location und Location-Archetyp samt ihrer Referenzen auf `null` gesetzt: Im
 * Preset „Calvanize Studio" steht dort heute nichts, aber „steht heute nichts
 * drin" ist keine Zusicherung. Ein später hinzugefügter Rest darf nicht
 * unbemerkt in ein Titelbild rutschen.
 *
 * Alles andere — Licht, Kamera, Hintergrund, Stil, Grading, Mimik, Pose,
 * Format — kommt unverändert aus dem Preset. Das ist der Sinn der Sache: Es
 * soll genau der Look sein, den Mark gespeichert hat.
 */
export function titelbildSzene(
  config: ScenePresetConfig,
  listen: Nachschlagelisten,
  ziel: Zielcharakter,
): { scene: Scene; sceneRefs: SceneRefs } {
  const scene: Scene = {
    scene_type:      config.scene_type as SceneType,
    time_of_day:     config.time_of_day as TimeOfDayKey | null,
    season:          config.season as SeasonKey | null,
    weather:         config.weather as WeatherKey | null,
    light_source:    config.light_source as LightSourceKey | null,
    light_style:     config.light_style as LightStyleKey | null,
    light_modifiers: (config.light_modifiers ?? []) as LightModifierKey[],
    shot_type:       config.shot_type as ShotTypeKey | null,
    camera_angle:    config.camera_angle as CameraAngleKey | null,
    lens:            config.lens as LensKey | null,
    depth_of_field:  config.depth_of_field as DepthOfFieldKey | null,
    aspect_ratio:    config.aspect_ratio as AspectRatioKey | null,
    background:      config.background as BackgroundKey | null,

    // Der Zielcharakter — nicht der aus dem Preset. Siehe Kommentar oben.
    character: ziel.character,

    // Bewusst leer geräumt, nicht durchgereicht.
    character_archetype: null,
    outfit:              null,
    outfit_archetype:    null,
    location:            null,
    location_archetype:  null,

    pose:       config.pose_id       ? listen.poseActions.find(p => p.id === config.pose_id)   ?? null : null,
    expression: config.expression_id ? listen.expressions.find(e => e.id === config.expression_id) ?? null : null,
    camera:     config.camera_id     ? listen.cameras.find(c => c.id === config.camera_id)     ?? null : null,
    style:      config.style_id      ? listen.styles.find(s => s.id === config.style_id)       ?? null : null,
    grading:    config.grading_id    ? listen.gradings.find(g => g.id === config.grading_id)   ?? null : null,
  }

  const sceneRefs: SceneRefs = {
    // Das Referenzsheet ist die Charakterreferenz — das ist der ganze Zweck des
    // Knopfes. Die Beschriftung kommt aus `VARIANTEN_NAME`, damit sie nicht
    // neben dem Variantennamen herläuft.
    character: { url: ziel.referenzsheetUrl, label: VARIANTEN_NAME.referenzsheet },
    character_archetype: null,
    outfit:              null,
    outfit_archetype:    null,
    location:            null,
    location_archetype:  null,
  }

  return { scene, sceneRefs }
}

// Shared Scene Builder option catalogs (chip-group choices + their prompt fragments).
// Extracted out of scene-builder/page.tsx so the Preset system (PROJ-31A) can resolve
// readable labels for a saved preset's config without importing from a page file.

export type SceneType = 'outdoor' | 'indoor'

export type TimeOfDayKey = 'sonnenaufgang' | 'morgen' | 'vormittag' | 'mittag' | 'nachmittag' | 'golden_hour' | 'sonnenuntergang' | 'blaue_stunde' | 'nacht'
export type SeasonKey    = 'fruehling' | 'sommer' | 'herbst' | 'winter'
export type WeatherKey   = 'sonnig' | 'leicht_bewoelkt' | 'bewoelkt' | 'leichter_regen' | 'starker_regen' | 'nebel' | 'schnee' | 'gewitter' | 'sturm'
export type LightSourceKey = 'fensterlicht' | 'softbox' | 'beauty_dish' | 'ring_light' | 'spot_light' | 'deckenbeleuchtung' | 'neonlicht' | 'kerzenlicht' | 'kaminfeuer' | 'mischlicht'
export type LightStyleKey  = 'soft_studio' | 'high_key' | 'low_key' | 'cinematic' | 'dramatic' | 'fashion_editorial' | 'commercial' | 'moody' | 'natural_indoor' | 'club_lighting' | 'rembrandt'
export type LightModifierKey = 'fill_light' | 'rim_light' | 'hair_light' | 'bounce_light' | 'catchlights'
export type BackgroundKey = 'white' | 'black' | 'grey' | 'beige' | 'pastel_pink' | 'pastel_blue' | 'sage_green' | 'navy' | 'terracotta' | 'gradient_grey' | 'green_screen'

export type ShotTypeKey = 'extreme_closeup' | 'closeup' | 'headshot' | 'portrait' | 'half_body' | 'three_quarter' | 'full_body' | 'wide_shot' | 'environmental_portrait' | 'establishing_shot'
export type CameraAngleKey = 'eye_level' | 'slight_low' | 'low_angle' | 'slight_high' | 'high_angle' | 'birds_eye' | 'worms_eye' | 'overhead'
export type LensKey = '24mm' | '35mm' | '50mm' | '85mm' | '135mm' | '200mm'
export type DepthOfFieldKey = 'deep_focus' | 'moderate_dof' | 'shallow_dof' | 'ultra_shallow_dof'
export type AspectRatioKey = 'portrait_4_5' | 'landscape_16_9' | 'square_1_1'
  | 'cinematic_21_9' | 'story_9_16' | 'classic_4_3' | 'classic_3_4'

export const SCENE_TYPES: { key: SceneType; label: string; emoji: string }[] = [
  { key: 'outdoor', label: 'Outdoor', emoji: '🌳' },
  { key: 'indoor',  label: 'Indoor',  emoji: '🏠' },
]

// Time-of-day entries that strongly imply direct outdoor sunlight — hidden when Indoor is active
export const OUTDOOR_ONLY_TIMES: TimeOfDayKey[] = ['sonnenaufgang', 'golden_hour', 'sonnenuntergang', 'blaue_stunde']

export const TIME_OF_DAY: { key: TimeOfDayKey; label: string; emoji: string; prompt: string }[] = [
  { key: 'sonnenaufgang',   label: 'Sonnenaufgang',   emoji: '🌅', prompt: 'warm sunrise sunlight with soft pink and orange hues low on the horizon, long soft shadows' },
  { key: 'morgen',          label: 'Morgen',          emoji: '🌤️', prompt: 'fresh early morning light, cool soft tones' },
  { key: 'vormittag',       label: 'Vormittag',       emoji: '🌤️', prompt: 'bright late morning light, crisp and clear' },
  { key: 'mittag',          label: 'Mittag',          emoji: '☀️', prompt: 'strong midday light with hard, short shadows' },
  { key: 'nachmittag',      label: 'Nachmittag',      emoji: '🌇', prompt: 'warm afternoon light, slightly angled sunlight' },
  { key: 'golden_hour',     label: 'Golden Hour',     emoji: '🌆', prompt: 'warm golden-hour sunlight, soft long shadows' },
  { key: 'sonnenuntergang', label: 'Sonnenuntergang', emoji: '🌅', prompt: 'deep orange and red sunset tones spreading across the horizon' },
  { key: 'blaue_stunde',    label: 'Blaue Stunde',    emoji: '🌌', prompt: 'soft cool blue twilight just after sunset' },
  { key: 'nacht',           label: 'Nacht',           emoji: '🌙', prompt: 'dark nighttime atmosphere lit mainly by artificial light sources' },
]

export const SEASONS: { key: SeasonKey; label: string; emoji: string; prompt: string }[] = [
  { key: 'fruehling', label: 'Frühling', emoji: '🌸', prompt: 'fresh spring atmosphere with blooming flowers and green foliage' },
  { key: 'sommer',    label: 'Sommer',   emoji: '☀️', prompt: 'lush summer atmosphere, warm air and vivid greenery' },
  { key: 'herbst',    label: 'Herbst',   emoji: '🍂', prompt: 'crisp autumn atmosphere with golden and red fallen leaves' },
  { key: 'winter',    label: 'Winter',   emoji: '❄️', prompt: 'cold winter atmosphere with bare trees and possibly snow' },
]

export const WEATHERS: { key: WeatherKey; label: string; emoji: string; prompt: string }[] = [
  { key: 'sonnig',          label: 'Sonnig',          emoji: '☀️', prompt: 'clear sunny sky' },
  { key: 'leicht_bewoelkt', label: 'Leicht bewölkt',  emoji: '🌤️', prompt: 'partly cloudy sky' },
  { key: 'bewoelkt',        label: 'Bewölkt',         emoji: '☁️', prompt: 'overcast sky with even, diffused light' },
  { key: 'leichter_regen',  label: 'Leichter Regen',  emoji: '🌦️', prompt: 'light rain falling, wet surfaces with subtle reflections' },
  { key: 'starker_regen',   label: 'Starker Regen',   emoji: '🌧️', prompt: 'heavy rain falling, glistening wet surfaces' },
  { key: 'nebel',           label: 'Nebel',           emoji: '🌫️', prompt: 'foggy atmosphere with reduced visibility' },
  // NUR NOCH DER NIEDERSCHLAG (PROJ-56). Vorher stand hier „falling snow
  // over snow-covered surfaces" — Schneefall UND Schneedecke in einem
  // Schluessel. Damit war der haeufigste Winterfall, Schneedecke bei klarem
  // Himmel, gar nicht formulierbar. Was am Boden liegt, steht jetzt in
  // GROUND_STATES. Der Schluessel bleibt `schnee`, weil gespeicherte
  // Presets ihn tragen und `find(...)!` sonst hart abstuerzt.
  { key: 'schnee',          label: 'Schneefall',      emoji: '🌨️', prompt: 'snow falling through the air' },
  { key: 'gewitter',        label: 'Gewitter',        emoji: '⛈️', prompt: 'dark dramatic thunderstorm sky' },
  { key: 'sturm',           label: 'Sturm',           emoji: '🌬️', prompt: 'turbulent stormy sky with strong wind' },
]

/**
 * Was am Boden liegt — unabhaengig davon, was vom Himmel kommt (PROJ-56).
 *
 * Mark: „Es kann natuerlich auch sein, dass zwar Schnee liegt, aber die Sonne
 * scheint." Genau dafuer ist diese Achse da. Nur draussen sinnvoll.
 */
export type GroundStateKey = 'schneedecke' | 'nass' | 'pfuetzen' | 'laub' | 'trocken'

export const GROUND_STATES: { key: GroundStateKey; label: string; emoji: string; prompt: string }[] = [
  { key: 'schneedecke', label: 'Schneedecke', emoji: '❄️', prompt: 'snow-covered ground' },
  { key: 'nass',        label: 'Nasser Boden', emoji: '💧', prompt: 'wet ground with soft reflections' },
  { key: 'pfuetzen',    label: 'Pfützen',     emoji: '🪞', prompt: 'puddles on the ground mirroring the scene' },
  { key: 'laub',        label: 'Laub',        emoji: '🍂', prompt: 'fallen leaves covering the ground' },
  { key: 'trocken',     label: 'Trocken',     emoji: '🏜️', prompt: 'dry, dusty ground' },
]

/**
 * Wind — und zwar DRINNEN WIE DRAUSSEN (PROJ-56).
 *
 * Mark: „In einem Studio koennte auch eine Windmaschine sein, sodass das Haar
 * verweht wird. Diese Tatsache sollte man auch noch mit einbauen koennen. Ist
 * ja auch realistisch."
 *
 * WARUM EIN EIGENES FELD UND NICHT IN `WEATHERS`: Die Wetterliste wertet
 * `buildEnvironmentSentence` ausschliesslich bei `scene_type === 'outdoor'`
 * aus. Wind soll aber gerade auch drinnen wirken — dort ist er die
 * Windmaschine. Deshalb zwei Textfassungen je Stufe: `prompt` fuer draussen,
 * `studio` fuer drinnen. Drinnen darf kein Wettertext auftauchen, sonst stuenden
 * wehende Blaetter im Studio.
 */
export type WindKey = 'windstill' | 'brise' | 'boeig' | 'stark'

export const WINDS: { key: WindKey; label: string; emoji: string; prompt: string; studio: string }[] = [
  { key: 'windstill', label: 'Windstill', emoji: '🍃',
    prompt: 'still air, no wind',
    studio: 'no air movement, hair and fabric completely still' },
  { key: 'brise',     label: 'Leichte Brise', emoji: '🌾',
    prompt: 'a light breeze gently moving hair and fabric',
    studio: 'a soft wind machine gently lifting the hair, subtle fabric movement' },
  { key: 'boeig',     label: 'Böig', emoji: '💨',
    prompt: 'gusty wind sweeping hair and clothing sideways',
    studio: 'a strong wind machine sweeping the hair sideways, clothing caught mid-motion' },
  { key: 'stark',     label: 'Starker Wind', emoji: '🌪️',
    prompt: 'strong wind, hair and clothing whipped hard to one side',
    studio: 'a powerful wind machine, hair whipped hard to one side, fabric snapping in the air' },
]

export const LIGHT_SOURCES: { key: LightSourceKey; label: string; emoji: string; prompt: string }[] = [
  { key: 'fensterlicht',     label: 'Fensterlicht',     emoji: '🪟', prompt: 'soft natural window light' },
  { key: 'softbox',          label: 'Softbox',          emoji: '🔲', prompt: 'large soft key light from a softbox' },
  { key: 'beauty_dish',      label: 'Beauty Dish',      emoji: '🥧', prompt: 'crisp, focused beauty dish lighting' },
  { key: 'ring_light',       label: 'Ring Light',       emoji: '⭕', prompt: 'even, shadowless ring light illumination' },
  { key: 'spot_light',       label: 'Spot Light',       emoji: '🔦', prompt: 'focused spotlight with defined shadows' },
  { key: 'deckenbeleuchtung',label: 'Deckenbeleuchtung',emoji: '💡', prompt: 'even overhead ceiling lighting' },
  { key: 'neonlicht',        label: 'Neonlicht',        emoji: '🌆', prompt: 'colorful neon lighting' },
  { key: 'kerzenlicht',      label: 'Kerzenlicht',      emoji: '🕯️', prompt: 'warm flickering candlelight' },
  { key: 'kaminfeuer',       label: 'Kaminfeuer',       emoji: '🔥', prompt: 'warm flickering firelight from a fireplace' },
  { key: 'mischlicht',       label: 'Mischlicht',       emoji: '🔀', prompt: 'mixed indoor lighting with varied color temperatures' },
]

export const LIGHT_STYLES: { key: LightStyleKey; label: string; emoji: string; prompt: string }[] = [
  { key: 'soft_studio',       label: 'Soft Studio',       emoji: '🎨', prompt: 'soft studio lighting' },
  { key: 'high_key',          label: 'High Key',          emoji: '⬜', prompt: 'bright, high-key lighting with minimal shadows' },
  { key: 'low_key',           label: 'Low Key',           emoji: '⬛', prompt: 'dark, low-key lighting with deep shadows' },
  { key: 'cinematic',         label: 'Cinematic',         emoji: '🎬', prompt: 'cinematic lighting with dramatic contrast' },
  { key: 'dramatic',          label: 'Dramatic',          emoji: '🎭', prompt: 'dramatic, high-contrast lighting' },
  { key: 'fashion_editorial', label: 'Fashion Editorial', emoji: '✨', prompt: 'fashion editorial style lighting' },
  { key: 'commercial',        label: 'Commercial',        emoji: '📦', prompt: 'clean commercial-style lighting' },
  { key: 'moody',             label: 'Moody',             emoji: '🌑', prompt: 'moody, atmospheric lighting' },
  { key: 'natural_indoor',    label: 'Natural Indoor',    emoji: '🪴', prompt: 'natural indoor light' },
  { key: 'club_lighting',     label: 'Club Lighting',     emoji: '🪩', prompt: 'vibrant club lighting with colorful dynamic light beams' },
  { key: 'rembrandt',         label: 'Rembrandt',         emoji: '🖼️', prompt: 'classic Rembrandt lighting with a triangular highlight on the cheek' },
]

export const LIGHT_MODIFIERS: { key: LightModifierKey; label: string; emoji: string; prompt: string }[] = [
  { key: 'fill_light',   label: 'Fill Light',   emoji: '➕', prompt: 'gentle fill light' },
  { key: 'rim_light',    label: 'Rim Light',    emoji: '🔆', prompt: 'subtle rim light separating the subject from the background' },
  { key: 'hair_light',   label: 'Hair Light',   emoji: '💫', prompt: 'soft hair light highlighting the hair' },
  { key: 'bounce_light', label: 'Bounce Light', emoji: '↩️', prompt: 'soft bounce light filling in shadows' },
  { key: 'catchlights',  label: 'Catchlights',  emoji: '👁️', prompt: 'subtle catchlights in the eyes' },
]

// Studio backdrop colors — only relevant when no Location reference is selected. As soon
// as a Location is set, it takes over the background entirely and this choice is ignored.
export const STUDIO_BACKGROUNDS: { key: BackgroundKey; label: string; emoji: string; prompt: string }[] = [
  { key: 'white',         label: 'Weiß',         emoji: '⚪', prompt: 'plain white seamless studio backdrop background' },
  { key: 'black',         label: 'Schwarz',      emoji: '⚫', prompt: 'plain black seamless studio backdrop background' },
  { key: 'grey',          label: 'Grau',         emoji: '🩶', prompt: 'plain neutral grey seamless studio backdrop background' },
  { key: 'beige',         label: 'Beige',        emoji: '🟤', prompt: 'plain warm beige seamless studio backdrop background' },
  { key: 'pastel_pink',   label: 'Pastellrosa',  emoji: '🩷', prompt: 'plain soft pastel pink seamless studio backdrop background' },
  { key: 'pastel_blue',   label: 'Pastellblau',  emoji: '🩵', prompt: 'plain soft pastel blue seamless studio backdrop background' },
  { key: 'sage_green',    label: 'Salbeigrün',   emoji: '🟢', prompt: 'plain muted sage green seamless studio backdrop background' },
  { key: 'navy',          label: 'Marineblau',   emoji: '🔵', prompt: 'plain deep navy blue seamless studio backdrop background' },
  { key: 'terracotta',    label: 'Terrakotta',   emoji: '🟠', prompt: 'plain warm terracotta seamless studio backdrop background' },
  { key: 'gradient_grey', label: 'Verlauf Grau', emoji: '🌫️', prompt: 'smooth grey gradient seamless studio backdrop background' },
  { key: 'green_screen',  label: 'Greenscreen',  emoji: '🟩', prompt: 'flat chroma key green screen background' },
]

export const SHOT_TYPES: { key: ShotTypeKey; label: string; emoji: string; prompt: string }[] = [
  { key: 'extreme_closeup',       label: 'Extreme Close-Up',       emoji: '🔬', prompt: 'extreme close-up shot focusing on facial details' },
  { key: 'closeup',               label: 'Close-Up',               emoji: '🔭', prompt: 'close-up portrait framing' },
  { key: 'headshot',               label: 'Headshot',               emoji: '🙂', prompt: 'headshot framing focused on the face and shoulders' },
  { key: 'portrait',              label: 'Portrait',               emoji: '🧍', prompt: 'portrait framing from chest up' },
  { key: 'half_body',             label: 'Half Body',              emoji: '🚶', prompt: 'half-body shot showing upper body and posture' },
  { key: 'three_quarter',         label: 'Three Quarter Shot',     emoji: '🕴️', prompt: 'three-quarter shot showing most of the body' },
  { key: 'full_body',             label: 'Full Body',              emoji: '🧎', prompt: 'full body shot showing the subject from head to feet' },
  { key: 'wide_shot',             label: 'Wide Shot',              emoji: '🌄', prompt: 'wide shot with strong environmental context' },
  { key: 'environmental_portrait',label: 'Environmental Portrait', emoji: '🏞️', prompt: 'environmental portrait showing both subject and surroundings' },
  { key: 'establishing_shot',     label: 'Establishing Shot',      emoji: '🎬', prompt: 'establishing shot setting the overall scene' },
]

export const CAMERA_ANGLES: { key: CameraAngleKey; label: string; emoji: string; prompt: string }[] = [
  { key: 'eye_level',   label: 'Eye Level',         emoji: '👁️', prompt: 'eye-level camera angle with natural perspective' },
  { key: 'slight_low',  label: 'Slight Low Angle',  emoji: '↗️', prompt: 'slightly low camera angle' },
  { key: 'low_angle',   label: 'Low Angle',         emoji: '⬆️', prompt: 'low-angle camera view creating a powerful appearance' },
  { key: 'slight_high', label: 'Slight High Angle', emoji: '↘️', prompt: 'slightly high camera angle' },
  { key: 'high_angle',  label: 'High Angle',        emoji: '⬇️', prompt: 'high-angle view creating visual separation from surroundings' },
  { key: 'birds_eye',   label: "Bird's Eye View",   emoji: '🦅', prompt: "bird's-eye perspective looking directly downward" },
  { key: 'worms_eye',   label: "Worm's Eye View",   emoji: '🐛', prompt: 'extreme low-angle perspective looking upward' },
  { key: 'overhead',    label: 'Overhead View',     emoji: '🔝', prompt: 'overhead view looking straight down' },
]

export const LENSES: { key: LensKey; label: string; emoji: string; prompt: string }[] = [
  { key: '24mm',  label: '24mm',  emoji: '📐', prompt: 'wide-angle 24mm lens with strong environmental presence' },
  { key: '35mm',  label: '35mm',  emoji: '📐', prompt: 'natural wide-angle 35mm lens' },
  { key: '50mm',  label: '50mm',  emoji: '📷', prompt: 'standard 50mm lens with realistic perspective' },
  { key: '85mm',  label: '85mm',  emoji: '📷', prompt: 'professional 85mm portrait lens' },
  { key: '135mm', label: '135mm', emoji: '🔭', prompt: '135mm telephoto lens with strong background compression' },
  { key: '200mm', label: '200mm', emoji: '🔭', prompt: '200mm long telephoto lens with cinematic compression' },
]

export const DEPTH_OF_FIELDS: { key: DepthOfFieldKey; label: string; emoji: string; prompt: string }[] = [
  { key: 'deep_focus',        label: 'Deep Focus',                  emoji: '🟢', prompt: 'deep focus with everything sharp from foreground to background' },
  { key: 'moderate_dof',      label: 'Moderate Depth of Field',     emoji: '🟡', prompt: 'moderate depth of field with balanced subject separation' },
  { key: 'shallow_dof',       label: 'Shallow Depth of Field',      emoji: '🟠', prompt: 'shallow depth of field with soft background blur' },
  { key: 'ultra_shallow_dof', label: 'Ultra Shallow Depth of Field',emoji: '🔴', prompt: 'ultra shallow depth of field with strong bokeh and extreme background separation' },
]

export const ASPECT_RATIOS: { key: AspectRatioKey; label: string; emoji: string; prompt: string }[] = [
  { key: 'portrait_4_5',    label: 'Portrait (4:5)',    emoji: '📱', prompt: 'vertical portrait composition (4:5)' },
  { key: 'landscape_16_9',  label: 'Landscape (16:9)',  emoji: '🖥️', prompt: 'wide landscape composition (16:9)' },
  { key: 'square_1_1',      label: 'Square (1:1)',      emoji: '⬛', prompt: 'balanced square framing (1:1)' },
  { key: 'cinematic_21_9',  label: 'Cinematic (21:9)',  emoji: '🎬', prompt: 'cinematic ultra-wide composition (21:9)' },
  { key: 'story_9_16',      label: 'Story Format (9:16)', emoji: '📲', prompt: 'vertical smartphone-style composition (9:16)' },
  // Am 02.09.2026 auf Marks Wunsch dazu. Gemini kennt 4:3 und 3:4 nativ —
  // gpt-image-2 nicht, dort wird daraus die nächstliegende der drei Größen.
  { key: 'classic_4_3',     label: 'Klassisch (4:3)',    emoji: '🖼️', prompt: 'classic 4:3 composition' },
  { key: 'classic_3_4',     label: 'Klassisch hoch (3:4)', emoji: '🖼', prompt: 'classic vertical 3:4 composition' },
]

// ── Beschriftungen ableiten, niemals abtippen ────────────────────────────────

/**
 * Die Beschriftung eines Options-Schlüssels — aus DERSELBEN Liste, aus der auch
 * die Chips gezeichnet werden.
 *
 * WARUM ALS FUNKTION UND NICHT ALS ZWEITE LISTE: Für die Kamera-Kategorien gab
 * es das schon einmal handgetippt, und dort hieß derselbe Eintrag an der einen
 * Stelle „nah" und an der anderen „Nahaufnahme". Seit PROJ-55 zeigen die
 * zugeklappten Gruppen im Scene Builder ihren aktuellen Wert im Kopf an
 * („Kamerawinkel — Eye Level"). Eine zweite Liste dafür liefe genauso
 * auseinander, nur unsichtbarer: Sie stünde nur auf dem zugeklappten Kopf,
 * also genau dort, wo man den Chip daneben nicht zum Vergleich sieht.
 */
export function optionLabel<T extends string>(
  options: readonly { key: T; label: string }[],
  key: T | null | undefined,
): string | null {
  if (!key) return null
  return options.find(o => o.key === key)?.label ?? null
}

/** Dasselbe für Mehrfachauswahl (Lichtmodifier) — leere Auswahl gibt `null`. */
export function optionLabels<T extends string>(
  options: readonly { key: T; label: string }[],
  keys: readonly T[] | null | undefined,
): string | null {
  if (!keys || keys.length === 0) return null
  const texte = keys.map(k => optionLabel(options, k)).filter(Boolean) as string[]
  return texte.length > 0 ? texte.join(', ') : null
}

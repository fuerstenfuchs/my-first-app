import { describe, it, expect } from 'vitest'
import {
  TITELBILD_PRESET_NAME, TITELBILD_VARIANTE, titelbildSzene, referenzsheetBild,
  type Nachschlagelisten,
} from './titelbild-preset'
import { buildPrompt } from './szene-prompt'
import { EMPTY_PRESET_CONFIG, type ScenePresetConfig } from './scene-preset-types'
import { STANDARD_VARIANTEN } from './charakter-varianten'
import { VARIANTEN_NAME } from './referenzkette'

/* eslint-disable @typescript-eslint/no-explicit-any */

const ZIEL_CHARAKTER: any = {
  id: 'ziel-1', user_id: 'u1', name: 'Nora',
  description: null, tags: [], cover_image_url: 'https://speicher.test/altes-titelbild.png',
  source_url: null, source_title: null, metadata: {},
  created_at: '', updated_at: '',
}

const SHEET_URL = 'https://speicher.test/storage/v1/object/public/character-images/ziel-1/referenzsheet.png'

const LISTEN: Nachschlagelisten = {
  poseActions: [{ id: 'p1', name: 'Stehend', description: 'Standing upright.' } as any],
  expressions: [{ id: 'e-eigen', name: 'Neutral', description: 'Calm, neutral expression.' } as any],
  cameras:     [{ id: 'k1', name: 'Dolly', description: 'Slow dolly-in.' } as any],
  styles:      [{ id: 'b7039a30', name: 'Studio', prompt: 'Clean studio portrait look' } as any],
  gradings:    [{ id: 'standard:bleach_bypass', name: 'Bleach Bypass', prompt: 'Bleach bypass grading.' } as any],
}

/**
 * Marks echtes Preset, so wie es am 03.09.2026 in `scene_presets` stand — samt
 * dem FREMDEN Charakter, mit dem er es damals gebaut hat. Genau der ist der
 * interessante Teil dieser Tests.
 */
const CALVANIZE_STUDIO: ScenePresetConfig = {
  ...EMPTY_PRESET_CONFIG,
  scene_type: 'indoor',
  lens: '85mm',
  shot_type: 'closeup',
  background: 'gradient_grey',
  light_source: 'ring_light',
  light_style: 'cinematic',
  light_modifiers: ['hair_light', 'catchlights'],
  camera_angle: 'eye_level',
  depth_of_field: 'shallow_dof',
  aspect_ratio: 'portrait_4_5',
  style_id: 'b7039a30',
  grading_id: 'standard:bleach_bypass',
  expression_id: 'e-eigen',
  character_id: 'FREMDER-CHARAKTER',
  refs: {
    ...EMPTY_PRESET_CONFIG.refs,
    character: { url: 'https://speicher.test/fremdes-gesicht.png', label: 'Gesichtsdetails' },
  },
}

describe('Namen', () => {
  it('der Preset-Name ist Marks vollständiger Name, nicht nur „Calvanize"', () => {
    expect(TITELBILD_PRESET_NAME).toBe('Calvanize Studio')
  })

  /**
   * Die Zielvariante muss eines der sieben Standardfächer sein, sonst legte der
   * Knopf bei jedem neuen Charakter ein ACHTES daneben — das vorbereitete Fach
   * bliebe für immer leer.
   */
  it('die Zielvariante ist eines der Standardfächer aus PROJ-50', () => {
    expect(STANDARD_VARIANTEN).toContain(TITELBILD_VARIANTE)
  })

  it('die Zielvariante ist NICHT das Referenzsheet-Fach', () => {
    expect(TITELBILD_VARIANTE).not.toBe(VARIANTEN_NAME.referenzsheet)
  })
})

describe('referenzsheetBild', () => {
  it('findet die Variante unabhängig von Groß-/Kleinschreibung und Leerzeichen', () => {
    expect(referenzsheetBild([
      { name: '  referenzSHEET ', images: [{ url: 'a.png', sort_order: 0 }] },
    ])).toBe('a.png')
  })

  it('nimmt das jüngste Bild, nicht das erste', () => {
    expect(referenzsheetBild([
      {
        name: 'Referenzsheet',
        images: [
          { url: 'alt.png', sort_order: 0 },
          { url: 'neu.png', sort_order: 2 },
          { url: 'mittel.png', sort_order: 1 },
        ],
      },
    ])).toBe('neu.png')
  })

  it('lässt die Eingabeliste unverändert', () => {
    const bilder = [{ url: 'a.png', sort_order: 1 }, { url: 'b.png', sort_order: 0 }]
    referenzsheetBild([{ name: 'Referenzsheet', images: bilder }])
    expect(bilder.map(b => b.url)).toEqual(['a.png', 'b.png'])
  })

  it('gibt null zurück, wenn die Variante fehlt', () => {
    expect(referenzsheetBild([{ name: 'Kopf', images: [{ url: 'k.png', sort_order: 0 }] }])).toBeNull()
  })

  it('gibt null zurück, wenn die Variante leer ist', () => {
    expect(referenzsheetBild([{ name: 'Referenzsheet', images: [] }])).toBeNull()
    expect(referenzsheetBild([{ name: 'Referenzsheet', images: null }])).toBeNull()
  })

  it('verwechselt „Kopf" nicht mit dem Referenzsheet', () => {
    expect(referenzsheetBild([
      { name: 'Kopf', images: [{ url: 'kopf.png', sort_order: 9 }] },
      { name: 'Körper', images: [{ url: 'koerper.png', sort_order: 9 }] },
      { name: 'Referenzsheet', images: [{ url: 'sheet.png', sort_order: 0 }] },
    ])).toBe('sheet.png')
  })
})

describe('titelbildSzene — der Zielcharakter setzt sich immer durch', () => {
  const { scene, sceneRefs } = titelbildSzene(CALVANIZE_STUDIO, LISTEN, {
    character: ZIEL_CHARAKTER, referenzsheetUrl: SHEET_URL,
  })

  it('nimmt den Zielcharakter, nicht den aus dem Preset', () => {
    expect(scene.character?.id).toBe('ziel-1')
    expect(scene.character?.id).not.toBe('FREMDER-CHARAKTER')
  })

  it('nimmt das Referenzsheet als Charakterreferenz, nicht das Bild aus dem Preset', () => {
    expect(sceneRefs.character?.url).toBe(SHEET_URL)
    expect(sceneRefs.character?.label).toBe(VARIANTEN_NAME.referenzsheet)
  })

  it('das fremde Gesicht taucht nirgends mehr auf — auch nicht im fertigen Prompt', () => {
    const prompt = buildPrompt(scene, sceneRefs)
    expect(JSON.stringify({ scene, sceneRefs })).not.toContain('fremdes-gesicht')
    expect(JSON.stringify({ scene, sceneRefs })).not.toContain('FREMDER-CHARAKTER')
    expect(prompt).toContain('Use the provided character reference.')
  })

  it('räumt Archetypen, Outfit und Location samt Referenzen leer', () => {
    expect(scene.character_archetype).toBeNull()
    expect(scene.outfit).toBeNull()
    expect(scene.outfit_archetype).toBeNull()
    expect(scene.location).toBeNull()
    expect(scene.location_archetype).toBeNull()
    expect(sceneRefs.character_archetype).toBeNull()
    expect(sceneRefs.outfit).toBeNull()
    expect(sceneRefs.outfit_archetype).toBeNull()
    expect(sceneRefs.location).toBeNull()
    expect(sceneRefs.location_archetype).toBeNull()
  })

  /**
   * Der Gegenbeweis zur Zeile darüber: Selbst ein Preset, in dem Outfit und
   * Location AUSGEFÜLLT sind, darf nichts davon durchlassen. Sonst wäre die
   * Prüfung oben nur ein Abbild dessen, dass Marks Preset dort zufällig leer
   * ist.
   */
  it('lässt auch dann nichts durch, wenn das Preset Outfit und Location gesetzt hat', () => {
    const verseucht: ScenePresetConfig = {
      ...CALVANIZE_STUDIO,
      character_archetype_id: 'ca-fremd',
      outfit_id: 'o-fremd',
      outfit_archetype_id: 'oa-fremd',
      location_id: 'l-fremd',
      location_archetype_id: 'la-fremd',
      refs: {
        character: { url: 'https://speicher.test/fremdes-gesicht.png', label: 'Gesicht' },
        character_archetype: { url: 'https://speicher.test/x1.png', label: 'x1' },
        outfit: { url: 'https://speicher.test/x2.png', label: 'x2' },
        outfit_archetype: { url: 'https://speicher.test/x3.png', label: 'x3' },
        location: { url: 'https://speicher.test/x4.png', label: 'x4' },
        location_archetype: { url: 'https://speicher.test/x5.png', label: 'x5' },
      },
    }
    const ergebnis = titelbildSzene(verseucht, LISTEN, {
      character: ZIEL_CHARAKTER, referenzsheetUrl: SHEET_URL,
    })
    const alsText = JSON.stringify(ergebnis)
    for (const rest of ['x1.png', 'x2.png', 'x3.png', 'x4.png', 'x5.png', 'fremdes-gesicht', '-fremd']) {
      expect(alsText).not.toContain(rest)
    }
    expect(ergebnis.sceneRefs.character?.url).toBe(SHEET_URL)
  })
})

describe('titelbildSzene — alles andere kommt unverändert aus dem Preset', () => {
  const { scene } = titelbildSzene(CALVANIZE_STUDIO, LISTEN, {
    character: ZIEL_CHARAKTER, referenzsheetUrl: SHEET_URL,
  })

  it('übernimmt Licht, Kamera, Hintergrund und Format', () => {
    expect(scene.scene_type).toBe('indoor')
    expect(scene.light_source).toBe('ring_light')
    expect(scene.light_style).toBe('cinematic')
    expect(scene.light_modifiers).toEqual(['hair_light', 'catchlights'])
    expect(scene.shot_type).toBe('closeup')
    expect(scene.camera_angle).toBe('eye_level')
    expect(scene.lens).toBe('85mm')
    expect(scene.depth_of_field).toBe('shallow_dof')
    expect(scene.aspect_ratio).toBe('portrait_4_5')
    expect(scene.background).toBe('gradient_grey')
  })

  it('löst Mimik, Stil und Grading gegen die Listen auf', () => {
    expect(scene.expression?.name).toBe('Neutral')
    expect(scene.style?.name).toBe('Studio')
    expect(scene.grading?.name).toBe('Bleach Bypass')
  })

  /**
   * Ein Stil, den Mark inzwischen gelöscht hat, darf den Knopf nicht zum
   * Absturz bringen. `find` gibt dann `undefined` — daraus wird hier `null`,
   * und `buildPrompt` lässt den Abschnitt einfach weg.
   */
  it('ein Eintrag, den es nicht mehr gibt, wird zu null statt zu einem Fehler', () => {
    const { scene: s } = titelbildSzene(
      { ...CALVANIZE_STUDIO, style_id: 'gibt-es-nicht-mehr' },
      LISTEN,
      { character: ZIEL_CHARAKTER, referenzsheetUrl: SHEET_URL },
    )
    expect(s.style).toBeNull()
    expect(() => buildPrompt(s, titelbildSzene(CALVANIZE_STUDIO, LISTEN, {
      character: ZIEL_CHARAKTER, referenzsheetUrl: SHEET_URL,
    }).sceneRefs)).not.toThrow()
  })

  it('ein Preset ohne Pose ergibt keine Pose — es wird nichts erfunden', () => {
    expect(scene.pose).toBeNull()
    expect(scene.camera).toBeNull()
  })

  it('eine gesetzte Pose wird dagegen übernommen', () => {
    const { scene: s } = titelbildSzene(
      { ...CALVANIZE_STUDIO, pose_id: 'p1', camera_id: 'k1' },
      LISTEN,
      { character: ZIEL_CHARAKTER, referenzsheetUrl: SHEET_URL },
    )
    expect(s.pose?.name).toBe('Stehend')
    expect(s.camera?.name).toBe('Dolly')
  })
})

describe('titelbildSzene — der Prompt, der tatsächlich abgeschickt wird', () => {
  it('enthält Marks Studio-Look und die Charakterreferenz', () => {
    const { scene, sceneRefs } = titelbildSzene(CALVANIZE_STUDIO, LISTEN, {
      character: ZIEL_CHARAKTER, referenzsheetUrl: SHEET_URL,
    })
    const prompt = buildPrompt(scene, sceneRefs)
    expect(prompt.startsWith('Indoor scene.')).toBe(true)
    expect(prompt).toContain('ring light')
    expect(prompt).toContain('85mm')
    expect(prompt).toContain('Use the provided character reference.')
    expect(prompt).toContain('seamless studio backdrop')
    expect(prompt).toContain('Bleach bypass grading.')
    expect(prompt.endsWith('Photorealistic.')).toBe(true)
  })
})

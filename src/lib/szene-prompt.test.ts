import { describe, it, expect } from 'vitest'
import {
  capitalize, buildEnvironmentSentence, buildCameraSentence,
  buildCharacterSection, buildOutfitSection, buildLocationSection, buildPrompt,
  type Scene, type SceneRefs,
} from './szene-prompt'

/**
 * Die Prompt-Erzeugung des Scene Builders (PROJ-51).
 *
 * Diese Logik hatte bis zur Verschiebung aus `scene-builder/page.tsx` KEINE
 * Tests — sie steckte in einer Seitenkomponente und war nur über die Oberfläche
 * erreichbar. Sie steuert aber, was tatsächlich an gpt-image-2 geht, und ein
 * Fehler darin fällt nicht als Fehler auf, sondern als leicht anderes Bild.
 *
 * Ganz unten steht die GEGENPROBE zur Verschiebung: acht Beispielszenen mit
 * ihren Prompts, wörtlich aufgezeichnet aus der Fassung VOR der Verschiebung.
 */

// ── Bausteine für die Beispiele ───────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

const LEER: any = {
  scene_type: 'outdoor', time_of_day: null, season: null, weather: null,
  light_source: null, light_style: null, light_modifiers: [],
  shot_type: null, camera_angle: null, lens: null, depth_of_field: null, aspect_ratio: null,
  character: null, character_archetype: null, outfit: null, outfit_archetype: null,
  location: null, location_archetype: null, pose: null, expression: null, camera: null,
  style: null, grading: null, background: null,
}

const KEINE_REFS: any = {
  character: null, character_archetype: null, outfit: null, outfit_archetype: null,
  location: null, location_archetype: null,
}

const REF = (label: string): any => ({ url: `https://example.test/${label}.png`, label })

/** Eine Szene aus dem leeren Grundzustand plus den gesetzten Feldern. */
const szene = (felder: Record<string, unknown> = {}): Scene => ({ ...LEER, ...felder })
const refs  = (felder: Record<string, unknown> = {}): SceneRefs => ({ ...KEINE_REFS, ...felder })

// ── capitalize ────────────────────────────────────────────────────────────────

describe('capitalize', () => {
  it('macht den ersten Buchstaben groß und lässt den Rest in Ruhe', () => {
    expect(capitalize('warm golden-hour sunlight')).toBe('Warm golden-hour sunlight')
  })

  it('kommt mit dem leeren Text zurecht', () => {
    expect(capitalize('')).toBe('')
  })
})

// ── Umgebungssatz ─────────────────────────────────────────────────────────────

describe('buildEnvironmentSentence', () => {
  it('gibt null zurück, wenn draußen nichts gewählt ist', () => {
    expect(buildEnvironmentSentence(szene({ scene_type: 'outdoor' }))).toBeNull()
  })

  it('gibt null zurück, wenn drinnen nichts gewählt ist', () => {
    expect(buildEnvironmentSentence(szene({ scene_type: 'indoor' }))).toBeNull()
  })

  it('draußen: Tageszeit, Jahreszeit, Wetter plus die drei festen Außen-Zusätze', () => {
    const satz = buildEnvironmentSentence(szene({
      scene_type: 'outdoor', time_of_day: 'golden_hour', season: 'herbst', weather: 'nebel',
    }))!
    expect(satz.startsWith('Warm golden-hour sunlight')).toBe(true)
    expect(satz).toContain('crisp autumn atmosphere')
    expect(satz).toContain('foggy atmosphere')
    expect(satz.endsWith('natural outdoor lighting, atmospheric depth, realistic environmental illumination.')).toBe(true)
  })

  it('draußen bleiben Lichtquelle und Lichtstil unbeachtet', () => {
    expect(buildEnvironmentSentence(szene({
      scene_type: 'outdoor', light_source: 'ring_light', light_style: 'cinematic',
    }))).toBeNull()
  })

  it('drinnen: erst Stil, dann Quelle, dann die Modifier — in dieser Reihenfolge', () => {
    const satz = buildEnvironmentSentence(szene({
      scene_type: 'indoor', light_style: 'cinematic', light_source: 'ring_light',
      light_modifiers: ['hair_light', 'catchlights'],
    }))!
    const iStil  = satz.indexOf('Cinematic lighting')
    const iQuell = satz.indexOf('ring light')
    const iHaar  = satz.indexOf('hair light')
    const iAugen = satz.indexOf('catchlights')
    expect(iStil).toBeGreaterThanOrEqual(0)
    expect(iStil).toBeLessThan(iQuell)
    expect(iQuell).toBeLessThan(iHaar)
    expect(iHaar).toBeLessThan(iAugen)
    expect(satz.endsWith('clean indoor lighting setup, natural skin tones.')).toBe(true)
  })

  it('drinnen bleiben Jahreszeit und Wetter unbeachtet', () => {
    expect(buildEnvironmentSentence(szene({
      scene_type: 'indoor', season: 'winter', weather: 'gewitter',
    }))).toBeNull()
  })
})

// ── Kamerasatz ────────────────────────────────────────────────────────────────

describe('buildCameraSentence', () => {
  it('gibt null zurück, wenn keine Kameraeinstellung gewählt ist', () => {
    expect(buildCameraSentence(szene())).toBeNull()
  })

  it('setzt die Einzelteile zu einem Satz zusammen und schließt ihn mit Punkt', () => {
    const satz = buildCameraSentence(szene({
      shot_type: 'closeup', camera_angle: 'eye_level', lens: '85mm',
      depth_of_field: 'shallow_dof', aspect_ratio: 'portrait_4_5',
    }))!
    expect(satz.startsWith('Close-up portrait framing')).toBe(true)
    expect(satz.endsWith('.')).toBe(true)
    expect(satz).toContain('85mm')
  })

  /**
   * Die zwei Sonderfälle sind der Grund, warum diese Funktion überhaupt
   * existiert: Ohne sie stünden hier aneinandergereihte Stichworte statt eines
   * Satzes. Sie verdrängen ALLES andere — auch eine gewählte Blende oder ein
   * gewähltes Format tauchen dann nicht auf.
   */
  it('Nahaufnahme + 135mm nimmt den fertigen Satz und verwirft die übrigen Angaben', () => {
    const satz = buildCameraSentence(szene({
      shot_type: 'closeup', lens: '135mm', camera_angle: 'birds_eye', aspect_ratio: 'square_1_1',
    }))
    expect(satz).toBe('Professional close-up portrait, 135mm telephoto lens, strong background compression, flattering facial proportions, shallow depth of field.')
  })

  it('Ganzkörper + 24mm nimmt den fertigen Satz', () => {
    const satz = buildCameraSentence(szene({ shot_type: 'full_body', lens: '24mm' }))
    expect(satz).toBe('Full body environmental shot, 24mm wide-angle lens, strong sense of place, natural environmental context.')
  })

  it('dieselbe Brennweite mit anderer Einstellungsgröße greift den Sonderfall NICHT ab', () => {
    const satz = buildCameraSentence(szene({ shot_type: 'portrait', lens: '135mm' }))!
    expect(satz.startsWith('Professional close-up portrait')).toBe(false)
  })
})

// ── Charakter-Abschnitt ───────────────────────────────────────────────────────

describe('buildCharacterSection', () => {
  const archetyp: any = { id: 'ca1', name: 'Detektivin', prompt: '  A weathered detective.  ' }
  const person: any   = { id: 'c1', name: 'Nora' }

  it('ohne Charakter und ohne Archetyp bleibt der Abschnitt leer', () => {
    expect(buildCharacterSection(szene(), refs())).toEqual([])
  })

  it('echter Charakter: nur der Verweis auf die Referenz', () => {
    expect(buildCharacterSection(szene({ character: person }), refs()))
      .toEqual(['Use the provided character reference.'])
  })

  it('echter Charakter plus Archetyp: die Referenz gilt, der Archetyp steuert nur Text bei', () => {
    expect(buildCharacterSection(szene({ character: person, character_archetype: archetyp }), refs()))
      .toEqual([
        'Use the provided character reference.',
        'Depict the character as a detektivin.',
        'Follow this character description:\n\nA weathered detective.',
      ])
  })

  it('nur Archetyp MIT eigenem Bild: Referenz plus „zusätzlich"', () => {
    expect(buildCharacterSection(
      szene({ character_archetype: archetyp }),
      refs({ character_archetype: REF('Archetyp') }),
    )).toEqual([
      'Use the provided character reference.',
      'Additionally follow this character description:\n\nA weathered detective.',
    ])
  })

  it('nur Archetyp OHNE Bild: allein die Beschreibung', () => {
    expect(buildCharacterSection(szene({ character_archetype: archetyp }), refs()))
      .toEqual(['Use the following character description:\n\nA weathered detective.'])
  })

  it('Archetyp ohne Text und ohne Bild ergibt gar nichts', () => {
    expect(buildCharacterSection(
      szene({ character_archetype: { id: 'x', name: 'Leer', prompt: '   ' } as any }), refs(),
    )).toEqual([])
  })
})

// ── Outfit-Abschnitt ──────────────────────────────────────────────────────────

describe('buildOutfitSection', () => {
  const archetyp: any = { id: 'oa1', name: 'Regenmantel', prompt: 'A long belted raincoat.' }
  const outfit: any   = { id: 'o1', name: 'Trenchcoat' }

  it('echtes Outfit plus Archetyp: Referenz plus Anziehsatz plus Beschreibung', () => {
    expect(buildOutfitSection(szene({ outfit, outfit_archetype: archetyp }), refs()))
      .toEqual([
        'Use the provided outfit reference.',
        'Dress the character in a regenmantel.',
        'Follow this outfit description:\n\nA long belted raincoat.',
      ])
  })

  it('nur Archetyp MIT Bild', () => {
    expect(buildOutfitSection(
      szene({ outfit_archetype: archetyp }), refs({ outfit_archetype: REF('Archetyp') }),
    )).toEqual([
      'Use the provided outfit reference.',
      'Additionally follow this outfit description:\n\nA long belted raincoat.',
    ])
  })

  it('nur Archetyp OHNE Bild', () => {
    expect(buildOutfitSection(szene({ outfit_archetype: archetyp }), refs()))
      .toEqual(['Use the following outfit description:\n\nA long belted raincoat.'])
  })
})

// ── Location-Abschnitt und der Hintergrund ────────────────────────────────────

describe('buildLocationSection', () => {
  const archetyp: any = { id: 'la1', name: 'Lagerhalle', prompt: 'A cavernous warehouse.' }
  const ort: any      = { id: 'l1', name: 'Hafen' }

  it('echte Location plus Archetyp: der Archetyp wird IN die Location gestellt', () => {
    expect(buildLocationSection(szene({ location: ort, location_archetype: archetyp }), refs()))
      .toEqual([
        'Use the provided location reference.',
        'Create a lagerhalle within the Hafen environment.',
        'Follow this location description:\n\nA cavernous warehouse.',
      ])
  })

  it('nur Archetyp MIT Bild', () => {
    expect(buildLocationSection(
      szene({ location_archetype: archetyp }), refs({ location_archetype: REF('Archetyp') }),
    )).toEqual([
      'Use the provided location reference.',
      'Additionally follow this location description:\n\nA cavernous warehouse.',
    ])
  })

  it('nur Archetyp OHNE Bild', () => {
    expect(buildLocationSection(szene({ location_archetype: archetyp }), refs()))
      .toEqual(['Use the following location description:\n\nA cavernous warehouse.'])
  })

  /**
   * Der Studio-Hintergrund ist der Rückfall, nicht eine weitere Angabe: Er
   * greift NUR, wenn weder eine echte Location noch ein Archetyp gesetzt ist.
   * Genau das steht in der Oberfläche auch als Hinweis („wird ignoriert,
   * sobald unten eine Location gewählt wird") — hier ist es nachgemessen.
   */
  it('Hintergrund allein wird zum Satz', () => {
    expect(buildLocationSection(szene({ background: 'gradient_grey' }), refs()))
      .toEqual(['Smooth grey gradient seamless studio backdrop background.'])
  })

  it('Hintergrund wird von einer echten Location verdrängt', () => {
    const teile = buildLocationSection(szene({ background: 'white', location: ort }), refs())
    expect(teile).toEqual(['Use the provided location reference.'])
    expect(teile.join(' ')).not.toContain('background')
  })

  it('Hintergrund wird von einem Location-Archetyp verdrängt', () => {
    const teile = buildLocationSection(szene({ background: 'white', location_archetype: archetyp }), refs())
    expect(teile.join(' ')).not.toContain('seamless studio backdrop')
  })

  it('ohne alles bleibt der Abschnitt leer', () => {
    expect(buildLocationSection(szene(), refs())).toEqual([])
  })
})

// ── Der ganze Prompt ──────────────────────────────────────────────────────────

describe('buildPrompt', () => {
  it('nennt Innen und Außen ausdrücklich', () => {
    expect(buildPrompt(szene({ scene_type: 'indoor' }), refs()).startsWith('Indoor scene.')).toBe(true)
    expect(buildPrompt(szene({ scene_type: 'outdoor' }), refs()).startsWith('Outdoor scene.')).toBe(true)
  })

  it('schließt immer mit „Photorealistic."', () => {
    expect(buildPrompt(szene(), refs()).endsWith('Photorealistic.')).toBe(true)
  })

  it('trennt die Abschnitte durch eine Leerzeile', () => {
    expect(buildPrompt(szene(), refs())).toBe('Outdoor scene.\n\nPhotorealistic.')
  })

  it('nimmt bei Pose, Mimik und Kamera-Asset die Beschreibung, sonst den Namen', () => {
    const p = buildPrompt(szene({
      pose:       { id: 'p', name: 'Kontrapost', description: 'Weight on one leg.' } as any,
      expression: { id: 'e', name: 'Lächeln', description: '   ' } as any,
      camera:     { id: 'k', name: 'Dolly', description: null } as any,
    }), refs())
    expect(p).toContain('Weight on one leg.')
    expect(p).toContain('Lächeln facial expression.')
    expect(p).toContain('Dolly.')
  })

  /**
   * Stil und Grading kommen aus frei bearbeitbaren Feldern. Ein fehlender
   * Schlusspunkt würde den nächsten Abschnitt anhängen statt abtrennen —
   * deshalb wird einer ergänzt, aber nur, wenn keiner da ist.
   */
  it('ergänzt bei Stil und Grading einen Punkt, wenn keiner da ist', () => {
    const p = buildPrompt(szene({
      style:   { id: 's', name: 'S', prompt: 'Gritty neo-noir look' } as any,
      grading: { id: 'g', name: 'G', prompt: 'Cool teal shadows' } as any,
    }), refs())
    expect(p).toContain('Gritty neo-noir look.')
    expect(p).toContain('Cool teal shadows.')
  })

  it('lässt einen vorhandenen Schlusspunkt in Ruhe — auch ! und ?', () => {
    const p = buildPrompt(szene({
      style:   { id: 's', name: 'S', prompt: 'Already ends properly.' } as any,
      grading: { id: 'g', name: 'G', prompt: 'Teal and orange grading!' } as any,
    }), refs())
    expect(p).toContain('Already ends properly.')
    expect(p).not.toContain('Already ends properly..')
    expect(p).toContain('Teal and orange grading!')
    expect(p).not.toContain('Teal and orange grading!.')
  })

  it('hält die Reihenfolge Umgebung → Kamera → Charakter → Outfit → Location ein', () => {
    const p = buildPrompt(szene({
      scene_type: 'indoor', light_style: 'cinematic',
      shot_type: 'closeup', lens: '85mm',
      character: { id: 'c', name: 'Nora' } as any,
      outfit:    { id: 'o', name: 'Trench' } as any,
      location:  { id: 'l', name: 'Hafen' } as any,
    }), refs())
    const i = [
      p.indexOf('Cinematic lighting'),
      p.indexOf('Close-up portrait framing'),
      p.indexOf('character reference'),
      p.indexOf('outfit reference'),
      p.indexOf('location reference'),
    ]
    expect(i.every(x => x >= 0)).toBe(true)
    expect([...i].sort((a, b) => a - b)).toEqual(i)
  })
})

// ── GEGENPROBE zur Verschiebung (PROJ-51) ─────────────────────────────────────

/**
 * Acht Beispielszenen und ihre Prompts — WÖRTLICH aufgezeichnet aus der
 * Fassung, in der `buildPrompt` noch in `scene-builder/page.tsx` stand, bevor
 * eine Zeile bewegt wurde.
 *
 * WARUM DIESE TABELLE HIER STEHT UND NICHT ERZEUGT WIRD: Ein Test, der die
 * Erwartung aus derselben Funktion holt, die er prüft, ist immer grün. Diese
 * Zeichenketten stammen aus der ALTEN Fassung — nur deshalb beweisen sie, dass
 * die Verschiebung nichts verändert hat. Ändert sich der Prompt später
 * absichtlich, wird dieser Test rot; das ist gewollt: Dann muss jemand
 * bestätigen, dass die Änderung Absicht war.
 */
const GRUNDLINIE: { name: string; scene: Scene; sceneRefs: SceneRefs; erwartet: string }[] = [
  {
    name: 'leer_outdoor',
    scene: szene(),
    sceneRefs: refs(),
    erwartet: 'Outdoor scene.\n\nPhotorealistic.',
  },
  {
    name: 'calvanize_studio',
    scene: szene({
      scene_type: 'indoor',
      light_source: 'ring_light',
      light_style: 'cinematic',
      light_modifiers: ['hair_light', 'catchlights'],
      shot_type: 'closeup',
      camera_angle: 'eye_level',
      lens: '85mm',
      depth_of_field: 'shallow_dof',
      aspect_ratio: 'portrait_4_5',
      background: 'gradient_grey',
      character: { id: 'c1', name: 'Nora', cover_image_url: null },
      expression: { id: 'e1', name: 'Neutral', description: 'Calm, neutral expression.' },
      style: { id: 'standard:s1', name: 'Stil', prompt: 'Cinematic film still' },
      grading: { id: 'standard:bleach_bypass', name: 'Bleach Bypass', prompt: 'Bleach bypass grading.' },
    }),
    sceneRefs: refs({ character: REF('Referenzsheet') }),
    erwartet: 'Indoor scene.\n\nCinematic lighting with dramatic contrast, even, shadowless ring light illumination, soft hair light highlighting the hair, subtle catchlights in the eyes, clean indoor lighting setup, natural skin tones.\n\nClose-up portrait framing, eye-level camera angle with natural perspective, professional 85mm portrait lens, shallow depth of field with soft background blur, vertical portrait composition (4:5).\n\nUse the provided character reference.\n\nSmooth grey gradient seamless studio backdrop background.\n\nCalm, neutral expression.\n\nCinematic film still.\n\nBleach bypass grading.\n\nPhotorealistic.',
  },
  {
    name: 'outdoor_voll_mit_archetypen',
    scene: szene({
      scene_type: 'outdoor',
      time_of_day: 'golden_hour',
      season: 'herbst',
      weather: 'nebel',
      shot_type: 'full_body',
      camera_angle: 'low_angle',
      lens: '24mm',
      depth_of_field: 'deep_focus',
      aspect_ratio: 'landscape_16_9',
      character: { id: 'c1', name: 'Nora', cover_image_url: null },
      character_archetype: { id: 'ca1', name: 'Detektivin', prompt: '  A weathered detective.  ' },
      outfit: { id: 'o1', name: 'Trenchcoat', cover_image_url: null },
      outfit_archetype: { id: 'oa1', name: 'Regenmantel', prompt: 'A long belted raincoat.' },
      location: { id: 'l1', name: 'Hafen', cover_image_url: null },
      location_archetype: { id: 'la1', name: 'Lagerhalle', prompt: 'A cavernous warehouse.' },
      pose: { id: 'p1', name: 'Stehend', description: '' },
      expression: { id: 'e1', name: 'Ernst', description: null },
      camera: { id: 'k1', name: 'Handkamera', description: 'Handheld camera feel.' },
      style: { id: 's1', name: 'Stil', prompt: 'Gritty neo-noir look' },
      grading: { id: 'g1', name: 'Grading', prompt: 'Teal and orange grading!' },
      background: 'white',
    }),
    sceneRefs: refs({
      character: REF('Charakter'),
      character_archetype: REF('CharakterArchetyp'),
      outfit: REF('Outfit'),
      outfit_archetype: REF('OutfitArchetyp'),
      location: REF('Location'),
      location_archetype: REF('LocationArchetyp'),
    }),
    erwartet: 'Outdoor scene.\n\nWarm golden-hour sunlight, soft long shadows, crisp autumn atmosphere with golden and red fallen leaves, foggy atmosphere with reduced visibility, natural outdoor lighting, atmospheric depth, realistic environmental illumination.\n\nFull body environmental shot, 24mm wide-angle lens, strong sense of place, natural environmental context.\n\nUse the provided character reference.\n\nDepict the character as a detektivin.\n\nFollow this character description:\n\nA weathered detective.\n\nUse the provided outfit reference.\n\nDress the character in a regenmantel.\n\nFollow this outfit description:\n\nA long belted raincoat.\n\nUse the provided location reference.\n\nCreate a lagerhalle within the Hafen environment.\n\nFollow this location description:\n\nA cavernous warehouse.\n\nThe character is in a Stehend pose.\n\nErnst facial expression.\n\nHandheld camera feel.\n\nGritty neo-noir look.\n\nTeal and orange grading!\n\nPhotorealistic.',
  },
  {
    name: 'nur_archetypen_mit_bild',
    scene: szene({
      character_archetype: { id: 'ca1', name: 'Detektivin', prompt: 'A weathered detective.' },
      outfit_archetype: { id: 'oa1', name: 'Regenmantel', prompt: 'A long belted raincoat.' },
      location_archetype: { id: 'la1', name: 'Lagerhalle', prompt: 'A cavernous warehouse.' },
      background: 'black',
    }),
    sceneRefs: refs({
      character_archetype: REF('CharakterArchetyp'),
      outfit_archetype: REF('OutfitArchetyp'),
      location_archetype: REF('LocationArchetyp'),
    }),
    erwartet: 'Outdoor scene.\n\nUse the provided character reference.\n\nAdditionally follow this character description:\n\nA weathered detective.\n\nUse the provided outfit reference.\n\nAdditionally follow this outfit description:\n\nA long belted raincoat.\n\nUse the provided location reference.\n\nAdditionally follow this location description:\n\nA cavernous warehouse.\n\nPhotorealistic.',
  },
  {
    name: 'nur_archetypen_ohne_bild',
    scene: szene({
      character_archetype: { id: 'ca1', name: 'Detektivin', prompt: 'A weathered detective.' },
      outfit_archetype: { id: 'oa1', name: 'Regenmantel', prompt: '   ' },
      location_archetype: { id: 'la1', name: 'Lagerhalle', prompt: null },
      background: 'beige',
    }),
    sceneRefs: refs(),
    erwartet: 'Outdoor scene.\n\nUse the following character description:\n\nA weathered detective.\n\nPhotorealistic.',
  },
  {
    name: 'nur_hintergrund',
    scene: szene({ scene_type: 'indoor', light_style: 'high_key', background: 'green_screen' }),
    sceneRefs: refs(),
    erwartet: 'Indoor scene.\n\nBright, high-key lighting with minimal shadows, clean indoor lighting setup, natural skin tones.\n\nFlat chroma key green screen background.\n\nPhotorealistic.',
  },
  {
    name: 'kamera_override_135',
    scene: szene({ shot_type: 'closeup', lens: '135mm', camera_angle: 'birds_eye', aspect_ratio: 'square_1_1' }),
    sceneRefs: refs(),
    erwartet: 'Outdoor scene.\n\nProfessional close-up portrait, 135mm telephoto lens, strong background compression, flattering facial proportions, shallow depth of field.\n\nPhotorealistic.',
  },
  {
    name: 'pose_ohne_beschreibung',
    scene: szene({
      pose: { id: 'p1', name: 'Kontrapost', description: null },
      expression: { id: 'e1', name: 'Lächeln', description: '   ' },
      camera: { id: 'k1', name: 'Dolly', description: null },
    }),
    sceneRefs: refs(),
    erwartet: 'Outdoor scene.\n\nThe character is in a Kontrapost pose.\n\nLächeln facial expression.\n\nDolly.\n\nPhotorealistic.',
  },
]

describe('Gegenprobe: der Prompt ist nach der Verschiebung Zeichen für Zeichen derselbe', () => {
  for (const fall of GRUNDLINIE) {
    it(fall.name, () => {
      expect(buildPrompt(fall.scene, fall.sceneRefs)).toBe(fall.erwartet)
    })
  }
})

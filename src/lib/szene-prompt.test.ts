import { describe, it, expect } from 'vitest'
import {
  capitalize, buildEnvironmentSentence, buildCameraSentence,
  buildCharacterSection, buildOutfitSection, buildLocationSection, buildPrompt,
  type Scene,
} from './szene-prompt'

/**
 * Die Prompt-Erzeugung des Scene Builders (PROJ-51).
 *
 * Diese Logik hatte bis zur Verschiebung aus `scene-builder/page.tsx` KEINE
 * Tests — sie steckte in einer Seitenkomponente und war nur über die Oberfläche
 * erreichbar. Sie steuert aber, was tatsächlich an gpt-image-2 geht, und ein
 * Fehler darin fällt nicht als Fehler auf, sondern als leicht anderes Bild.
 *
 * PROJ-52 (03.09.2026) hat die Archetypen ersatzlos entfernt. Was sich dadurch
 * an den Grundlinien geaendert hat, steht unten bei jeder einzeln dabei — die
 * fuenf Grundlinien OHNE Archetypen sind zeichengleich geblieben.
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
  character: null, outfit: null,
  location: null, pose: null, expression: null, camera: null,
  style: null, grading: null, background: null,
}

/** Eine Szene aus dem leeren Grundzustand plus den gesetzten Feldern. */
const szene = (felder: Record<string, unknown> = {}): Scene => ({ ...LEER, ...felder })

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
   * Satzes.
   *
   * BIS ZUM 04.09.2026 VERDRÄNGTEN SIE ALLES ANDERE — auch einen gewählten
   * Kamerawinkel, eine gewählte Blende, ein gewähltes Format. Genau das stand
   * hier als erwartetes Verhalten, und es war falsch: In einer
   * Einstellungsreihe (PROJ-44) wechselt nur die Einstellungsgröße, und
   * ausgerechnet bei `closeup` und `full_body` fiel damit für ein einzelnes
   * Bild der Kamerawinkel weg, während alle anderen ihn trugen. Jetzt ersetzt
   * der Sonderfall NUR Einstellungsgröße und Objektiv; alles Übrige hängt
   * sich normal an.
   */
  it('Nahaufnahme + 135mm nimmt den fertigen Satz, behält aber Winkel und Format', () => {
    const satz = buildCameraSentence(szene({
      shot_type: 'closeup', lens: '135mm', camera_angle: 'birds_eye', aspect_ratio: 'square_1_1',
    }))!
    expect(satz.startsWith('Professional close-up portrait, 135mm telephoto lens')).toBe(true)
    expect(satz).toContain("bird's-eye perspective")
    expect(satz).toContain('(1:1)')
  })

  it('setzt die eingebaute Blende des Sonderfalls nur ein, wenn die Szene keine wählt', () => {
    const ohne = buildCameraSentence(szene({ shot_type: 'closeup', lens: '135mm' }))!
    expect(ohne).toContain('shallow depth of field')

    // Marks ausdrückliche Wahl gewinnt gegen den eingebauten Satz — sonst
    // stünde eine Blende im Prompt, die er gerade abgewählt hat.
    const mit = buildCameraSentence(szene({
      shot_type: 'closeup', lens: '135mm', depth_of_field: 'deep_focus',
    }))!
    expect(mit).toContain('deep focus')
    expect(mit).not.toContain('shallow depth of field')
  })

  it('nennt das Objektiv im Sonderfall genau EINMAL', () => {
    // Der fertige Satz nennt das Objektiv selbst. Griffe die normale
    // Objektiv-Zeile zusätzlich, stünde "135mm" doppelt im Prompt.
    const satz = buildCameraSentence(szene({ shot_type: 'closeup', lens: '135mm' }))!
    expect(satz.match(/135mm/g)!.length).toBe(1)
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

/**
 * Bis PROJ-52 standen hier sechs Faelle: die Dreifall-Logik aus echtem
 * Charakter, Archetyp mit Bild und Archetyp ohne Bild, dazu die Mischformen.
 * Die Archetypen sind ersatzlos entfallen (Marks Entscheidung vom 03.09.2026),
 * und mit ihnen die Saetze "Depict the character as a ...", "Follow this
 * character description", "Additionally follow ..." und "Use the following
 * character description". Uebrig bleiben die zwei Faelle, die es wirklich gibt.
 */
describe('buildCharacterSection', () => {
  const person: any = { id: 'c1', name: 'Nora' }

  it('ohne Charakter bleibt der Abschnitt leer', () => {
    expect(buildCharacterSection(szene())).toEqual([])
  })

  it('echter Charakter: der Verweis auf die Referenz', () => {
    expect(buildCharacterSection(szene({ character: person })))
      .toEqual(['Use the provided character reference.'])
  })

  /**
   * GEGENPROBE ZUM RUECKBAU: Ein Rest-Archetyp am Szenenobjekt — wie er aus
   * einem alten, gespeicherten Preset kommen koennte — darf den Prompt NICHT
   * mehr veraendern. Wuerde die alte Logik noch irgendwo greifen, waere dieser
   * Test rot.
   */
  it('ein uebrig gebliebenes Archetyp-Feld wird ignoriert', () => {
    const mitRest = szene({
      character: person,
      character_archetype: { id: 'ca1', name: 'Detektivin', prompt: 'A weathered detective.' },
    })
    expect(buildCharacterSection(mitRest)).toEqual(['Use the provided character reference.'])
  })
})

// ── Outfit-Abschnitt ──────────────────────────────────────────────────────────

// Wie beim Charakter: Die drei Archetyp-Faelle sind mit PROJ-52 entfallen,
// samt der Saetze "Dress the character in a ..." und "Follow this outfit
// description".
describe('buildOutfitSection', () => {
  const outfit: any = { id: 'o1', name: 'Trenchcoat' }

  it('ohne Outfit bleibt der Abschnitt leer', () => {
    expect(buildOutfitSection(szene())).toEqual([])
  })

  it('echtes Outfit: der Verweis auf die Referenz', () => {
    expect(buildOutfitSection(szene({ outfit })))
      .toEqual(['Use the provided outfit reference.'])
  })

  it('ein uebrig gebliebenes Archetyp-Feld wird ignoriert', () => {
    const mitRest = szene({
      outfit,
      outfit_archetype: { id: 'oa1', name: 'Regenmantel', prompt: 'A long belted raincoat.' },
    })
    expect(buildOutfitSection(mitRest)).toEqual(['Use the provided outfit reference.'])
  })
})

// ── Location-Abschnitt und der Hintergrund ────────────────────────────────────

describe('buildLocationSection', () => {
  const ort: any = { id: 'l1', name: 'Hafen' }

  it('echte Location: der Verweis auf die Referenz', () => {
    expect(buildLocationSection(szene({ location: ort })))
      .toEqual(['Use the provided location reference.'])
  })

  /**
   * DER RUECKFALL AUF DEN STUDIO-HINTERGRUND BLEIBT — er ist mit PROJ-52
   * ausdruecklich NICHT entfallen. Nur die Zwischenstufe "oder ein
   * Location-Archetyp" ist weg: Der Hintergrund greift jetzt genau dann, wenn
   * keine Location gewaehlt ist. Genau das steht in der Oberflaeche auch als
   * Hinweis ("wird ignoriert, sobald unten eine Location gewaehlt wird") —
   * hier ist es nachgemessen.
   */
  it('Hintergrund allein wird zum Satz', () => {
    expect(buildLocationSection(szene({ background: 'gradient_grey' })))
      .toEqual(['Smooth grey gradient seamless studio backdrop background.'])
  })

  it('Hintergrund wird von einer echten Location verdraengt', () => {
    const teile = buildLocationSection(szene({ background: 'white', location: ort }))
    expect(teile).toEqual(['Use the provided location reference.'])
    expect(teile.join(' ')).not.toContain('background')
  })

  /**
   * Die Kehrseite dazu: Ein Rest-Archetyp aus einem alten Preset darf den
   * Hintergrund NICHT mehr verdraengen. Frueher tat er das — wer heute nur
   * einen Hintergrund waehlt, muss ihn auch bekommen.
   */
  it('ein uebrig gebliebener Location-Archetyp verdraengt den Hintergrund NICHT mehr', () => {
    const mitRest = szene({
      background: 'gradient_grey',
      location_archetype: { id: 'la1', name: 'Lagerhalle', prompt: 'A cavernous warehouse.' },
    })
    expect(buildLocationSection(mitRest))
      .toEqual(['Smooth grey gradient seamless studio backdrop background.'])
  })

  it('ohne alles bleibt der Abschnitt leer', () => {
    expect(buildLocationSection(szene())).toEqual([])
  })
})

// ── Der ganze Prompt ──────────────────────────────────────────────────────────

describe('buildPrompt', () => {
  it('nennt Innen und Außen ausdrücklich', () => {
    expect(buildPrompt(szene({ scene_type: 'indoor' })).startsWith('Indoor scene.')).toBe(true)
    expect(buildPrompt(szene({ scene_type: 'outdoor' })).startsWith('Outdoor scene.')).toBe(true)
  })

  it('schließt immer mit „Photorealistic."', () => {
    expect(buildPrompt(szene()).endsWith('Photorealistic.')).toBe(true)
  })

  it('trennt die Abschnitte durch eine Leerzeile', () => {
    expect(buildPrompt(szene())).toBe('Outdoor scene.\n\nPhotorealistic.')
  })

  it('nimmt bei Pose, Mimik und Kamera-Asset die Beschreibung, sonst den Namen', () => {
    const p = buildPrompt(szene({
      pose:       { id: 'p', name: 'Kontrapost', description: 'Weight on one leg.' } as any,
      expression: { id: 'e', name: 'Lächeln', description: '   ' } as any,
      camera:     { id: 'k', name: 'Dolly', description: null } as any,
    }))
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
    }))
    expect(p).toContain('Gritty neo-noir look.')
    expect(p).toContain('Cool teal shadows.')
  })

  it('lässt einen vorhandenen Schlusspunkt in Ruhe — auch ! und ?', () => {
    const p = buildPrompt(szene({
      style:   { id: 's', name: 'S', prompt: 'Already ends properly.' } as any,
      grading: { id: 'g', name: 'G', prompt: 'Teal and orange grading!' } as any,
    }))
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
    }))
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
const GRUNDLINIE: { name: string; scene: Scene; erwartet: string }[] = [
  // UNVERAENDERT seit der Aufzeichnung.
  {
    name: 'leer_outdoor',
    scene: szene(),
    erwartet: 'Outdoor scene.\n\nPhotorealistic.',
  },
  // UNVERAENDERT seit der Aufzeichnung.
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
    erwartet: 'Indoor scene.\n\nCinematic lighting with dramatic contrast, even, shadowless ring light illumination, soft hair light highlighting the hair, subtle catchlights in the eyes, clean indoor lighting setup, natural skin tones.\n\nClose-up portrait framing, eye-level camera angle with natural perspective, professional 85mm portrait lens, shallow depth of field with soft background blur, vertical portrait composition (4:5).\n\nUse the provided character reference.\n\nSmooth grey gradient seamless studio backdrop background.\n\nCalm, neutral expression.\n\nCinematic film still.\n\nBleach bypass grading.\n\nPhotorealistic.',
  },
  /**
   * GEAENDERT DURCH PROJ-52. Hiess bis dahin `outdoor_voll_mit_archetypen`.
   *
   * Die Szene ist unveraendert geblieben, samt der drei Archetyp-Felder — die
   * stehen hier absichtlich noch drin, wie sie aus einem alten gespeicherten
   * Preset kommen koennten. Entfallen sind aus dem erwarteten Prompt genau die
   * sechs Saetze, die die Archetypen beigesteuert haben:
   *
   *   'Depict the character as a detektivin.'
   *   'Follow this character description:\n\nA weathered detective.'
   *   'Dress the character in a regenmantel.'
   *   'Follow this outfit description:\n\nA long belted raincoat.'
   *   'Create a lagerhalle within the Hafen environment.'
   *   'Follow this location description:\n\nA cavernous warehouse.'
   *
   * Alles andere — Umgebung, Kamera, die drei Referenzsaetze, Pose, Mimik,
   * Kamera-Asset, Stil, Grading, Schlusszeile — steht Zeichen fuer Zeichen
   * unveraendert da. Der Hintergrund 'white' wird weiterhin von der echten
   * Location verdraengt.
   */
  /*
   * ABSICHTLICH NEU AUFGEZEICHNET AM 04.09.2026, gleicher Grund wie bei
   * 'kamera_override_135': Der Sonderfall full_body + 24mm verwarf vorher
   * den gewaehlten Kamerawinkel, die Tiefenschaerfe und den Formatsatz.
   * Alle drei stehen jetzt wieder im Prompt.
   */
  {
    name: 'outdoor_voll_mit_archetyp_resten',
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
    erwartet: 'Outdoor scene.\n\nWarm golden-hour sunlight, soft long shadows, crisp autumn atmosphere with golden and red fallen leaves, foggy atmosphere with reduced visibility, natural outdoor lighting, atmospheric depth, realistic environmental illumination.\n\nFull body environmental shot, 24mm wide-angle lens, strong sense of place, natural environmental context, low-angle camera view creating a powerful appearance, deep focus with everything sharp from foreground to background, wide landscape composition (16:9).\n\nUse the provided character reference.\n\nUse the provided outfit reference.\n\nUse the provided location reference.\n\nThe character is in a Stehend pose.\n\nErnst facial expression.\n\nHandheld camera feel.\n\nGritty neo-noir look.\n\nTeal and orange grading!\n\nPhotorealistic.',
  },
  /**
   * GEAENDERT DURCH PROJ-52. Hiess bis dahin `nur_archetypen_mit_bild`.
   *
   * Hier ist die Aenderung am groessten, und sie ist der Kern der Entscheidung:
   * Eine Szene NUR aus Archetypen ergibt jetzt gar keinen Asset-Abschnitt mehr.
   * Weggefallen sind alle sechs Zeilen ('Use the provided … reference.' und
   * 'Additionally follow this … description: …' fuer Charakter, Outfit und
   * Location).
   *
   * DAFUER KOMMT ETWAS HINZU: der Studio-Hintergrund 'black'. Er stand vorher
   * im Prompt NICHT, weil der Location-Archetyp ihn verdraengt hat. Ohne
   * Archetypen ist keine Location mehr gesetzt, und damit greift der Rueckfall
   * wie vorgesehen. Das ist gewollt.
   */
  {
    name: 'nur_archetyp_reste_mit_hintergrund',
    scene: szene({
      character_archetype: { id: 'ca1', name: 'Detektivin', prompt: 'A weathered detective.' },
      outfit_archetype: { id: 'oa1', name: 'Regenmantel', prompt: 'A long belted raincoat.' },
      location_archetype: { id: 'la1', name: 'Lagerhalle', prompt: 'A cavernous warehouse.' },
      background: 'black',
    }),
    erwartet: 'Outdoor scene.\n\nPlain black seamless studio backdrop background.\n\nPhotorealistic.',
  },
  /**
   * GEAENDERT DURCH PROJ-52. Hiess bis dahin `nur_archetypen_ohne_bild`.
   *
   * Weggefallen ist der Satz 'Use the following character description:\n\nA
   * weathered detective.' — das war die Sonderfaehigkeit der Archetypen, eine
   * Beschreibung OHNE eigenes Bild in den Prompt zu bringen. Mark hat sie am
   * 03.09.2026 ausdruecklich ersatzlos gestrichen.
   *
   * Hinzugekommen ist auch hier der Hintergrund, aus demselben Grund wie beim
   * Fall darueber: 'beige' statt vorher gar nichts.
   */
  {
    name: 'archetyp_reste_ohne_bild',
    scene: szene({
      character_archetype: { id: 'ca1', name: 'Detektivin', prompt: 'A weathered detective.' },
      outfit_archetype: { id: 'oa1', name: 'Regenmantel', prompt: '   ' },
      location_archetype: { id: 'la1', name: 'Lagerhalle', prompt: null },
      background: 'beige',
    }),
    erwartet: 'Outdoor scene.\n\nPlain warm beige seamless studio backdrop background.\n\nPhotorealistic.',
  },
  // UNVERAENDERT seit der Aufzeichnung.
  {
    name: 'nur_hintergrund',
    scene: szene({ scene_type: 'indoor', light_style: 'high_key', background: 'green_screen' }),
    erwartet: 'Indoor scene.\n\nBright, high-key lighting with minimal shadows, clean indoor lighting setup, natural skin tones.\n\nFlat chroma key green screen background.\n\nPhotorealistic.',
  },
  /*
   * ABSICHTLICH NEU AUFGEZEICHNET AM 04.09.2026 — mit Begruendung, so wie es
   * der Kopf dieser Tabelle verlangt.
   *
   * Vorher endete der Satz nach "flattering facial proportions, shallow depth
   * of field." Der gewaehlte Kamerawinkel (birds_eye) und das gewaehlte
   * Format (1:1) fehlten. Das war der Fehler, den die Pruefung von PROJ-44
   * gefunden hat: In einer Einstellungsreihe faellt der Winkel dadurch fuer
   * genau ein Bild weg, waehrend alle uebrigen ihn tragen.
   */
  {
    name: 'kamera_override_135',
    scene: szene({ shot_type: 'closeup', lens: '135mm', camera_angle: 'birds_eye', aspect_ratio: 'square_1_1' }),
    erwartet: "Outdoor scene.\n\nProfessional close-up portrait, 135mm telephoto lens, strong background compression, flattering facial proportions, bird's-eye perspective looking directly downward, shallow depth of field, balanced square framing (1:1).\n\nPhotorealistic.",
  },
  // UNVERAENDERT seit der Aufzeichnung.
  {
    name: 'pose_ohne_beschreibung',
    scene: szene({
      pose: { id: 'p1', name: 'Kontrapost', description: null },
      expression: { id: 'e1', name: 'L\u00e4cheln', description: '   ' },
      camera: { id: 'k1', name: 'Dolly', description: null },
    }),
    erwartet: 'Outdoor scene.\n\nThe character is in a Kontrapost pose.\n\nL\u00e4cheln facial expression.\n\nDolly.\n\nPhotorealistic.',
  },
]

describe('Gegenprobe: der Prompt ist Zeichen f\u00fcr Zeichen der aufgezeichnete', () => {
  for (const fall of GRUNDLINIE) {
    it(fall.name, () => {
      expect(buildPrompt(fall.scene)).toBe(fall.erwartet)
    })
  }
})

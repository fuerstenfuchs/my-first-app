import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  groesseFuerFormat, formatAnsage, promptFuerAuftrag, referenzZuordnung,
  NATIVE_GROESSEN, GROESSE_VORGABE, DURCHLAEUFE, type ReferenzRolle,
} from './image-generation'
import { ASPECT_RATIOS } from './scene-builder-options'

describe('Formatzuordnung', () => {
  it('bildet jedes Trésor-Format auf eine Größe ab, die gpt-image-2 kennt', () => {
    // Fällt ein Format durch, würde die Gegenstelle den Auftrag ablehnen —
    // erst nachdem der Arbeiter ihn schon übernommen hat.
    for (const format of ASPECT_RATIOS) {
      const { size } = groesseFuerFormat(format.key)
      expect(NATIVE_GROESSEN, `Format ${format.key}`).toContain(size)
    }
  })

  it('ohne gewähltes Format quadratisch — die einzige Größe ohne Richtungsannahme', () => {
    expect(groesseFuerFormat(null).size).toBe(GROESSE_VORGABE)
    expect(groesseFuerFormat(null).exakt).toBe(true)
  })

  it('markiert nur 1:1 als exakt, alle anderen als angenähert', () => {
    expect(groesseFuerFormat('square_1_1').exakt).toBe(true)
    for (const key of ['landscape_16_9', 'story_9_16', 'portrait_4_5', 'cinematic_21_9'] as const) {
      expect(groesseFuerFormat(key).exakt, `Format ${key}`).toBe(false)
      expect(groesseFuerFormat(key).hinweis, `Format ${key} braucht einen Hinweis`).toBeTruthy()
    }
  })

  it('wählt hochkant für hochkant und quer für quer', () => {
    expect(groesseFuerFormat('story_9_16').size).toBe('1024x1536')
    expect(groesseFuerFormat('portrait_4_5').size).toBe('1024x1536')
    expect(groesseFuerFormat('landscape_16_9').size).toBe('1536x1024')
    expect(groesseFuerFormat('cinematic_21_9').size).toBe('1536x1024')
  })
})

describe('Formatansage für den Prompt', () => {
  // Nötig, weil gpt-image-2 den Größenparameter ignoriert, sobald ein
  // Referenzbild mitgeht (am 01.09.2026 nachgemessen: 1024x1024 angefordert,
  // 1122x1402 zurückbekommen). Dann hilft nur eine Ansage im Prompt.
  it('liefert für jedes Format eine Ansage', () => {
    for (const format of ASPECT_RATIOS) {
      const ansage = formatAnsage(format.key)
      expect(ansage, `Format ${format.key}`).toBeTruthy()
      expect(ansage!.length).toBeGreaterThan(10)
    }
  })

  it('liefert ohne Format keine Ansage', () => {
    expect(formatAnsage(null)).toBeNull()
  })

  it('nennt das Seitenverhältnis wörtlich, damit das Modell es aufgreift', () => {
    expect(formatAnsage('landscape_16_9')).toContain('16:9')
    expect(formatAnsage('story_9_16')).toContain('9:16')
    expect(formatAnsage('cinematic_21_9')).toContain('21:9')
    expect(formatAnsage('portrait_4_5')).toContain('4:5')
    expect(formatAnsage('square_1_1')).toContain('1:1')
  })
})

describe('Durchläufe', () => {
  it('deckt sich mit der Schranke, die im Migrations-SQL steht', () => {
    // Ein Test gegen die Konstante selbst würde nichts absichern. Geprüft wird
    // deshalb gegen die Quelle der Wahrheit: check (variants between 1 and 4)
    // in docs/proj-37-image-jobs.sql. Ein fünfter Wert in der Oberfläche würde
    // beim Speichern von der Datenbank abgelehnt.
    const sql = readFileSync(join(process.cwd(), 'docs/proj-37-image-jobs.sql'), 'utf-8')
    const treffer = sql.match(/variants between (\d+) and (\d+)/)
    expect(treffer, 'Schranke im SQL nicht gefunden').toBeTruthy()
    expect(Math.min(...DURCHLAEUFE)).toBe(Number(treffer![1]))
    expect(Math.max(...DURCHLAEUFE)).toBe(Number(treffer![2]))
  })
})

describe('Prompt für den Auftrag', () => {
  const PROMPT = 'Indoor scene. Close-up shot. Photorealistic.'

  it('lässt den Prompt ohne Referenzbild unangetastet', () => {
    // Ohne Referenz wirkt der Größenparameter — die Ansage wäre überflüssig.
    expect(promptFuerAuftrag(PROMPT, 'landscape_16_9', [])).toBe(PROMPT)
    expect(promptFuerAuftrag(PROMPT, null, [])).toBe(PROMPT)
  })

  it('hängt mit Referenzbild die Formatansage an', () => {
    const ergebnis = promptFuerAuftrag(PROMPT, 'landscape_16_9', ['character'])
    expect(ergebnis.startsWith(PROMPT)).toBe(true)
    expect(ergebnis).toContain('16:9')
    expect(ergebnis).toContain('\n\n')
  })

  it('hängt ohne gewähltes Format keine Formatansage an — die Zuordnung aber schon', () => {
    const ergebnis = promptFuerAuftrag(PROMPT, null, ['character'])
    for (const ansage of Object.values({
      a: 'CINEMATIC LANDSCAPE', b: 'VERTICAL', c: 'SQUARE', d: 'CINEMASCOPE',
    })) {
      expect(ergebnis, `Formatansage "${ansage}" gehört ohne gewähltes Format nicht hinein`)
        .not.toContain(ansage)
    }
    expect(ergebnis).toContain('Image 1 = CHARACTER')
  })

  it('verändert den ursprünglichen Prompt nie — er bleibt am Anfang stehen', () => {
    // Briefing 9: An der Prompt-Erzeugung wird nichts geändert. Angehängt wird
    // nur, nie ersetzt oder umgeschrieben.
    for (const format of ASPECT_RATIOS) {
      for (const rollen of [[], ['character'], ['character', 'outfit']] as ReferenzRolle[][]) {
        expect(
          promptFuerAuftrag(PROMPT, format.key, rollen).startsWith(PROMPT),
          `${format.key}, ${rollen.length} Referenzen`,
        ).toBe(true)
      }
    }
  })
})

describe('Zuordnung der Referenzbilder', () => {
  // Am 01.09.2026 an einem echten Ergebnis gesehen: Bei Charakter + Outfit nahm
  // das Modell die Person aus dem OUTFIT-Bild. Die Bilder gingen unbeschriftet
  // mit, der Prompt sagte nicht, welches welches ist.

  it('ordnet AUCH ein einzelnes Bild zu', () => {
    // Erst nach dem Gegenlesen bemerkt: Der Fehler war nicht die Verwechslung
    // zweier Bilder, sondern die Frage, welchen Aspekt eines Bildes das Modell
    // nimmt. Ein einzelnes Outfit-Foto mit Person darin fuehrt ohne Ansage
    // genauso zur falschen Person.
    const block = referenzZuordnung(['outfit'])
    expect(block).toBeTruthy()
    expect(block!).toContain('Image 1 = OUTFIT')
    expect(block!.toLowerCase()).toContain('not the subject')
  })

  it('bleibt nur ohne jedes Bild stumm', () => {
    expect(referenzZuordnung([])).toBeNull()
  })

  it('laesst die Location die Szenenbedingungen nicht ueberschreiben', () => {
    // "atmosphere" umfasste Licht, Tageszeit und Wetter — das steht aber schon
    // im Prompt darueber und haette sich widersprochen.
    const block = referenzZuordnung(['location'])!
    expect(block.toLowerCase()).not.toContain('atmosphere')
    expect(block.toLowerCase()).toContain('defined in the text above')
  })

  it('nummeriert ab zwei Bildern in der Reihenfolge, in der sie abgeschickt werden', () => {
    const block = referenzZuordnung(['character', 'outfit'])!
    expect(block).toContain('Image 1 = CHARACTER')
    expect(block).toContain('Image 2 = OUTFIT')
    expect(block.indexOf('Image 1')).toBeLessThan(block.indexOf('Image 2'))
  })

  it('sagt beim Outfit ausdrücklich, dass die abgebildete Person nicht gemeint ist', () => {
    // Genau der Fehler, der aufgetreten ist.
    const block = referenzZuordnung(['character', 'outfit'])!
    expect(block.toLowerCase()).toContain('not the subject')
  })

  it('landet vollständig im Prompt', () => {
    const ergebnis = promptFuerAuftrag('Basis.', 'square_1_1', ['character', 'outfit', 'location'])
    for (const wort of ['Image 1 = CHARACTER', 'Image 2 = OUTFIT', 'Image 3 = LOCATION']) {
      expect(ergebnis).toContain(wort)
    }
  })

  it('deckt jede mögliche Rolle mit einer Anweisung ab', () => {
    const block = referenzZuordnung(['character', 'outfit', 'location'])!
    for (const rolle of ['CHARACTER', 'OUTFIT', 'LOCATION']) {
      expect(block).toContain(rolle)
    }
  })
})

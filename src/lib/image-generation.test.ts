import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MODELLE, istLokal, passtZuReferenzen, modelleFuer, formatHinweis, rechnetInKlassen, hatStufen, lokaleGroesse, lokaleMasse, ersatzModell,
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

  it('sagt ausdrücklich, was bei Widerspruch zum Prompt gilt', () => {
    // Ohne diese Ansage entscheidet das Modell selbst, ob der Text oder das Bild
    // gewinnt — und das ist unvorhersehbar. Festgelegt: Für den Aspekt, den ein
    // Bild abdeckt, gewinnt das Bild.
    const block = referenzZuordnung(['character'])!
    expect(block.toLowerCase()).toContain('follow the reference image')
    expect(block.toLowerCase()).toContain('ignore the conflicting words')
    // Szene, Licht und Kamera bleiben beim Text.
    expect(block.toLowerCase()).toContain('comes from the text')
  })

  it('nennt im Vorrang-Satz nur die Bereiche, für die auch ein Bild mitgeht', () => {
    expect(referenzZuordnung(['character'])!).toContain('the person')
    expect(referenzZuordnung(['character'])!).not.toContain('the clothing')
    expect(referenzZuordnung(['outfit'])!).toContain('the clothing')
    const alle = referenzZuordnung(['character', 'outfit', 'location'])!
    for (const b of ['the person', 'the clothing', 'the place']) {
      expect(alle).toContain(b)
    }
  })

  it('deckt jede mögliche Rolle mit einer Anweisung ab', () => {
    const block = referenzZuordnung(['character', 'outfit', 'location'])!
    for (const rolle of ['CHARACTER', 'OUTFIT', 'LOCATION']) {
      expect(block).toContain(rolle)
    }
  })
})

describe('Welches Bildmodell die Vorgabe ist', () => {
  /*
    MARKS ANSAGE vom 11.09.2026: „Kannst Du ab sofort als erstes Bildmodell im
    Proxy GPT Image zwei Punkt fuenf sunburst nehmen."

    Warum das einen Test wert ist: Ein falsches Vorgabemodell faellt an keiner
    Stelle als Fehler auf. Der Auftrag laeuft durch, das Bild kommt, es sieht
    nur anders aus — kuehler und flacher als das, was Mark ausgesucht hat.
    Gemerkt haette er es erst beim Vergleich zweier Bilder.
  */
  it('nimmt gpt-image-2.5-sunburst als erstes', () => {
    expect(MODELLE[0].id).toBe('gpt-image-2.5-sunburst')
  })

  it('fuehrt alle drei Spielarten und laesst sie Referenzbilder annehmen', () => {
    // Mark am 10.09.2026: „dann sollen fuer mich auch immer alle drei zur
    // Auswahl stehen." Und `kannReferenzen` entscheidet, ob ein Modell im
    // Scene Builder ueberhaupt angeboten wird — waere es hier falsch, fiele
    // die halbe App fuer diese Modelle aus.
    for (const id of ['gpt-image-2.5-sunburst', 'gpt-image-2.5', 'gpt-image-2.5-flare']) {
      const m = MODELLE.find(x => x.id === id)
      expect(m, id).toBeTruthy()
      expect(m!.kannReferenzen, id).toBe(true)
    }
  })

  it('behaelt gpt-image-2 in der Liste', () => {
    // Nicht aus Nostalgie: In der Warteschlange stehen Auftraege mit dieser
    // Kennung. Ein Eintrag, den die Anzeige nicht mehr aufloesen kann, saehe
    // dort aus wie ein Fehler.
    expect(MODELLE.some(m => m.id === 'gpt-image-2')).toBe(true)
  })
})

describe('Lokale Modelle auf dem neuen PC', () => {
  it('stehen hinter allen Proxy-Modellen — der Proxy bleibt der Standardweg', () => {
    const erstes = MODELLE.findIndex(m => istLokal(m.id))
    expect(erstes).toBeGreaterThan(0)
    expect(MODELLE.slice(erstes).every(m => istLokal(m.id))).toBe(true)
    expect(istLokal(MODELLE[0].id)).toBe(false)
  })

  it('tragen die Vorsilbe, die der Arbeiter zur Weiche macht', () => {
    for (const id of ['qwen21', 'klein9b', 'klein4b', 'sdxl_instantid']) {
      expect(MODELLE.some(m => m.id === `lokal:${id}`), id).toBe(true)
    }
  })

  it('SDXL+InstantID verlangt genau ein Referenzbild', () => {
    expect(passtZuReferenzen('lokal:sdxl_instantid', 0)).toBe(false)
    expect(passtZuReferenzen('lokal:sdxl_instantid', 1)).toBe(true)
    expect(passtZuReferenzen('lokal:sdxl_instantid', 2)).toBe(false)
  })

  it('Qwen und FLUX klein nehmen null bis vier Referenzen', () => {
    for (const id of ['lokal:qwen21', 'lokal:klein9b', 'lokal:klein4b'] as const) {
      expect(passtZuReferenzen(id, 0), id).toBe(true)
      expect(passtZuReferenzen(id, 4), id).toBe(true)
      expect(passtZuReferenzen(id, 5), id).toBe(false)
    }
  })

  it('Gemini bleibt bei Referenzen draussen, Proxy-Modelle haben keine Obergrenze', () => {
    expect(passtZuReferenzen('gemini-3.1-flash-image', 1)).toBe(false)
    expect(passtZuReferenzen('gpt-image-2.5-sunburst', 8)).toBe(true)
  })

  it('modelleFuer folgt der Zahl der Referenzen', () => {
    expect(modelleFuer(0).some(m => m.id === 'lokal:sdxl_instantid')).toBe(false)
    expect(modelleFuer(1).some(m => m.id === 'lokal:sdxl_instantid')).toBe(true)
    expect(modelleFuer(2).some(m => m.id === 'lokal:sdxl_instantid')).toBe(false)
    expect(modelleFuer(0)[0].id).toBe('gpt-image-2.5-sunburst')
  })

  it('rechnet nicht in Klassen und verspricht kein Proxy-Format', () => {
    expect(rechnetInKlassen('lokal:qwen21')).toBe(false)
    expect(formatHinweis('lokal:qwen21', 'landscape_16_9')).not.toMatch(/3:2/)
  })
})

describe('Größe lokaler Aufträge', () => {
  it('Standard sind rund 2 MP, Schnell 1 MP, Maximal 4,7 MP', () => {
    const mp = (g: string) => { const [w, h] = g.split('x').map(Number); return (w * h) / 1e6 }
    expect(mp(lokaleGroesse('portrait_4_5', '1024x1536'))).toBeGreaterThan(2.0)
    expect(mp(lokaleGroesse('portrait_4_5', '1024x1536'))).toBeLessThan(2.4)
    expect(mp(lokaleGroesse('landscape_16_9', '1536x1024', 'schnell'))).toBeLessThan(1.1)
    expect(mp(lokaleGroesse('landscape_16_9', '1536x1024', 'maximal'))).toBeGreaterThan(4.3)
    expect(mp(lokaleGroesse('landscape_16_9', '1536x1024', 'maximal'))).toBeLessThanOrEqual(5.0)
  })
  it('alle Stufen und Formate: durch 16 teilbar, in den Grenzen des Arbeiters', () => {
    for (const s of ['schnell', 'standard', 'maximal'] as const) {
      for (const v of ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '4:5', '21:9']) {
        const [w, h] = lokaleMasse(v, s)
        expect(w % 16 + h % 16, `${s} ${v}`).toBe(0)
        expect(Math.max(w, h), `${s} ${v}`).toBeLessThanOrEqual(2816)
        expect(w * h, `${s} ${v}`).toBeLessThanOrEqual(5_000_000)
      }
    }
  })
  it('ohne Format gilt das Verhältnis der gpt-Größe', () => {
    const [w, h] = lokaleGroesse(null, '1024x1024').split('x').map(Number)
    expect(w).toBe(h)
  })
  it('SDXL bleibt bei 1 MP, auch auf Maximal', () => {
    const [w, h] = lokaleGroesse('square_1_1', '1024x1024', 'maximal', 'lokal:sdxl_instantid').split('x').map(Number)
    expect(w * h).toBeLessThanOrEqual(1_100_000)
  })
  it('Ersatz eines lokalen Modells ist wieder ein lokales', () => {
    expect(ersatzModell('lokal:sdxl_instantid', 2)).toBe('lokal:qwen21')
    expect(ersatzModell('gemini-3.1-flash-image', 1)).toBe('gpt-image-2.5-sunburst')
  })
})

describe('Krea 2 (lokal)', () => {
  it('nimmt keine Referenzbilder und wird bei Referenzen nicht angeboten', () => {
    expect(passtZuReferenzen('lokal:krea2', 0)).toBe(true)
    expect(passtZuReferenzen('lokal:krea2', 1)).toBe(false)
    expect(modelleFuer(0).some(m => m.id === 'lokal:krea2')).toBe(true)
    expect(modelleFuer(1).some(m => m.id === 'lokal:krea2')).toBe(false)
  })
  it('folgt den Auflösungsstufen und weicht bei Referenzen auf Qwen aus, nie auf den Proxy', () => {
    expect(hatStufen('lokal:krea2')).toBe(true)
    expect(ersatzModell('lokal:krea2', 2)).toBe('lokal:qwen21')
  })
  it('die Beschriftungen bleiben kurz', () => {
    for (const m of MODELLE.filter(x => istLokal(x.id))) {
      expect(m.label.length, m.id).toBeLessThanOrEqual(30)
      expect(m.note.length, m.id).toBeLessThanOrEqual(12)
    }
  })
})

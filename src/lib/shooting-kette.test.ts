import { describe, it, expect } from 'vitest'
import { baueShooting, KETTE_VORGABE, kettenAnsage } from './shooting-kette'
import { SHOOTING_SPOTS } from './shooting-spots'
import type { Scene } from './szene-prompt'
import type { Outfit } from '@/hooks/use-outfits'

/**
 * Was diese Kette von vier Einzelbildern unterscheidet, ist ZUSAMMENHANG —
 * und der geht lautlos verloren. Vier Aufträge laufen einzeln; das Modell
 * sieht sie nie nebeneinander. Fällt der Kontinuitätsblock aus einem Prompt,
 * merkt man es erst an den fertigen Bildern, und dann sind sie bezahlt.
 */
const OUTFIT_A = { id: 'a', name: 'Leinenkleid', cover_image_url: 'https://x/a.jpg' } as unknown as Outfit
const OUTFIT_B = { id: 'b', name: 'Lederjacke', cover_image_url: 'https://x/b.jpg' } as unknown as Outfit

const SZENE = {
  scene_type: 'outdoor', time_of_day: 'golden_hour', season: null, weather: null,
  light_source: null, light_style: null, light_modifiers: [],
  shot_type: 'portrait', camera_angle: null, lens: null, depth_of_field: null,
  aspect_ratio: null, character: null, outfit: OUTFIT_A, location: null,
  pose: null, expression: null, camera: null, style: null, grading: null,
  background: null, ground: null, wind: null,
} as unknown as Scene

describe('baueShooting', () => {
  it('liefert vier Plaetze plus Uebergang', () => {
    const k = baueShooting(SZENE)
    expect(k).toHaveLength(5)
    expect(k.map(s => s.key)).toEqual(['weit', 'tiefe', 'uebergang', 'flaeche', 'gegenlicht'])
  })

  it('laesst den Uebergang weg, wenn er abgewaehlt ist', () => {
    const k = baueShooting(SZENE, { ...KETTE_VORGABE, mitUebergang: false })
    expect(k).toHaveLength(4)
    expect(k.map(s => s.key)).not.toContain('uebergang')
    // Und die Zaehlung muss mitgehen, sonst steht „Bild 4 von 5" auf dem letzten.
    expect(k.at(-1)!.nr).toBe(4)
    expect(k.at(-1)!.gesamt).toBe(4)
  })

  it('gibt jedem Schritt eine andere Einstellungsgroesse', () => {
    // Vier gleiche Groessen waeren vier Versuche statt einer Serie.
    const k = baueShooting(SZENE)
    expect(new Set(k.map(s => s.shot_type)).size).toBe(5)
  })

  it('gibt jedem Schritt eine andere Haltung', () => {
    const k = baueShooting(SZENE)
    const posen = k.map(s => s.prompt.split('POSE\n')[1]?.split('\n')[0])
    expect(new Set(posen).size).toBe(5)
  })

  it('nummeriert durchgehend und nennt in JEDEM Prompt die Gesamtzahl', () => {
    const k = baueShooting(SZENE)
    k.forEach((s, i) => {
      expect(s.nr).toBe(i + 1)
      expect(s.gesamt).toBe(5)
      expect(s.prompt).toContain(`picture ${i + 1} of 5`)
    })
  })

  it('haelt die Kontinuitaet in jedem einzelnen Prompt fest', () => {
    // Die Auftraege laufen getrennt — steht es nicht in JEDEM, gilt es nicht.
    for (const s of baueShooting(SZENE)) {
      expect(s.prompt).toContain('ONE photo shoot')
      expect(s.prompt).toMatch(/Same person, same day/)
    }
  })

  it('setzt je Schritt den Baustein seines eigenen Platzes ein', () => {
    for (const s of baueShooting(SZENE)) {
      if (s.key === 'uebergang') continue
      const eigener = SHOOTING_SPOTS.find(sp => sp.key === s.key)!
      expect(s.prompt).toContain(eigener.baustein)
      for (const anderer of SHOOTING_SPOTS) {
        if (anderer.key !== s.key) expect(s.prompt).not.toContain(anderer.baustein)
      }
    }
  })
})

describe('Outfitwechsel', () => {
  it('bleibt ohne zweites Outfit durchgehend beim ersten', () => {
    const k = baueShooting(SZENE)
    expect(k.every(s => s.outfit === OUTFIT_A)).toBe(true)
    expect(k.every(s => s.prompt.includes('outfit stays exactly the same'))).toBe(true)
  })

  it('wechselt erst NACH dem Uebergang, nicht schon waehrend', () => {
    // Der Uebergang ist der Weg dorthin — er traegt noch das erste Outfit.
    const k = baueShooting(SZENE, { ...KETTE_VORGABE, zweitesOutfit: OUTFIT_B })
    expect(k.map(s => s.outfit)).toEqual([OUTFIT_A, OUTFIT_A, OUTFIT_A, OUTFIT_B, OUTFIT_B])
  })

  it('sagt genau den gewechselten Schritten, dass gewechselt wurde', () => {
    const k = baueShooting(SZENE, { ...KETTE_VORGABE, zweitesOutfit: OUTFIT_B })
    const gewechselt = k.filter(s => s.prompt.includes('outfit changes here'))
    expect(gewechselt.map(s => s.key)).toEqual(['flaeche', 'gegenlicht'])
  })

  it('wechselt auch ohne Uebergang zur richtigen Haelfte', () => {
    const k = baueShooting(SZENE, { mitUebergang: false, zweitesOutfit: OUTFIT_B, gruppe: null })
    expect(k.map(s => s.outfit)).toEqual([OUTFIT_A, OUTFIT_A, OUTFIT_B, OUTFIT_B])
  })
})

describe('kettenAnsage', () => {
  it('nennt die Zahl mit Einheit', () => {
    expect(kettenAnsage(5)).toContain('5 Bilder')
    expect(kettenAnsage(1)).toContain('Ein Bild')
  })
})

describe('baueShooting fuer Gruppen (PROJ-84)', () => {
  const GRUPPE = { ...KETTE_VORGABE, gruppe: 3 }

  it('ersetzt die Haltung durch die Konstellation — nicht zusaetzlich', () => {
    // Beides nebeneinander hiesse „alle drei stehen mit dem Gewicht auf einem
    // Bein" UND „jeder steht anders". Zwei gegenlaeufige Anweisungen im
    // selben Prompt, und die Konstellation verloere.
    for (const s of baueShooting(SZENE, GRUPPE)) {
      expect(s.prompt).toContain('GROUP OF THREE — CONSTELLATION')
      expect(s.prompt).not.toContain('The subject is ')
    }
  })

  it('gibt an JEDEM Platz jeder Person eine eigene Zeile', () => {
    // Die Auftraege laufen einzeln. Was ueberall gelten soll, muss ueberall
    // dastehen — ein einziger Platz ohne Konstellation faellt erst am
    // fertigen, bezahlten Bild auf.
    for (const s of baueShooting(SZENE, GRUPPE)) {
      expect(s.prompt).toContain('PERSON 1 (leftmost)')
      expect(s.prompt).toContain('PERSON 3 (rightmost)')
      expect(s.prompt).toContain('three faces, three bodies')
    }
  })

  it('spricht in der Kontinuitaet von mehreren Menschen', () => {
    for (const s of baueShooting(SZENE, GRUPPE)) {
      expect(s.prompt).toContain('The same three people')
      expect(s.prompt).not.toContain('Same person, same day')
    }
  })

  it('zieht eine Gruppe NICHT um, auch wenn ein zweites Outfit gesetzt ist', () => {
    // Ein zweites Outfit ist EIN Kleidungsstueck. Es wuerde allen dasselbe
    // anziehen und genau die Zuordnung zerstoeren, fuer die das Blatt gebaut
    // wurde. Der Knopf blendet die Auswahl aus; hier darf sie auch dann nicht
    // durchkommen, wenn ein Aufrufer sie doch setzt.
    const k = baueShooting(SZENE, { ...GRUPPE, zweitesOutfit: OUTFIT_B })
    expect(k.map(s => s.outfit)).toEqual([OUTFIT_A, OUTFIT_A, OUTFIT_A, OUTFIT_A, OUTFIT_A])
    for (const s of k) {
      expect(s.prompt).not.toContain('after the wardrobe change')
      expect(s.prompt).toContain('the clothes they wear on the group sheet')
    }
  })

  it('laesst den Einzelweg unveraendert', () => {
    // Die Gruppenkette ist ein Zweig, kein Umbau. Waere der Einzelweg
    // mitgewandert, faende Mark es an seinen bisherigen Shootings.
    for (const s of baueShooting(SZENE)) {
      expect(s.prompt).toContain('POSE')
      expect(s.prompt).toContain('The subject is ')
      expect(s.prompt).not.toContain('CONSTELLATION')
      expect(s.prompt).toContain('Same person, same day')
    }
  })
  it('nennt die Anzahl GANZ VORN, vor dem Basisprompt', () => {
    /*
      Bis zum Konstellationsblock sind acht bis zehn Saetze durchgelaufen, die
      alle in der Einzahl sprechen — „the subject", „character reference". Die
      ersten Zeilen bestimmen die Gesamtkomposition am staerksten, und die
      Personenzahl ist die fragilste Eigenschaft ueberhaupt.
    */
    for (const s of baueShooting(SZENE, GRUPPE)) {
      expect(s.prompt.startsWith('A GROUP PHOTOGRAPH OF 3 PEOPLE')).toBe(true)
    }
  })

  it('laesst Outfit, Pose und Ausdruck der Szene NICHT in den Basisprompt', () => {
    /*
      DREI LECKS, DIE AN DER KONSTELLATION VORBEILIEFEN.

      `buildPrompt` weiss nichts von Gruppen und schreibt aus der Szene heraus
      Saetze, die bei einem Menschen richtig sind — und sie stehen VOR dem
      Konstellationsblock, also an der staerkeren Stelle:

        „Use the provided outfit reference."  — das Bild dazu geht bei Gruppen
        gar nicht mit; das Modell suchte sich das gemeinte unter dem, was da
        ist, und da ist nur das Gruppenblatt.
        „The character is in a X pose."       — eine Einzelpose fuer alle, kurz
        und konkret, und damit leichter zu befolgen als fuenf ausformulierte
        Haltungen. Das Klassenfoto.
    */
    const mitAllem = {
      ...SZENE,
      pose: { id: 'p', name: 'Contrapposto', description: null },
      expression: { id: 'e', name: 'Smiling', description: null },
    } as unknown as Scene

    for (const s of baueShooting(mitAllem, GRUPPE)) {
      expect(s.prompt).not.toContain('Use the provided outfit reference')
      expect(s.prompt).not.toContain('Contrapposto')
      expect(s.prompt).not.toContain('Smiling')
    }

    // Beim Einzelweg bleiben alle drei drin — sie sind dort richtig.
    const einzeln = baueShooting(mitAllem)[0].prompt
    expect(einzeln).toContain('Use the provided outfit reference')
    expect(einzeln).toContain('Contrapposto')
  })

  it('nimmt fuer die Gruppe an der Flaeche eine groessere Einstellung', () => {
    /*
      „portrait framing from chest up" und „Person 1 sitzt am Boden" schliessen
      einander aus. Es gibt keinen Ausschnitt, der beides erfuellt — entweder
      fehlen Personen in einem Bild, das drei verlangt, oder die bestellte
      Groesse stimmt nicht.
    */
    const gruppe = baueShooting(SZENE, GRUPPE)
    const einzeln = baueShooting(SZENE)
    expect(einzeln.find(s => s.key === 'flaeche')!.shot_type).toBe('portrait')
    expect(gruppe.find(s => s.key === 'flaeche')!.shot_type).toBe('three_quarter')
    expect(gruppe.find(s => s.key === 'uebergang')!.shot_type).toBe('full_body')
    // Die uebrigen bleiben, wie sie sind.
    expect(gruppe.find(s => s.key === 'weit')!.shot_type).toBe('wide_shot')
  })

  it('nimmt bei zwei Personen an der Flaeche die kleinere der beiden', () => {
    const k = baueShooting(SZENE, { ...KETTE_VORGABE, gruppe: 2 })
    expect(k.find(s => s.key === 'flaeche')!.shot_type).toBe('half_body')
  })
  it('spricht im GANZEN Prompt in der Mehrzahl', () => {
    /*
      ZWEI EINZAHL-RESTE STANDEN NOCH VOR DER KONSTELLATION, also an der
      staerkeren Stelle: „Use the provided CHARACTER reference." und in den
      Ortsbausteinen „behind THE STANDING POSITION". Ein Charakter, ein Punkt —
      und danach fuenf Leute. Aufgefallen erst beim Lesen des fertigen Prompts,
      nicht beim Schreiben der Bausteine.
    */
    /*
      MIT CHARAKTER IN DER SZENE — sonst prueft die zweite Zeile nichts.

      `SZENE` hat `character: null`, und dann erzeugt `buildPrompt` den Satz
      „Use the provided character reference." gar nicht erst. Ein Rueckschritt
      (das `character: null` aus dem Basisaufbau entfernen) blieb genau deshalb
      unbemerkt: Der Test war gruen, weil die Szene leer war, nicht weil der
      Code richtig war. Aufgefallen beim Rueckschritt-Test, nicht beim
      Schreiben.
    */
    const alsGruppe = {
      ...SZENE, character: { id: 'g', name: 'A + B + C', tags: ['gruppe'] },
    } as unknown as Scene

    for (const s of baueShooting(alsGruppe, GRUPPE)) {
      expect(s.prompt).not.toContain('standing position')
      expect(s.prompt).not.toContain('character reference')
      expect(s.prompt).toContain('group sheet')
    }

    // Beim Einzelweg bleiben beide stehen — dort sind sie richtig.
    // `SZENE` hat bewusst keinen Charakter, deshalb hier einer dazu: sonst
    // pruefte die zweite Zeile nur, dass ein leeres Feld nichts erzeugt.
    const mitMensch = { ...SZENE, character: { id: 'c', name: 'Anna' } } as unknown as Scene
    const einzeln = baueShooting(mitMensch)
    expect(einzeln.some(s => s.prompt.includes('standing position'))).toBe(true)
    expect(einzeln[0].prompt).toContain('character reference')
  })
})

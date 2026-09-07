import { describe, it, expect } from 'vitest'
import {
  istGruppe, gruppenGroesse, gruppenKonstellation, gruppenKontinuitaet,
  gruppenAnsage, gruppenBlattZuordnung, gruppenGroesseJePlatz,
  GRUPPEN_VORRANG, HALTUNGEN, GRUPPE_HALTUNGEN_MAX, bausteinFuerGruppe,
  reihenfolgeFuer, AUFSTELLUNGEN,
} from './gruppen-shooting'
import type { Character } from '@/hooks/use-characters'

function charakter(p: Partial<Character> = {}): Character {
  return {
    id: 'c1', user_id: 'u1', name: 'Anna + Ben', description: null,
    tags: ['gruppe'], cover_image_url: null, source_url: null,
    source_title: null, metadata: {}, created_at: '', updated_at: '',
    ...p,
  } as Character
}

const PLAETZE = ['weit', 'tiefe', 'flaeche', 'gegenlicht', 'uebergang'] as const

describe('istGruppe', () => {
  it('erkennt eine Gruppe am Schlagwort', () => {
    expect(istGruppe(charakter())).toBe(true)
  })

  it('haelt einen gewoehnlichen Charakter nicht fuer eine Gruppe', () => {
    expect(istGruppe(charakter({ tags: ['mann', 'blond'] }))).toBe(false)
    expect(istGruppe(charakter({ tags: [] }))).toBe(false)
  })

  it('kommt ohne Charakter und ohne Schlagwortliste zurecht', () => {
    // Aus der Datenbank kam `tags` schon als null zurueck. Ein Zugriff darauf
    // wuerfe mitten im Aufbau der Kette.
    expect(istGruppe(null)).toBe(false)
    expect(istGruppe(undefined)).toBe(false)
    expect(istGruppe(charakter({ tags: null as unknown as string[] }))).toBe(false)
  })
})

describe('gruppenGroesse', () => {
  it('nimmt die gespeicherte Zahl', () => {
    expect(gruppenGroesse(charakter({ metadata: { gruppe: { anzahl: 5 } } }))).toBe(5)
  })

  it('zaehlt sonst die Namen — die Gruppen von vor PROJ-84', () => {
    // Genau der Fall, den Mark heute schon in der Hand hat: Blaetter mit
    // zwei, drei und fuenf Personen, keines davon mit gespeicherter Zahl.
    expect(gruppenGroesse(charakter({ name: 'Anna + Ben' }))).toBe(2)
    expect(gruppenGroesse(charakter({ name: 'Anna + Ben + Carla' }))).toBe(3)
    expect(gruppenGroesse(charakter({ name: 'A + B + C + D + E' }))).toBe(5)
  })

  it('gibt bei einem gewoehnlichen Charakter null', () => {
    expect(gruppenGroesse(charakter({ tags: ['mann'] }))).toBeNull()
  })

  it('gibt null, wenn sich nichts zaehlen laesst', () => {
    // Lieber ehrlich null als eine geratene Zahl: Die Kette faellt dann auf
    // den Einzelweg zurueck, statt vier Haltungen an drei Leute zu verteilen.
    expect(gruppenGroesse(charakter({ name: 'Die Band' }))).toBeNull()
    expect(gruppenGroesse(charakter({ name: '' }))).toBeNull()
  })

  it('weist unsinnige gespeicherte Zahlen ab und zaehlt stattdessen', () => {
    for (const anzahl of [1, 0, -3, 2.5, '5', null]) {
      expect(gruppenGroesse(charakter({
        name: 'Anna + Ben + Carla', metadata: { gruppe: { anzahl } },
      }))).toBe(3)
    }
  })

  it('deckelt bei fuenf — mehr Haltungen gibt es nicht', () => {
    /*
      OHNE DECKEL BRICHT GENAU DIE REGEL, DIE DIE DATEI TRAEGT.

      Ein Rest-Umlauf gaebe Person 6 wortgleich die Haltung von Person 1, und
      weil die Listen am Umbruch nicht mehr abwechseln, staenden zwei Nachbarn
      auf gleicher Hoehe. Ueber die Oberflaeche kann so ein Blatt gar nicht
      entstehen — die Zahl waere dann beschaedigt.
    */
    expect(gruppenGroesse(charakter({ metadata: { gruppe: { anzahl: 9 } } })))
      .toBe(GRUPPE_HALTUNGEN_MAX)
    expect(gruppenGroesse(charakter({ name: 'A + B + C + D + E + F + G' })))
      .toBe(GRUPPE_HALTUNGEN_MAX)
  })
})

describe('Haltungen', () => {
  it('haelt fuer jeden Platz so viele Haltungen wie die groesste Gruppe', () => {
    for (const key of PLAETZE) {
      expect(HALTUNGEN[key]).toHaveLength(GRUPPE_HALTUNGEN_MAX)
    }
  })

  it('setzt NIE zwei gleiche Hoehen nebeneinander', () => {
    // DIE EIGENTLICHE REGEL DIESER DATEI. Koepfe auf einer Hoehe sind der
    // Grund, warum Gruppenbilder wie eine Belegschaftsaufnahme aussehen.
    // Geprueft ueber die ganze Liste, damit es auch bei zwei Personen gilt:
    // jeder Anfang einer abwechselnden Liste wechselt selbst ab.
    for (const key of PLAETZE) {
      const hoehen = HALTUNGEN[key].map(h => h.hoehe)
      for (let i = 1; i < hoehen.length; i++) {
        expect(hoehen[i], `${key}, Person ${i + 1}`).not.toBe(hoehen[i - 1])
      }
    }
  })

  it('laesst an jedem Platz ausser dem Uebergang jemanden tief gehen', () => {
    // Marks „teils sitzend". Unterwegs geht das nicht — da laufen alle.
    for (const key of ['weit', 'tiefe', 'flaeche', 'gegenlicht'] as const) {
      expect(HALTUNGEN[key].slice(0, 2).map(h => h.hoehe)).toContain('tief')
    }
  })

  it('gibt jeder Haltung eine Aufgabe fuer die Haende', () => {
    /*
      FREIE HAENDE SIND BEI BILDMODELLEN DIE ZUVERLAESSIGSTE FEHLERQUELLE.

      Frueher stand dafuer ein allgemeiner Satz am Ende des Blocks. Der bindet
      schwaecher als die Personenzeile und musste Haltungen abdecken, in denen
      ueberhaupt keine Hand vorkam. Jetzt nennt jede Haltung ihre eigenen.
    */
    for (const key of PLAETZE) {
      for (const h of HALTUNGEN[key]) {
        expect(/hand|arm|forearm/.test(h.text), `${key}: ${h.text}`).toBe(true)
      }
    }
  })

  it('gibt keiner Person denselben Wortlaut wie einer anderen', () => {
    for (const key of PLAETZE) {
      const texte = HALTUNGEN[key].map(h => h.text)
      expect(new Set(texte).size).toBe(texte.length)
    }
  })
})

describe('gruppenKonstellation', () => {
  it('gibt jeder Person eine eigene Zeile mit ihrem Platz', () => {
    const t = gruppenKonstellation('flaeche', 3)
    expect(t).toContain('PERSON 1 (leftmost) is ')
    expect(t).toContain('PERSON 2 (2nd from the left) is ')
    expect(t).toContain('PERSON 3 (rightmost) is ')
    expect(t).not.toContain('PERSON 4')
  })

  it('gibt keinen zwei Personen dieselbe Haltung', () => {
    /*
      DIE LUECKE, DIE EINE UNABHAENGIGE PRUEFUNG GEFUNDEN HAT.

      Vorher pruefte kein Test, dass verschiedene Personen verschiedene
      Haltungen BEKOMMEN — nur, dass die Liste eindeutig ist. Ersetzt man in
      `gruppenKonstellation` das `pool[i]` durch `pool[0]`, blieben alle Tests
      gruen und das Ergebnis waere: fuenf Menschen, alle „standing upright,
      hands loose at the sides". Genau das Klassenfoto, gegen das der ganze
      Dateikopf argumentiert — und die Testsuite meldete Vollzug.
    */
    for (const key of PLAETZE) {
      for (const n of [2, 3, 4, 5]) {
        const zeilen = gruppenKonstellation(key, n)
          .split('\n')
          .filter(z => z.startsWith('PERSON '))
        expect(zeilen).toHaveLength(n)
        const haltungen = zeilen.map(z => z.replace(/^PERSON \d+ \([^)]+\) is /, ''))
        expect(new Set(haltungen).size, `${key} bei ${n}`).toBe(n)
      }
    }
  })

  it('benennt die Plaetze genau wie das Referenzblatt', () => {
    // Waeren es zwei aehnliche Formulierungen, waere es fuer ein Bildmodell
    // nicht dasselbe Wort — und der Faden zwischen Blatt und Shooting risse.
    const t = gruppenKonstellation('weit', 5)
    for (const platz of ['leftmost', '2nd from the left', '3rd from the left',
                         '4th from the left', 'rightmost']) {
      expect(t).toContain(`(${platz})`)
    }
  })

  it('nennt die Zahl ausgeschrieben und ohne Nachbarzahlen', () => {
    /*
      „Not four, not two. Count them." stand hier frueher.

      Ein Bildmodell zaehlt nicht, es zeichnet — und die Verneinung setzt genau
      die falschen Zahlwoerter neben das Wort „people", wo sie mitwirken statt
      ausgeschlossen zu werden. Jetzt wird die richtige Zahl dreimal positiv
      genannt, ausgeschrieben.
    */
    const t = gruppenKonstellation('weit', 3)
    expect(t).toContain('GROUP OF THREE')
    expect(t).toContain('three faces, three bodies')
    expect(t).not.toMatch(/not four|not two|Count them/i)
  })

  it('haelt die Links-rechts-Ordnung des Blattes fest', () => {
    // Der Angelpunkt: Ohne diesen Satz muesste das Modell in jedem Bild neu
    // raten, wer wer ist — der Fehler, den das Blatt abgeschafft hat.
    for (const key of PLAETZE) {
      const t = gruppenKonstellation(key, 4)
      expect(t).toContain('SAME ORDER as on the group sheet')
      expect(t).toContain('at the far left here')
    }
  })

  it('verlangt ueberall verschiedene Hoehen bei Nachbarn', () => {
    /*
      FRUEHER STAND HIER „NO TWO HEADS AT THE SAME HEIGHT", global.

      Bei vier oder fuenf Personen ist das unerfuellbar — es gibt nur drei
      Hoehenlagen. Eine Bedingung, die das Modell nicht erfuellen KANN,
      verwirft es ganz statt teilweise; die Zeile kostete dann auch dort, wo
      sie erfuellbar gewesen waere. Auf Nachbarn eingeschraenkt geht sie auf.
    */
    for (const key of PLAETZE) {
      const t = gruppenKonstellation(key, 5)
      expect(t).toContain('Two neighbours are never at the same height')
      expect(t).not.toContain('NO TWO HEADS AT THE SAME HEIGHT')
    }
  })

  it('wehrt in JEDEM Prompt das Blatt als Bildvorlage ab', () => {
    /*
      DAS MITGESCHICKTE REFERENZBILD IST EIN BLATT — zwei Reihen auf hellgrauem
      Studiogrund —, und der Text verweist auch noch darauf. Ohne diesen Absatz
      liefert das Modell den grauen Grund oder die Zweiteilung gleich mit.
      Die Einzelplatten haben denselben Schutz.
    */
    for (const key of PLAETZE) {
      const t = gruppenKonstellation(key, 3)
      expect(t).toContain('ONE PHOTOGRAPH TAKEN AT THIS LOCATION')
      expect(t).toContain('no studio backdrop')
    }
  })

  it('laesst die Umrisse ueberlappen — ausser im Gegenlicht', () => {
    /*
      DER WIDERSPRUCH, DER BEIM ERSTBAU DRINSTAND.

      „Ein Spalt Licht zwischen je zwei Personen" und „die Umrisse ueberlappen
      einander" sind zwei gegenlaeufige Anweisungen im selben Prompt. Aufgefallen
      erst beim Lesen des fertig zusammengesetzten Blocks, nicht beim Schreiben
      der einzelnen Zeilen — deshalb prueft dieser Test den Block als Ganzes.
    */
    for (const key of ['weit', 'tiefe', 'flaeche', 'uebergang'] as const) {
      expect(gruppenKonstellation(key, 3)).toContain('silhouettes overlap')
    }
    const gegen = gruppenKonstellation('gegenlicht', 3)
    expect(gegen).not.toContain('silhouettes overlap')
    expect(gegen).toContain('never touching and never overlapping')
    expect(gegen).toContain('A hand width of bright background')
  })

  it('staffelt die Tiefe DIAGONAL, nicht als Kolonne', () => {
    /*
      EINE KOLONNE ENTLANG DER FLUCHTLINIE STEHT NICHT MEHR LINKS NACH RECHTS.

      Damit waere die Zuordnung zum Blatt hin — Person 5 saesse hinten in der
      Bildmitte und hiesse trotzdem „rightmost". Zwei Ortsangaben fuer dieselbe
      Person im selben Prompt. Die Diagonale hat beides: Tiefe und Ordnung.
    */
    const t = gruppenKonstellation('tiefe', 4)
    expect(t).toContain('runs DIAGONALLY through the group')
    expect(t).toContain('the leftmost person nearest to the camera')
    expect(t).toContain('only the distance from the camera changes')
  })

  it('laesst die Gruppe unterwegs NICHT nebeneinander laufen', () => {
    // Fuenf im Gleichschritt sind das Filmplakat, nicht der Schnappschuss.
    const t = gruppenKonstellation('uebergang', 5)
    expect(t).toContain('NOT abreast')
    expect(t).toContain('different phase of the stride')
  })

  it('stellt zwei Leute anders an die Flaeche als vier', () => {
    const zwei = gruppenKonstellation('flaeche', 2)
    const vier = gruppenKonstellation('flaeche', 4)
    expect(zwei).toContain('shoulders overlapping')
    expect(zwei).not.toContain('Two ranks')
    expect(vier).toContain('Two ranks')
    // Nur die STEHENDE Reihe hat die Flaeche im Ruecken. Stuenden beide daran,
    // gaebe es keine Tiefe zwischen ihnen — und die vordere verdeckte die
    // hintere.
    expect(vier).toContain('the standing rank has the surface at their backs')
    expect(vier).toContain('every face stays visible')
  })

  it('macht aus drei an der Flaeche ein Dreieck', () => {
    const drei = gruppenKonstellation('flaeche', 3)
    expect(drei).toContain('A triangle against the surface')
    expect(drei).not.toContain('Two ranks')
  })

  it('haelt die Gruppe erst ab vier ausdruecklich zusammen', () => {
    expect(gruppenKonstellation('weit', 3)).not.toContain('less than a third')
    expect(gruppenKonstellation('weit', 4)).toContain('less than a third of the width')
  })

  it('malt in keinem Verbot ein Bild aus', () => {
    /*
      „Do not turn the group into a fence across the landscape" liefert dem
      Modell das Wort „fence" mit einem schwachen Nein davor — und „…or the
      group collapses into one black shape" liefert „black shape". Beide Saetze
      standen beim Erstbau drin. Was nicht im Bild sein soll, darf im Prompt
      nicht vorkommen.
    */
    for (const key of PLAETZE) {
      for (const n of [2, 5]) {
        const t = gruppenKonstellation(key, n)
        expect(t).not.toMatch(/fence|black shape|staff picture/i)
      }
    }
  })
})

describe('gruppenGroesseJePlatz', () => {
  it('nimmt an der Flaeche NIE die Portraet-Groesse', () => {
    /*
      DER TEURE FEHLER, DEN EINE UNABHAENGIGE PRUEFUNG GEFUNDEN HAT.

      Die Einzelkette nimmt an der Flaeche `portrait`, und das heisst im Prompt
      woertlich „portrait framing from chest up". Bei einer Gruppe sitzt Person 1
      am Boden. Es gibt KEINEN Ausschnitt, der beides erfuellt: Entweder fehlen
      zwei Personen in einem Bild, das ausdruecklich fuenf verlangt, oder die
      bestellte Einstellungsgroesse stimmt nicht. Beides faellt erst am
      bezahlten Ergebnis auf.
    */
    expect(gruppenGroesseJePlatz('flaeche', 2)).toBe('half_body')
    for (const n of [3, 4, 5]) {
      expect(gruppenGroesseJePlatz('flaeche', n)).toBe('three_quarter')
    }
  })

  it('gibt dem Uebergang die ganze Figur', () => {
    // Verschiedene Schrittphasen brauchen Beine und Fuesse.
    expect(gruppenGroesseJePlatz('uebergang', 3)).toBe('full_body')
  })

  it('laesst die uebrigen Plaetze bei ihrer Groesse', () => {
    for (const key of ['weit', 'tiefe', 'gegenlicht'] as const) {
      expect(gruppenGroesseJePlatz(key, 4)).toBeNull()
    }
  })
})

describe('gruppenBlattZuordnung', () => {
  it('erklaert das Blatt als Blatt, mit Zahl und Ordnung', () => {
    /*
      OHNE DIESE ZEILE STEHT IM PROMPT DIE STANDARDZEILE: „take the face, hair,
      skin tone and body identity of THIS PERSON" — Einzahl, fuer ein Bild mit
      bis zu fuenf Menschen in zwei Reihen. Genau der generische Wortlaut,
      gegen den PROJ-78 gebaut wurde.
    */
    const t = gruppenBlattZuordnung(4)
    expect(t).toContain('THE GROUP SHEET')
    expect(t).toContain('all four people')
    expect(t).toContain('from left to right')
    expect(t).toContain('is PERSON 1')
    expect(t).toContain('PERSON 4 at the far right')
    expect(t).toContain('A head belongs to the body beneath it')
  })
})

describe('GRUPPEN_VORRANG', () => {
  it('gibt dem Blatt WER und WAS, dem Text WO und WIE', () => {
    /*
      DER STANDARDSATZ KEHRT SICH HIER GEGEN DEN PROMPT.

      Er sagt: „Beschreibt der Text die Person anders, folge dem Referenzbild
      und ignoriere die widersprechenden Worte." Das Blatt zeigt die Leute
      aufrecht nebeneinander; der Text verlangt kauern und sitzen. Der
      Standardsatz wiese das Modell an, dem Blatt zu folgen — die ganze
      Konstellation waere ausgehebelt.
    */
    expect(GRUPPEN_VORRANG).toContain('WHO each person is and WHAT they wear')
    expect(GRUPPEN_VORRANG).toContain('never from the sheet')
    expect(GRUPPEN_VORRANG).not.toContain('ignore the conflicting words')
  })
})

describe('gruppenKontinuitaet', () => {
  it('spricht von mehreren Menschen, nicht von einem', () => {
    const t = gruppenKontinuitaet(2, 5, 3)
    expect(t).toContain('The same three people')
    expect(t).not.toContain('Same person')
  })

  it('bindet die Kleidung ans Blatt', () => {
    // Bei einer Gruppe kommt die Kleidung aus dem Referenzblatt. Ein
    // Outfit-Baustein zoege allen dasselbe Hemd an.
    expect(gruppenKontinuitaet(1, 5, 4))
      .toContain('the clothes they wear on the group sheet')
  })

  it('nennt Platz und Gesamtzahl der Reihe', () => {
    expect(gruppenKontinuitaet(3, 5, 2)).toContain('picture 3 of 5')
  })
})

describe('gruppenAnsage', () => {
  it('nennt die Zahl', () => {
    expect(gruppenAnsage(5)).toContain('5 Personen')
  })
})

describe('bausteinFuerGruppe', () => {
  it('setzt den Ortsbaustein in die Mehrzahl', () => {
    /*
      DIE BAUSTEINE SIND FUER EINEN MENSCHEN GESCHRIEBEN — und sie stehen im
      Prompt VOR der Konstellation, also an der staerkeren Stelle. „Das Licht
      kommt von hinter DEM STANDPUNKT" ist ein Punkt, an dem einer steht; zwei
      Zeilen spaeter stehen fuenf Leute, teils sitzend.
    */
    expect(bausteinFuerGruppe('light from behind the standing position:'))
      .toBe('light from behind the group:')
    // Am Satzanfang bleibt die Grossschreibung.
    expect(bausteinFuerGruppe('The standing position sits at the near end.'))
      .toBe('The group sits at the near end.')
  })

  it('laesst alles andere unangetastet', () => {
    const unberuehrt = 'A wide view in which the location itself is the subject.'
    expect(bausteinFuerGruppe(unberuehrt)).toBe(unberuehrt)
  })
})

describe('Aufstellung — wer an welchem Platz steht', () => {
  /*
    MARKS BEFUND vom 07.09.2026: „Da sollte man die Reihenfolge auf jeden Fall
    aendern koennen. Optisch gesehen anhand der Bilder, die ist immer gleich von
    links nach rechts."
  */

  it('laesst bei „wie auf dem Blatt" alles, wie es war', () => {
    for (const nr of [1, 2, 3, 4, 5]) {
      expect(reihenfolgeFuer('wie_blatt', 3, nr)).toEqual([1, 2, 3])
    }
  })

  it('stellt bei „wechselnd" jedes Bild anders auf', () => {
    const bilder = [1, 2, 3, 4, 5].map(nr => reihenfolgeFuer('wechselnd', 3, nr).join(''))
    // Drei Personen ergeben drei Aufstellungen; ueber fuenf Bilder wiederholt
    // sich das, aber nie zweimal hintereinander.
    for (let i = 1; i < bilder.length; i++) {
      expect(bilder[i], `Bild ${i + 1}`).not.toBe(bilder[i - 1])
    }
  })

  it('benutzt jede Person genau einmal', () => {
    // Eine Verschiebung, die jemanden verliert oder verdoppelt, faellt sonst
    // erst am Bild auf — und dort sieht sie aus wie ein Modellfehler.
    for (const n of [2, 3, 4, 5]) {
      for (const nr of [1, 2, 3, 4, 5]) {
        const r = reihenfolgeFuer('wechselnd', n, nr)
        expect(r).toHaveLength(n)
        expect([...r].sort()).toEqual(Array.from({ length: n }, (_, i) => i + 1))
      }
    }
  })

  it('schreibt die Person an ihren Platz, die Haltung bleibt am Platz', () => {
    /*
      DER PUNKT, AN DEM EIN NAHELIEGENDER EINFALL SCHEITERT.

      Die Haltungen einfach durchzurotieren geht NICHT: Manche sind ortsgebunden
      — „nearest to the camera and largest" gehoert zum linken Platz an der
      Fluchtlinie, nicht zu Person 1. Wandert sie mit der Person, widerspricht
      sie der Formation. Also wandern die Personen, nicht die Haltungen.
    */
    const t = gruppenKonstellation('tiefe', 3, [2, 3, 1])
    expect(t).toContain('PERSON 2 (leftmost) is nearest to the camera and largest')
    expect(t).toContain('PERSON 3 (2nd from the left)')
    expect(t).toContain('PERSON 1 (rightmost)')
  })

  it('nimmt die Ordnungszeile zurueck, wenn die Gruppe anders steht', () => {
    /*
      „Left to right they stand in the SAME ORDER as on the group sheet" waere
      dann eine Luege — und zwar die schaedlichste Sorte, weil dieser Satz der
      einzige Anker der Zuordnung ist. Steht die Gruppe anders, muss JEDE Zeile
      selbst sagen, wer wo steht.
    */
    const anders = gruppenKonstellation('weit', 3, [2, 3, 1])
    expect(anders).not.toContain('SAME ORDER as on the group sheet')
    expect(anders).toContain('They do NOT stand in the order of the group sheet')

    const wieBlatt = gruppenKonstellation('weit', 3, [1, 2, 3])
    expect(wieBlatt).toContain('SAME ORDER as on the group sheet')
    expect(wieBlatt).not.toContain('They do NOT stand')
  })

it('behauptet bei „wechselnd" nirgends mehr die Blattordnung', () => {
    /*
      „Left to right STAYS left to right" hatte im Prompt keinen anderen Bezug
      als das Blatt — und stand bei „wechselnd" zwei Zeilen unter „They do NOT
      stand in the order of the group sheet". Dasselbe gegenlaeufige Paar wie
      frueher bei „ueberlappen" gegen „Spalt Licht", nur an anderer Stelle.
    */
    for (const key of PLAETZE) {
      const t = gruppenKonstellation(key, 3, [2, 3, 1])
      expect(t).not.toContain('stays left to right')
    }
  })

  it('bietet genau zwei Aufstellungen an', () => {
    expect(AUFSTELLUNGEN.map(a => a.id)).toEqual(['wie_blatt', 'wechselnd'])
    expect(AUFSTELLUNGEN.every(a => a.label && a.hinweis)).toBe(true)
  })
})

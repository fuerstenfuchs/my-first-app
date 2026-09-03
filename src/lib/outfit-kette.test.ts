import { describe, it, expect } from 'vitest'
import {
  OUTFIT_KETTEN_SCHRITTE, OUTFIT_VARIANTEN_NAME, FORMULAR_SLOTS,
  kollidiertMitFormularSlot, quellenFuer, referenzAnsage, outfitKettenPrompt,
  istEigenerSpeicher, naechsterSchritt, offeneSchritte,
  type OutfitSchritt,
} from './outfit-kette'
import {
  OUTFIT_VORNE_PROMPT, OUTFIT_RUECKSEITE_PROMPT,
  OUTFIT_DETAILS_PROMPT, OUTFIT_REFERENZSHEET_PROMPT,
} from './outfit-kette-prompts'

const EIGEN = 'https://gsfrbxdesarlhfijmguu.supabase.co'

function vorhanden(...da: OutfitSchritt[]): Record<OutfitSchritt, boolean> {
  return {
    vorne:         da.includes('vorne'),
    rueckseite:    da.includes('rueckseite'),
    details:       da.includes('details'),
    referenzsheet: da.includes('referenzsheet'),
  }
}

describe('Reihenfolge und Namen', () => {
  it('läuft Vorne → Rückseite → Detailaufnahmen → Referenzsheet', () => {
    expect(OUTFIT_KETTEN_SCHRITTE).toEqual([
      'vorne', 'rueckseite', 'details', 'referenzsheet',
    ])
  })

  // Ein Tippfehler hier legt bei jedem Lauf eine ZWEITE Variante an, statt die
  // vorhandene zu benutzen — und das fiele erst am dritten Outfit auf.
  it('benennt die Varianten genau wie vereinbart', () => {
    expect(OUTFIT_VARIANTEN_NAME).toEqual({
      vorne:         'Vorne freigestellt',
      rueckseite:    'Rückseite',
      details:       'Detailaufnahmen',
      referenzsheet: 'Referenzsheet',
    })
  })
})

/**
 * DER WÄCHTER, um den es in PROJ-54 vor allem geht.
 *
 * Das Outfit-Formular legt beim Anlegen die Varianten „Vorne", „Seite",
 * „Hinten" und „Detail" an — Marks eigene Fotos. Trüge ein Kettenergebnis
 * denselben Namen, hielte `standErmitteln()` ein von Hand hochgeladenes Foto
 * für ein erzeugtes Blatt und überspränge den Schritt stillschweigend. Genau
 * dieser Fehler trat am 03.09.2026 zweimal auf (PROJ-50 „Kopf", PROJ-48
 * Ausgangsfoto).
 *
 * Verglichen wird getrimmt und ohne Groß-/Kleinschreibung — GENAU SO sucht
 * `varianteHolen` im Hook eine vorhandene Variante. Ein Test, der schärfer
 * vergleicht als der Betrieb, prüft eine andere Frage als die gestellte.
 */
describe('Kettennamen kollidieren mit keinem Formular-Slot', () => {
  it('kein Kettenname ist ein Formular-Slot', () => {
    for (const name of Object.values(OUTFIT_VARIANTEN_NAME)) {
      expect(
        kollidiertMitFormularSlot(name),
        `„${name}" fällt mit einem Slot des Outfit-Formulars zusammen`,
      ).toBe(false)
    }
  })

  // Ausdrücklich Paar für Paar, damit der Fehlerfall benennt, WELCHE zwei
  // Namen sich in die Quere kommen — „irgendwo kollidiert etwas" hilft beim
  // Suchen nicht.
  it('jedes Paar einzeln nachgemessen', () => {
    const slots = FORMULAR_SLOTS.map(s => s.label.trim().toLowerCase())
    for (const [schritt, name] of Object.entries(OUTFIT_VARIANTEN_NAME)) {
      expect(slots, `Schritt „${schritt}"`).not.toContain(name.trim().toLowerCase())
    }
  })

  // Gegenprobe in die andere Richtung: Der Wächter muss auch anschlagen. Ein
  // Wächter, der nie rot wird, ist keiner.
  it('schlägt an, wenn ein Name doch ein Slot wäre', () => {
    expect(kollidiertMitFormularSlot('Vorne')).toBe(true)
    expect(kollidiertMitFormularSlot('  hinten ')).toBe(true)
    expect(kollidiertMitFormularSlot('DETAIL')).toBe(true)
  })

  it('die vier Formular-Slots stehen unverändert', () => {
    expect(FORMULAR_SLOTS.map(s => s.label)).toEqual(['Vorne', 'Seite', 'Hinten', 'Detail'])
  })
})

describe('Referenzquellen je Schritt', () => {
  it('das erste Blatt baut auf dem Titelbild auf', () => {
    expect(quellenFuer('vorne')).toEqual([{ bild: 'titelbild', rolle: 'titelbild' }])
  })

  // Beide hängen am freigestellten Vorne-Blatt — NICHT aneinander und nicht am
  // Titelbild. Das Titelbild noch einmal mitzugeben hieße, dem Modell die
  // Person wieder anzubieten, die man gerade losgeworden ist.
  it('Rückseite und Details bauen beide nur auf dem Vorne-Blatt auf', () => {
    expect(quellenFuer('rueckseite')).toEqual([{ bild: 'vorne', rolle: 'vorderansicht' }])
    expect(quellenFuer('details')).toEqual([{ bild: 'vorne', rolle: 'vorderansicht' }])
  })

  it('das Referenzsheet bekommt alle drei davor, in Kettenreihenfolge', () => {
    expect(quellenFuer('referenzsheet')).toEqual([
      { bild: 'vorne',      rolle: 'vorderansicht' },
      { bild: 'rueckseite', rolle: 'rueckansicht' },
      { bild: 'details',    rolle: 'detailblatt' },
    ])
  })

  // Nach dem ersten Schritt darf das Titelbild NIRGENDS mehr auftauchen.
  it('nach dem ersten Schritt wird das Titelbild nicht mehr benutzt', () => {
    for (const schritt of OUTFIT_KETTEN_SCHRITTE.slice(1)) {
      expect(quellenFuer(schritt).map(q => q.bild)).not.toContain('titelbild')
    }
  })

  // Kein Schritt darf sich selbst oder ein späteres Blatt als Vorlage nennen —
  // das wäre eine Kette, die nie anlaufen kann.
  it('jeder Schritt greift nur auf FRÜHERE Blätter zurück', () => {
    OUTFIT_KETTEN_SCHRITTE.forEach((schritt, i) => {
      const erlaubt: string[] = ['titelbild', ...OUTFIT_KETTEN_SCHRITTE.slice(0, i)]
      for (const q of quellenFuer(schritt)) {
        expect(erlaubt, `Schritt „${schritt}" greift auf „${q.bild}" zurück`).toContain(q.bild)
      }
    })
  })
})

describe('Die Zuordnungsansage', () => {
  it('nennt so viele Bilder wie der Schritt Quellen hat', () => {
    for (const schritt of OUTFIT_KETTEN_SCHRITTE) {
      const ansage = referenzAnsage(schritt)!
      const zeilen = ansage.split('\n').filter(z => /^Image \d+ =/.test(z))
      expect(zeilen.length, `Schritt „${schritt}"`).toBe(quellenFuer(schritt).length)
    }
  })

  it('nummeriert die Bilder in der Reihenfolge, in der sie mitgeschickt werden', () => {
    const ansage = referenzAnsage('referenzsheet')!
    expect(ansage).toContain('Image 1 = FRONT VIEW')
    expect(ansage).toContain('Image 2 = BACK VIEW')
    expect(ansage).toContain('Image 3 = DETAIL SHEET')
  })

  // Das Titelbild eines Outfits zeigt fast immer einen Menschen. Ohne diesen
  // Satz malt das Modell ihn mit — das ist der Normalfall, nicht die Ausnahme.
  it('sagt beim Titelbild ausdrücklich, dass die Person nicht mitkommt', () => {
    const ansage = referenzAnsage('vorne')!
    expect(ansage).toContain('NOT part of the task')
  })
})

describe('Der zusammengesetzte Prompt', () => {
  const BASIS: Record<OutfitSchritt, string> = {
    vorne:         OUTFIT_VORNE_PROMPT,
    rueckseite:    OUTFIT_RUECKSEITE_PROMPT,
    details:       OUTFIT_DETAILS_PROMPT,
    referenzsheet: OUTFIT_REFERENZSHEET_PROMPT,
  }

  // Der Blatt-Prompt bleibt UNANGETASTET. An jedem Wort darin hängt eine
  // Erfahrung; angehängt wird nur die Zuordnung.
  it('lässt den Blatt-Prompt Wort für Wort stehen', () => {
    for (const schritt of OUTFIT_KETTEN_SCHRITTE) {
      expect(outfitKettenPrompt(schritt, BASIS[schritt]).startsWith(BASIS[schritt])).toBe(true)
    }
  })

  it('hängt die Zuordnung hinten an', () => {
    const p = outfitKettenPrompt('rueckseite', BASIS.rueckseite)
    expect(p).toContain('REFERENCE IMAGES — they arrive in this exact order:')
  })

  // Der Grund, warum es diese Kette überhaupt gibt: „ein Referenzbild … nur
  // mit der Kleidung ohne einen Menschen praktisch."
  it('jeder der vier Prompts verbietet die Person ausdrücklich', () => {
    for (const schritt of OUTFIT_KETTEN_SCHRITTE) {
      expect(outfitKettenPrompt(schritt, BASIS[schritt]), `Schritt „${schritt}"`)
        .toContain('NO PERSON')
    }
  })
})

describe('Eigener Speicher', () => {
  it('nimmt eine öffentliche Adresse des eigenen Projekts an', () => {
    expect(istEigenerSpeicher(`${EIGEN}/storage/v1/object/public/outfit-images/x.png`, EIGEN)).toBe(true)
  })

  it('lehnt fremde Adressen ab — der Arbeiter täte es auch, nur später', () => {
    expect(istEigenerSpeicher('https://example.com/bild.png', EIGEN)).toBe(false)
    expect(istEigenerSpeicher(null, EIGEN)).toBe(false)
    expect(istEigenerSpeicher(undefined, EIGEN)).toBe(false)
    expect(istEigenerSpeicher(`${EIGEN}/storage/v1/object/public/x.png`, undefined)).toBe(false)
  })
})

describe('Wiederaufnehmen', () => {
  it('beginnt bei leerem Stand vorne', () => {
    expect(naechsterSchritt(vorhanden())).toBe('vorne')
    expect(offeneSchritte(vorhanden())).toEqual(OUTFIT_KETTEN_SCHRITTE)
  })

  it('macht dort weiter, wo es stehengeblieben ist', () => {
    expect(naechsterSchritt(vorhanden('vorne'))).toBe('rueckseite')
    expect(offeneSchritte(vorhanden('vorne', 'rueckseite')))
      .toEqual(['details', 'referenzsheet'])
  })

  // Eine Lücke in der Mitte wird GEFÜLLT, nicht übersprungen — sonst fehlte
  // dem Referenzsheet für immer eine seiner drei Vorlagen.
  it('füllt eine Lücke in der Mitte', () => {
    expect(naechsterSchritt(vorhanden('vorne', 'details', 'referenzsheet'))).toBe('rueckseite')
    expect(offeneSchritte(vorhanden('vorne', 'referenzsheet'))).toEqual(['rueckseite', 'details'])
  })

  it('meldet null, wenn alle vier liegen', () => {
    expect(naechsterSchritt(vorhanden(...OUTFIT_KETTEN_SCHRITTE))).toBeNull()
    expect(offeneSchritte(vorhanden(...OUTFIT_KETTEN_SCHRITTE))).toEqual([])
  })
})

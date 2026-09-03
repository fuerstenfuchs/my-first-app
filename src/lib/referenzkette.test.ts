import { describe, it, expect } from 'vitest'
import {
  KETTEN_SCHRITTE, VARIANTEN_NAME, QUELLEN,
  referenzAnsage, kettenPrompt, istEigenerSpeicher,
  naechsterSchritt, offeneSchritte,
  type KettenSchritt,
} from './referenzkette'

const EIGEN = 'https://gsfrbxdesarlhfijmguu.supabase.co'

function vorhanden(...da: KettenSchritt[]): Record<KettenSchritt, boolean> {
  return {
    kopf:          da.includes('kopf'),
    koerper:       da.includes('koerper'),
    referenzsheet: da.includes('referenzsheet'),
  }
}

describe('Reihenfolge und Namen', () => {
  it('läuft Kopf → Körper → Referenzsheet', () => {
    expect(KETTEN_SCHRITTE).toEqual(['kopf', 'koerper', 'referenzsheet'])
  })

  // Marks Antwort 3 vom 03.09.2026 legt die Namen wörtlich fest. Ein Tippfehler
  // hier legt bei jedem Lauf eine ZWEITE Variante an, statt die vorhandene zu
  // benutzen — und das fiele erst nach dem dritten Charakter auf.
  it('benennt die Varianten genau wie vereinbart', () => {
    expect(VARIANTEN_NAME).toEqual({
      kopf: 'Kopf', koerper: 'Körper', referenzsheet: 'Referenzsheet',
    })
  })

  // Antwort 2: Schritt 2 bekommt NUR den erzeugten Kopf, nicht zusätzlich das
  // Original. Zwei Vorlagen desselben Gesichts sind für das Modell zwei
  // Gesichter.
  it('gibt dem Körper-Schritt nur den Kopf', () => {
    expect(QUELLEN.koerper).toEqual(['kopf'])
    expect(QUELLEN.koerper).not.toContain('titelbild')
  })

  it('gibt dem Referenzsheet Kopf UND Körper, in dieser Reihenfolge', () => {
    expect(QUELLEN.referenzsheet).toEqual(['kopf', 'koerper'])
  })
})

describe('Referenzansage', () => {
  it('nummeriert die Bilder in der Reihenfolge, in der sie mitgehen', () => {
    const text = referenzAnsage('referenzsheet')!
    expect(text).toContain('Image 1 = HEAD REFERENCE SHEET')
    expect(text).toContain('Image 2 = BODY REFERENCE SHEET')
    // Die Zuordnung muss auch die Reihenfolge im TEXT halten — sonst zeigt sie
    // auf das falsche Bild, und genau das ist am 01.09.2026 passiert.
    expect(text.indexOf('Image 1')).toBeLessThan(text.indexOf('Image 2'))
  })

  it('sagt auch bei einem einzigen Bild, wofür es steht', () => {
    expect(referenzAnsage('kopf')).toContain('Image 1 = ORIGINAL PHOTO')
  })

  it('lässt den Sheet-Prompt selbst unangetastet', () => {
    const basis = 'ORIGINALPROMPT BLEIBT SO'
    const fertig = kettenPrompt('koerper', basis)
    expect(fertig.startsWith(basis)).toBe(true)
    expect(fertig).toContain('Image 1 = HEAD REFERENCE SHEET')
  })
})

describe('Nur Bilder aus dem eigenen Speicher', () => {
  it('nimmt eine Adresse aus dem eigenen Speicher an', () => {
    expect(istEigenerSpeicher(
      `${EIGEN}/storage/v1/object/public/character-images/a/b.png`, EIGEN,
    )).toBe(true)
  })

  // Der Gegenbeweis: genau diese Adresse hat Marks Versuch am 03.09.2026
  // scheitern lassen, aber erst NACH dem Einreihen.
  it('lehnt eine fremde Adresse ab', () => {
    expect(istEigenerSpeicher(
      'https://scontent-dus1-1.xx.fbcdn.net/v/t39.30808-6/510969862.jpg', EIGEN,
    )).toBe(false)
  })

  it('lehnt einen anderen Pfad auf demselben Server ab', () => {
    // `/object/sign/` und `/object/authenticated/` sind nicht öffentlich —
    // der Arbeiter käme dort ohne Anmeldung nicht heran.
    expect(istEigenerSpeicher(`${EIGEN}/storage/v1/object/sign/x/y.png`, EIGEN)).toBe(false)
  })

  it('lehnt leer und unbekannt ab', () => {
    expect(istEigenerSpeicher(null, EIGEN)).toBe(false)
    expect(istEigenerSpeicher(`${EIGEN}/storage/v1/object/public/x.png`, undefined)).toBe(false)
  })
})

describe('Wiederaufnehmen', () => {
  it('fängt ohne Vorarbeit beim Kopf an', () => {
    expect(naechsterSchritt(vorhanden())).toBe('kopf')
    expect(offeneSchritte(vorhanden())).toEqual(['kopf', 'koerper', 'referenzsheet'])
  })

  it('macht nach vorhandenem Kopf beim Körper weiter', () => {
    expect(naechsterSchritt(vorhanden('kopf'))).toBe('koerper')
    expect(offeneSchritte(vorhanden('kopf'))).toEqual(['koerper', 'referenzsheet'])
  })

  it('macht nach Kopf und Körper beim Referenzsheet weiter', () => {
    expect(naechsterSchritt(vorhanden('kopf', 'koerper'))).toBe('referenzsheet')
  })

  it('meldet null, wenn alle drei liegen', () => {
    expect(naechsterSchritt(vorhanden('kopf', 'koerper', 'referenzsheet'))).toBeNull()
    expect(offeneSchritte(vorhanden('kopf', 'koerper', 'referenzsheet'))).toEqual([])
  })

  // Die Lücke in der Mitte: Wer das Referenzsheet einzeln erzeugt hat, dem
  // fehlt trotzdem der Körper — und dem Referenzsheet fehlte sonst für immer
  // seine Vorlage.
  it('füllt eine Lücke in der Mitte, nicht das Ende', () => {
    expect(naechsterSchritt(vorhanden('kopf', 'referenzsheet'))).toBe('koerper')
    expect(offeneSchritte(vorhanden('kopf', 'referenzsheet'))).toEqual(['koerper'])
  })
})

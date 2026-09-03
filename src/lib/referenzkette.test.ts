import { describe, it, expect } from 'vitest'
import {
  KETTEN_SCHRITTE, VARIANTEN_NAME, KOERPERFOTO_VARIANTE, KOPF_ORIGINAL_VARIANTE,
  quellenFuer, referenzAnsage, kettenPrompt, koerperMerkmaleText, istEigenerSpeicher,
  koerperbildKandidaten,
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

  it('das Körperfoto trägt einen eigenen Namen, keinen der drei Kettennamen', () => {
    expect(KOERPERFOTO_VARIANTE).toBe('Körper Original')
    expect(Object.values(VARIANTEN_NAME)).not.toContain(KOERPERFOTO_VARIANTE)
    // Der gefährliche Nachbar: „Körper Original" darf NIE als „Körper" gelten,
    // sonst hielte die Kette den Körper-Schritt für erledigt, sobald Mark ein
    // eigenes Ausgangsbild hochlädt — derselbe Fehler, den „Kopf Original"
    // vermeidet.
    expect(KOERPERFOTO_VARIANTE.trim().toLowerCase())
      .not.toBe(VARIANTEN_NAME.koerper.trim().toLowerCase())
  })

  // Mark am 03.09.2026: ein einzelnes Ausgangsfoto (aus der Erweiterung oder
  // dem Anlege-Formular) landete versehentlich in der Variante „Kopf" — die
  // Kette las das als „Kopf-Sheet schon erzeugt" und übersprang den echten
  // Schritt. „Kopf Original" ist dafür der eigene, unterscheidbare Name.
  it('das Original-Ausgangsfoto trägt einen eigenen Namen, keinen der drei Kettennamen', () => {
    expect(KOPF_ORIGINAL_VARIANTE).toBe('Kopf Original')
    expect(Object.values(VARIANTEN_NAME)).not.toContain(KOPF_ORIGINAL_VARIANTE)
    expect(KOPF_ORIGINAL_VARIANTE.trim().toLowerCase()).not.toBe(VARIANTEN_NAME.kopf.trim().toLowerCase())
  })
})

describe('Referenzquellen des Körper-Schritts — Mark am 03.09.2026', () => {
  // „Ich kann dazu bewusst auch ein Körperbild als Zweites mit dazuladen."
  it('nimmt Marks eigenes Körperfoto, wenn eines vorliegt', () => {
    const q = quellenFuer('koerper', { hatKoerperfoto: true })
    expect(q).toEqual([
      { bild: 'kopf', rolle: 'kopfsheet' },
      { bild: 'koerperfoto', rolle: 'koerperbauOriginal' },
    ])
  })

  // „ich als Ursprungsbild praktisch schon ein Ganzkörperbild habe … das wird
  // dann als Referenzbild für Kopf genommen. Und auch für Körper."
  it('fällt ohne Körperfoto auf das Originalfoto zurück', () => {
    const q = quellenFuer('koerper', { hatKoerperfoto: false })
    expect(q).toEqual([
      { bild: 'kopf', rolle: 'kopfsheet' },
      { bild: 'titelbild', rolle: 'koerperbauOriginal' },
    ])
  })

  it('gibt dem Referenzsheet Kopf UND das erzeugte Körper-Sheet, in dieser Reihenfolge', () => {
    expect(quellenFuer('referenzsheet', { hatKoerperfoto: false })).toEqual([
      { bild: 'kopf', rolle: 'kopfsheet' },
      { bild: 'koerper', rolle: 'koerperbauSheet' },
    ])
    // Ob ein Körperfoto vorliegt, ändert an Schritt 3 nichts — das betrifft
    // nur, WORAUS der Körper-Schritt selbst gebaut wurde.
    expect(quellenFuer('referenzsheet', { hatKoerperfoto: true }))
      .toEqual(quellenFuer('referenzsheet', { hatKoerperfoto: false }))
  })

  it('braucht für den Kopf nur das Originalfoto, unabhängig vom Körperfoto', () => {
    expect(quellenFuer('kopf', { hatKoerperfoto: true }))
      .toEqual([{ bild: 'titelbild', rolle: 'identitaet' }])
  })
})

describe('Vorhandene Bilder als Körperquelle — Mark am 03.09.2026', () => {
  const bild = (n: string) => `${EIGEN}/storage/v1/object/public/character-images/a/b/${n}.png`

  it('fasst je Variante zusammen und behält die Reihenfolge des Eingangs', () => {
    expect(koerperbildKandidaten([
      { url: bild('1'), label: 'Kopf' },
      { url: bild('2'), label: 'Sonstige' },
      { url: bild('3'), label: 'Sonstige' },
    ], EIGEN)).toEqual([
      { label: 'Kopf',     bilder: [bild('1')] },
      { label: 'Sonstige', bilder: [bild('2'), bild('3')] },
    ])
  })

  // Der Kern: Das über die Erweiterung nachgeladene Bild liegt in „Sonstige"
  // und soll dort BLEIBEN — es muss nur auswählbar sein.
  it('bietet auch Bilder aus „Sonstige" an, ohne sie zu verschieben', () => {
    const gruppen = koerperbildKandidaten([{ url: bild('x'), label: 'Sonstige' }], EIGEN)
    expect(gruppen).toEqual([{ label: 'Sonstige', bilder: [bild('x')] }])
  })

  it('lässt fremde Adressen weg — der Arbeiter würde sie ablehnen', () => {
    expect(koerperbildKandidaten([
      { url: 'https://scontent-dus1-1.xx.fbcdn.net/v/t39/510969862.jpg', label: 'Sonstige' },
      { url: bild('gut'), label: 'Sonstige' },
    ], EIGEN)).toEqual([{ label: 'Sonstige', bilder: [bild('gut')] }])
  })

  it('zeigt dasselbe Bild nicht zweimal', () => {
    expect(koerperbildKandidaten([
      { url: bild('gleich'), label: 'Sonstige' },
      { url: bild('gleich'), label: 'Sonstige' },
    ], EIGEN)).toEqual([{ label: 'Sonstige', bilder: [bild('gleich')] }])
  })

  it('liefert nichts, wenn es nichts Brauchbares gibt', () => {
    expect(koerperbildKandidaten([], EIGEN)).toEqual([])
  })
})

describe('Referenzansage', () => {
  it('nummeriert die Bilder in der Reihenfolge, in der sie mitgehen', () => {
    const text = referenzAnsage('referenzsheet', { hatKoerperfoto: false })!
    expect(text).toContain('Image 1 = HEAD REFERENCE SHEET')
    expect(text).toContain('Image 2 = BODY REFERENCE SHEET')
    // Die Zuordnung muss auch die Reihenfolge im TEXT halten — sonst zeigt sie
    // auf das falsche Bild, und genau das ist am 01.09.2026 passiert.
    expect(text.indexOf('Image 1')).toBeLessThan(text.indexOf('Image 2'))
  })

  it('sagt auch bei einem einzigen Bild, wofür es steht', () => {
    expect(referenzAnsage('kopf', { hatKoerperfoto: false })).toContain('Image 1 = ORIGINAL PHOTO')
  })

  // Der eigentliche Kern der heutigen Änderung: Ein ECHTES Foto, das im
  // Körper-Schritt nur den Körperbau liefern soll, muss das Gesicht darin
  // STRIKT ausschließen — anders als das erzeugte Körper-Sheet in Schritt 3,
  // wo „sekundär" reicht (das ist schon KI-Ergebnis im Wissen um den Kopf).
  it('verlangt bei einem echten Foto als Körperquelle, das Gesicht STRIKT zu ignorieren', () => {
    const mitKoerperfoto = referenzAnsage('koerper', { hatKoerperfoto: true })!
    expect(mitKoerperfoto).toContain('Completely ignore any face')
    expect(mitKoerperfoto).not.toContain('secondary')
  })

  it('lässt beim erzeugten Körper-Sheet in Schritt 3 die mildere Formulierung', () => {
    const referenzsheetText = referenzAnsage('referenzsheet', { hatKoerperfoto: false })!
    expect(referenzsheetText).toContain('secondary')
  })

  it('sagt beim Originalfoto als Körperquelle dasselbe Strikte wie beim Körperfoto', () => {
    const mitTitelbild = referenzAnsage('koerper', { hatKoerperfoto: false })!
    const mitKoerperfoto = referenzAnsage('koerper', { hatKoerperfoto: true })!
    // Beide sind ein „echtes Foto in der Rolle Körperquelle" — nur WELCHES
    // Bild es ist, unterscheidet sich, nicht die Anweisung dazu.
    expect(mitTitelbild.split('Image 2 = ')[1]).toBe(mitKoerperfoto.split('Image 2 = ')[1])
  })
})

describe('Körpermerkmale — Marks Liste vom 03.09.2026', () => {
  it('liefert nichts, wenn nichts ausgewählt wurde', () => {
    expect(koerperMerkmaleText({})).toBeNull()
  })

  it('nennt nur die tatsächlich gesetzten Merkmale', () => {
    const text = koerperMerkmaleText({ bau: 'sportlich', beinlaenge: 'lang' })!
    expect(text).toContain('athletic')
    expect(text).toContain('long legs')
    // Nicht gesetzte Merkmale (Größe, Oberweite, Becken) dürfen NICHT erfunden
    // auftauchen — sonst legt die Auswahl etwas fest, das Mark nie gewählt hat.
    expect(text).not.toContain('height')
    expect(text).not.toContain('bust')
    expect(text).not.toContain('hips')
  })

  // Seine wörtliche Liste: „detailliert große Oberweite, kleine Oberweite bei
  // Frauen. Ausladen des Beckens … lange Beine, kurze Beine."
  it('deckt alle fünf von Mark genannten Merkmale ab', () => {
    const alles = koerperMerkmaleText({
      bau: 'kraeftig', groesse: 'gross', oberweite: 'gross', becken: 'ausladend', beinlaenge: 'kurz',
    })!
    expect(alles).toContain('heavier')
    expect(alles).toContain('tall')
    expect(alles).toContain('large bust')
    expect(alles).toContain('wide, flared hips')
    expect(alles).toContain('shorter legs')
  })
})

describe('Der fertige Prompt', () => {
  it('lässt den Sheet-Prompt selbst unangetastet', () => {
    const basis = 'ORIGINALPROMPT BLEIBT SO'
    const fertig = kettenPrompt('koerper', basis, { hatKoerperfoto: true })
    expect(fertig.startsWith(basis)).toBe(true)
    expect(fertig).toContain('Image 1 = HEAD REFERENCE SHEET')
  })

  it('hängt die Merkmalsauswahl VOR die Referenzansage', () => {
    const fertig = kettenPrompt('koerper', 'BASIS', {
      hatKoerperfoto: false, koerperAuswahl: { bau: 'schlank' },
    })
    expect(fertig.indexOf('slim build')).toBeLessThan(fertig.indexOf('REFERENCE IMAGES'))
  })

  it('hängt bei Kopf und Referenzsheet keine Merkmalsauswahl an — die gilt nur für den Körper', () => {
    const fertig = kettenPrompt('kopf', 'BASIS', {
      hatKoerperfoto: false, koerperAuswahl: { bau: 'schlank' },
    })
    expect(fertig).not.toContain('slim build')
  })

  it('ohne Auswahl bleibt der Prompt wie zuvor', () => {
    const fertig = kettenPrompt('koerper', 'BASIS', { hatKoerperfoto: false })
    expect(fertig).not.toContain('ADDITIONAL BODY CHARACTERISTICS')
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

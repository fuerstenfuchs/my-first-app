import { describe, it, expect } from 'vitest'
import { vorschauAdresse } from './vorschaubild'

/**
 * Die Adressumrechnung ist die einzige Stelle, an der etwas schiefgehen kann,
 * ohne dass man es sieht: Ein falsch gebauter Pfad liefert 404, das Bauteil
 * fällt still auf das Original zurück — und alles ist wieder langsam, ohne
 * dass irgendetwas kaputt aussieht.
 */
const BASIS = 'https://abc.supabase.co/storage/v1/object/public'

describe('vorschauAdresse', () => {
  it('schiebt `vorschau/` vor den Pfad und hängt .jpg an', () => {
    expect(vorschauAdresse(`${BASIS}/generated-images/nutzer/auftrag/bild.png`))
      .toBe(`${BASIS}/generated-images/vorschau/nutzer/auftrag/bild.png.jpg`)
  })

  it('behält den Zwischenspeicher-Brecher als Abfrage, nicht als Dateiname', () => {
    // Die Warteschlange hängt `?v=<versuche>` an, weil ein Neuversuch in
    // denselben Pfad schreibt. Landete das im Dateinamen, gäbe es 404.
    expect(vorschauAdresse(`${BASIS}/generated-images/a/b.png?v=2`))
      .toBe(`${BASIS}/generated-images/vorschau/a/b.png.jpg?v=2`)
  })

  it('rührt eine Adresse nicht an, die schon auf die Vorschau zeigt', () => {
    const schon = `${BASIS}/generated-images/vorschau/a/b.png.jpg`
    expect(vorschauAdresse(schon)).toBe(schon)
  })

  it('gibt null zurück, wenn es keine öffentliche Speicheradresse ist', () => {
    // Dann benutzt das Bauteil die Adresse unverändert — etwa bei Bildern,
    // die von einer fremden Webseite kommen.
    expect(vorschauAdresse('https://example.com/bild.jpg')).toBeNull()
    expect(vorschauAdresse('/logo.png')).toBeNull()
  })
})

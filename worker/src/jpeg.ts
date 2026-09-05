import sharp from 'sharp'

/**
 * Ergebnisbilder als JPEG ablegen statt als PNG (PROJ-69).
 *
 * WARUM: Am 05.09.2026 im Speicher nachgemessen — 661 PNG mit zusammen
 * 1709 MB, davon 428 über 2 MB und zehn über 10 MB; das größte 38 MB. Die
 * 521 JPEG derselben Sammlung kamen zusammen auf 151 MB. Dasselbe Bild ist als
 * JPEG rund ein Zehntel so groß.
 *
 * Marks Entscheidung: „Wir lassen die PNGs drin und nehmen aber ab jetzt
 * JPEGs." Also nichts Bestehendes anfassen, nur alles Neue.
 *
 * WARUM 92 UND NICHT 80: Das sind Bilder, aus denen er weiterarbeitet —
 * Referenzen für neue Erzeugungen, Vorlagen für Vergrößerungen. Bei 92 ist der
 * Unterschied zum Original mit bloßem Auge nicht zu finden, die Datei aber
 * immer noch acht- bis zehnmal kleiner. Wer hier heruntergeht, spart Bytes an
 * der Stelle, an der Mark sie am wenigsten sparen will.
 */
const GUETE = 92

export type Umwandlung = {
  daten: Buffer
  /**
   * Ob wirklich umgewandelt wurde. NICHT aus der Groesse ableitbar: `alsJpeg`
   * reicht in VIER Faellen unveraendert durch, und einer davon ist ein
   * FEHLER. Wer „umgewandelt?" aus `laenge vorher === laenge nachher` raet,
   * kann den Ausfall nicht vom Normalfall unterscheiden — dann laeuft alles
   * weiter als PNG, das Protokoll schweigt, und es faellt erst auf, wenn der
   * Speicher Wochen spaeter wieder waechst.
   */
  umgewandelt: boolean
  /** Warum es so abgelegt wurde — landet IMMER im Protokoll des Arbeiters. */
  grund: string
  /** Gesetzt, wenn die Umwandlung geworfen hat. Das ist kein Normalfall. */
  fehler?: Error
}

/**
 * Wandelt ein Bild in JPEG um — AUSSER es benutzt wirklich Transparenz.
 *
 * DIE AUSNAHME IST KEIN BEIWERK: JPEG kann keine Transparenz. Ein
 * freigestelltes Produktbild oder ein Logo mit durchsichtigem Grund würde beim
 * Umwandeln einen schwarzen Kasten bekommen — und zwar lautlos, denn die Datei
 * wäre gültig und kleiner. Deshalb wird nicht am Dateityp entschieden, sondern
 * am INHALT: `stats().isOpaque` sagt, ob der Alphakanal überhaupt benutzt wird.
 * Ein PNG mit Alphakanal, in dem alles deckend ist, wird umgewandelt; eines mit
 * echten durchsichtigen Stellen bleibt PNG.
 */
export async function alsJpeg(daten: ArrayBuffer | Buffer): Promise<Umwandlung> {
  const roh = Buffer.isBuffer(daten) ? daten : Buffer.from(daten)
  try {
    const bild = sharp(roh)
    const { format, pages } = await bild.metadata()
    // `sharp` meldet JPEG immer als 'jpeg', nie als 'jpg' — eine zusaetzliche
    // Pruefung auf 'jpg' waere toter Code, den `tsc` zu Recht anmeckert.
    if (format === 'jpeg') {
      return { daten: roh, umgewandelt: false, grund: 'war schon JPEG' }
    }
    // Ein bewegtes Bild (GIF/WebP mit mehreren Seiten) wuerde `sharp` ohne
    // `{ animated: true }` auf die erste Seite eindampfen — lautlos. Bei den
    // Modellen hier praktisch ausgeschlossen, aber eine Zeile schliesst es.
    if ((pages ?? 1) > 1) {
      return { daten: roh, umgewandelt: false, grund: `bewegtes Bild (${pages} Seiten) — bleibt, wie es ist` }
    }
    const { isOpaque } = await bild.stats()
    if (!isOpaque) {
      return { daten: roh, umgewandelt: false, grund: 'hat durchsichtige Stellen — bleibt, wie es ist' }
    }
    // NACHGEMESSEN am 05.09.2026 an vier Bildern aus `generated-images`:
    // Farbraum sRGB, 8 Bit, KEIN eingebettetes Farbprofil, KEIN EXIF. Es geht
    // beim Umwandeln also weder Farbe noch Bittiefe verloren — die uebliche
    // Sorge bei JPEG trifft hier nicht zu. Das steht hier, damit niemand es
    // erneut vermutet und vorsichtshalber schlechter macht.
    const jpeg = await sharp(roh)
      // `rotate()` ohne Argument wendet die EXIF-Drehung an und entfernt sie
      // danach. Bei den Modellbildern ist gar keine gesetzt; die Zeile ist die
      // Absicherung fuer alles, was auf anderem Weg hier hereinkommt.
      .rotate()
      // 4:4:4 — VOLLE FARBAUFLOESUNG. `sharp` halbiert sie sonst (Voreinstellung
      // '4:2:0', nachgemessen in node_modules/sharp/dist/constructor.mjs:339;
      // die Typdatei behauptet eine gueteabhaengige Umschaltung ab 90, die es
      // im Code nicht gibt). Bei Haut und Himmel faellt das nicht auf, bei
      // gesaettigtem Feindetail schon: Lippenkante, Wimpern, duenne farbige
      // Linien, Schrift. Genau solche Bilder gehen hier als Referenz wieder
      // hinein — der Aufschlag ist wenige Prozent, der Verlust waere dauerhaft.
      .jpeg({ quality: GUETE, chromaSubsampling: '4:4:4', mozjpeg: true })
      .toBuffer()
    // Ein JPEG, das GRÖSSER wäre als das Original, ist ein schlechtes Geschäft.
    // Kommt bei Grafiken mit wenigen Farben vor — da ist PNG im Vorteil.
    if (jpeg.length >= roh.length) {
      return {
        daten: roh, umgewandelt: false,
        grund: `JPEG wäre größer gewesen (${jpeg.length} statt ${roh.length})`,
      }
    }
    return {
      daten: jpeg,
      umgewandelt: true,
      grund: `JPEG ${GUETE} — ${(roh.length / 1024 / 1024).toFixed(1)} MB auf ` +
             `${(jpeg.length / 1024 / 1024).toFixed(1)} MB`,
    }
  } catch (e) {
    // Lieber unverändert ablegen als gar nicht. Ein Ergebnis, das der Arbeiter
    // schon erzeugt hat, darf nicht an der Umwandlung scheitern.
    //
    // ABER NICHT STILL. Faellt `sharp` aus — fehlendes natives Paket nach
    // einem Node-Update, Speichergrenze bei einem 8192er-Bild —, dann geht ab
    // sofort JEDES Bild wieder als PNG hoch. Ohne diese Zeile saehe PROJ-69
    // erledigt aus, waehrend es nichts tut.
    const fehler = e as Error
    console.error(`  [!] Umwandlung nach JPEG fehlgeschlagen: ${fehler.message}`)
    return {
      daten: roh, umgewandelt: false, fehler,
      grund: `Umwandlung fehlgeschlagen (${fehler.message}) — unverändert abgelegt`,
    }
  }
}

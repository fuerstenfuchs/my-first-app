/**
 * Zuschneiden — Seitenverhältnisse und das automatische Zuschneiden.
 *
 * Die Liste stammt aus Marks Vorlage vom 02.09.2026: „Das ist das Mindeste,
 * was ich tun kann, weil ich habe hier auf Windows kein
 * Bildbearbeitungsprogramm, außer das direkt von Windows." Deshalb ist sie
 * vollständig übernommen und nicht auf das gekürzt, was üblich wäre.
 */

export type VerhaeltnisSchluessel =
  | 'frei' | 'original' | 'quadrat'
  | '16:9' | '5:4' | '4:3' | '9:16' | '4:5' | '3:4'
  | '3:2' | '7:5' | '2:1' | '2:3' | '5:7' | '1:2'

export type Verhaeltnis = {
  key: VerhaeltnisSchluessel
  label: string
  /** Breite geteilt durch Höhe — null bei frei und original. */
  wert: number | null
  /** Für die Anzeige: hoch, quer oder quadratisch. */
  lage: 'quer' | 'hoch' | 'quadrat' | 'frei'
}

export const VERHAELTNISSE: Verhaeltnis[] = [
  { key: 'frei',     label: 'Benutzerdefiniert', wert: null, lage: 'frei' },
  { key: 'original', label: 'Original',          wert: null, lage: 'frei' },
  { key: 'quadrat',  label: 'Quadrat',           wert: 1,    lage: 'quadrat' },

  { key: '16:9', label: '16 : 9', wert: 16 / 9, lage: 'quer' },
  { key: '5:4',  label: '5 : 4',  wert: 5 / 4,  lage: 'quer' },
  { key: '4:3',  label: '4 : 3',  wert: 4 / 3,  lage: 'quer' },

  { key: '9:16', label: '9 : 16', wert: 9 / 16, lage: 'hoch' },
  { key: '4:5',  label: '4 : 5',  wert: 4 / 5,  lage: 'hoch' },
  { key: '3:4',  label: '3 : 4',  wert: 3 / 4,  lage: 'hoch' },

  { key: '3:2',  label: '3 : 2',  wert: 3 / 2,  lage: 'quer' },
  { key: '7:5',  label: '7 : 5',  wert: 7 / 5,  lage: 'quer' },
  { key: '2:1',  label: '2 : 1',  wert: 2,      lage: 'quer' },

  { key: '2:3',  label: '2 : 3',  wert: 2 / 3,  lage: 'hoch' },
  { key: '5:7',  label: '5 : 7',  wert: 5 / 7,  lage: 'hoch' },
  { key: '1:2',  label: '1 : 2',  wert: 0.5,    lage: 'hoch' },
]

/** Ein Ausschnitt in Anteilen des Bildes (0…1) — nie in Pixeln. */
export type Ausschnitt = { x: number; y: number; breite: number; hoehe: number }

export const GANZES_BILD: Ausschnitt = { x: 0, y: 0, breite: 1, hoehe: 1 }

/**
 * Ist das praktisch das ganze Bild?
 *
 * Mit Toleranz, nicht auf die Stelle genau: Zieht man den Rahmen von Hand
 * wieder auf das ganze Bild auf, liefert der Zuschneider Prozentwerte wie
 * 99.9987. Ohne Toleranz gälte das als Änderung, und es entstünde eine
 * Fassung, die sich vom Original um nichts unterscheidet außer einer
 * Pixelreihe.
 */
export function istGanzesBild(a: Ausschnitt, toleranz = 0.002): boolean {
  return Math.abs(a.x) <= toleranz && Math.abs(a.y) <= toleranz
    && Math.abs(a.breite - 1) <= toleranz && Math.abs(a.hoehe - 1) <= toleranz
}

/**
 * WARUM IN ANTEILEN UND NICHT IN PIXELN: Zugeschnitten wird auf einer
 * verkleinerten Vorschau, gerechnet wird am Original. Pixelkoordinaten aus der
 * Vorschau lägen im Original um den Skalierungsfaktor daneben — bei einem
 * 16:9-Zuschnitt fällt genau das auf.
 */
export function inPixel(
  a: Ausschnitt, breite: number, hoehe: number,
  /**
   * Das gewählte Seitenverhältnis, falls eines gewählt ist.
   *
   * Ohne es entsteht aus zwei unabhängig gerundeten Anteilen ein Verhältnis,
   * das nur ungefähr stimmt — aus 16:9 kann 16,03:9 werden. Bei fünfzehn
   * Seitenverhältnissen als Aushängeschild ist das keine Kleinigkeit: Wer das
   * Bild in ein Video legt, bekommt eine Pixelreihe Verzug.
   */
  verhaeltnis?: number,
) {
  let b = Math.max(1, Math.round(a.breite * breite))
  let h = Math.max(1, Math.round(a.hoehe * hoehe))

  // Die Höhe aus der Breite ableiten, statt beide zu runden.
  if (verhaeltnis && verhaeltnis > 0) {
    h = Math.max(1, Math.round(b / verhaeltnis))
    if (h > hoehe) { h = hoehe; b = Math.max(1, Math.round(h * verhaeltnis)) }
    if (b > breite) { b = breite; h = Math.max(1, Math.round(b / verhaeltnis)) }
  }

  b = Math.min(b, breite)
  h = Math.min(h, hoehe)

  // KLEMMEN, sonst ragt der Ausschnitt über die Bildkante.
  // Nachgerechnet: bei 4496 px Breite und x=0.3333 / breite=0.6667 ergeben die
  // unabhängigen Rundungen 1499 + 2998 = 4497 — ein Pixel zu viel. `drawImage`
  // füllt den Überstand laut Norm mit durchsichtigem Schwarz, also stünde in
  // jeder zweiten randbündigen Fassung eine 1 px breite durchsichtige Spalte.
  // Man sieht sie erst, wenn das Bild irgendwo auf anderem Grund liegt.
  const x = Math.min(Math.max(0, Math.round(a.x * breite)), breite - b)
  const y = Math.min(Math.max(0, Math.round(a.y * hoehe)), hoehe - h)

  return { x, y, breite: b, hoehe: h }
}

// ── Automatisches Zuschneiden ───────────────────────────────────────────────

/**
 * „Automatisches Zuschneiden" meint zwei verschiedene Dinge, je nachdem, ob
 * ein Format gewählt ist. Deshalb EIN Knopf, der beides kann — zwei Knöpfe
 * müsste man erklären.
 *
 *  - ohne festes Format: einfarbige Ränder wegschneiden (Scanränder, weiße
 *    Rahmen, schwarze Balken)
 *  - mit festem Format: den Rahmen dorthin legen, wo im Bild etwas los ist
 *
 * Beides ohne KI-Modell: deterministisch, sofort, keine Megabyte im Gepäck.
 */

/** Ein kleines Abbild für die Analyse — 200 px lange Kante genügt. */
function abbild(quelle: ImageBitmap, kante = 200): ImageData | null {
  const f = kante / Math.max(quelle.width, quelle.height)
  const b = Math.max(1, Math.round(quelle.width * f))
  const h = Math.max(1, Math.round(quelle.height * f))
  const c = document.createElement('canvas')
  c.width = b; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(quelle, 0, 0, b, h)
  return ctx.getImageData(0, 0, b, h)
}

/**
 * Einfarbige Ränder wegschneiden.
 *
 * Die Eckfarbe ist die Referenz; von jeder Seite wird nach innen gelaufen, bis
 * eine Zeile im Mittel deutlich abweicht. Ein paar Bildpunkte Sicherheitsrand
 * bleiben stehen — ein Rahmen ist selten exakt einfarbig.
 */
export function raenderWeg(quelle: ImageBitmap, schwelle = 12): Ausschnitt {
  const d = abbild(quelle)
  if (!d) return GANZES_BILD
  const { width: b, height: h, data } = d
  const at = (x: number, y: number) => (y * b + x) * 4
  const ref = [data[0], data[1], data[2]]
  const abw = (x: number, y: number) => {
    const i = at(x, y)
    return (Math.abs(data[i] - ref[0]) + Math.abs(data[i + 1] - ref[1]) + Math.abs(data[i + 2] - ref[2])) / 3
  }
  const zeileRuhig = (y: number) => {
    let s = 0
    for (let x = 0; x < b; x++) s += abw(x, y)
    return s / b < schwelle
  }
  const spalteRuhig = (x: number) => {
    let s = 0
    for (let y = 0; y < h; y++) s += abw(x, y)
    return s / h < schwelle
  }

  let oben = 0, unten = h - 1, links = 0, rechts = b - 1
  while (oben < unten && zeileRuhig(oben)) oben++
  while (unten > oben && zeileRuhig(unten)) unten--
  while (links < rechts && spalteRuhig(links)) links++
  while (rechts > links && spalteRuhig(rechts)) rechts--

  // BLEIBT ZU WENIG ÜBRIG, gilt „nichts gefunden".
  //
  // Bei einem einfarbigen oder sehr flauen Bild ist JEDE Zeile und Spalte
  // „ruhig". Die Schleifen laufen dann bis zur gegenüberliegenden Kante, und
  // die alte Prüfung auf die vier Startwerte griff nicht mehr — heraus kam ein
  // Fenster von etwa drei mal drei Bildpunkten in der rechten unteren Ecke,
  // hochgerechnet auf das ganze Bild. Das trifft nicht nur den Extremfall:
  // Nebel, Schnee, ein Studiohintergrund reichen schon.
  const bleibtBreite = rechts - links + 1
  const bleibtHoehe  = unten - oben + 1
  if (bleibtBreite < b * 0.1 || bleibtHoehe < h * 0.1) return GANZES_BILD
  if (bleibtBreite > b * 0.98 && bleibtHoehe > h * 0.98) return GANZES_BILD

  const rand = 1
  const x = Math.max(0, links - rand) / b
  const y = Math.max(0, oben - rand) / h
  return {
    x, y,
    breite: Math.min(1 - x, (rechts - links + 1 + 2 * rand) / b),
    hoehe:  Math.min(1 - y, (unten - oben + 1 + 2 * rand) / h),
  }
}

/**
 * Den besten Ausschnitt für ein festes Seitenverhältnis suchen.
 *
 * Drei Wichtigkeitskarten, addiert: örtlicher Kontrast (Detail zieht den
 * Blick), Farbkraft, und eine grobe Hautton-Regel. Letztere findet Menschen
 * erstaunlich zuverlässig, ohne dass ein Gesichtsmodell geladen werden muss —
 * die browsereigene Gesichtserkennung ist nie über den Versuchsstand
 * hinausgekommen, und ein eigenes Modell wären mehrere Megabyte.
 */
export function bestesFenster(quelle: ImageBitmap, verhaeltnis: number): Ausschnitt {
  const d = abbild(quelle, 120)
  if (!d) return GANZES_BILD
  const { width: b, height: h, data } = d

  const wichtig = new Float32Array(b * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < b; x++) {
      const i = (y * b + x) * 4
      const r = data[i], g = data[i + 1], bl = data[i + 2]
      const max = Math.max(r, g, bl), min = Math.min(r, g, bl)

      // Örtlicher Kontrast: Unterschied zum rechten und unteren Nachbarn.
      let kante = 0
      if (x + 1 < b) kante += Math.abs(r - data[i + 4])
      if (y + 1 < h) kante += Math.abs(r - data[i + b * 4])

      const farbkraft = max === 0 ? 0 : (max - min) / max
      // Hautton grob: rot dominant, Abstand zu grün im mittleren Bereich.
      const haut = (r > g && g > bl && r - g > 12 && r - g < 90 && r > 70) ? 1 : 0

      wichtig[y * b + x] = kante / 255 + farbkraft * 0.8 + haut * 1.4
    }
  }

  // Größtes Fenster im Zielverhältnis, das ins Bild passt.
  let fb = b, fh = Math.round(b / verhaeltnis)
  if (fh > h) { fh = h; fb = Math.round(h * verhaeltnis) }

  // Passt das Fenster genau auf das ganze Bild — also bei „Original" —, gäbe es
  // nichts zu suchen und der Knopf sagte jedes Mal Nein. Dann wird ein etwas
  // kleineres Fenster gesucht: Genau das ist die naheliegende Absicht, wenn
  // jemand „Original" wählt und trotzdem automatisch zuschneiden will —
  // Format behalten, Ausschnitt besser legen.
  if (fb >= b * 0.99 && fh >= h * 0.99) {
    fb = Math.round(b * 0.85)
    fh = Math.round(fb / verhaeltnis)
    if (fh > h) { fh = Math.round(h * 0.85); fb = Math.round(fh * verhaeltnis) }
  }
  if (fb >= b && fh >= h) return GANZES_BILD

  const schritt = Math.max(1, Math.round(Math.min(b, h) / 24))
  let besteSumme = -1, bx = 0, by = 0

  for (let y = 0; y + fh <= h; y += schritt) {
    for (let x = 0; x + fb <= b; x += schritt) {
      let s = 0
      for (let yy = y; yy < y + fh; yy += 2) {
        for (let xx = x; xx < x + fb; xx += 2) s += wichtig[yy * b + xx]
      }
      // Leichter Mittenbonus: Bei gleichwertigen Fenstern wirkt die Mitte
      // ruhiger als ein angeschnittener Rand.
      const mx = (x + fb / 2) / b - 0.5
      const my = (y + fh / 2) / h - 0.5
      s *= 1 - 0.12 * Math.sqrt(mx * mx + my * my)

      if (s > besteSumme) { besteSumme = s; bx = x; by = y }
    }
  }

  return { x: bx / b, y: by / h, breite: fb / b, hoehe: fh / h }
}

/**
 * Das groesste zentrierte Fenster im gewuenschten Verhaeltnis.
 *
 * WARUM ES DAS BRAUCHT: Wer ein Format anklickt, erwartet, dass der Rahmen
 * SOFORT so aussieht. Am 02.09.2026 im Browser nachgemessen: Nach dem Klick auf
 * „16:9" lag der Rahmen weiter auf dem ganzen Bild (1122x1402) — sichtbar
 * passierte nichts, und Speichern haette das unveraenderte Hochformat abgelegt.
 * Ein Formatknopf, der nichts tut, ist schlimmer als keiner.
 *
 * Unterschied zu `bestesFenster`: Das hier fragt nicht, WO im Bild etwas los
 * ist — es legt den Rahmen einfach mittig. Das ist der Ausgangspunkt, den man
 * danach mit der Maus verschiebt.
 */
export function zentriertesFenster(
  breite: number,
  hoehe: number,
  verhaeltnis: number,
): Ausschnitt {
  if (!(breite > 0) || !(hoehe > 0) || !(verhaeltnis > 0)) return GANZES_BILD

  // Erst so breit wie moeglich; passt die Hoehe nicht ins Bild, andersherum.
  let fb = breite
  let fh = fb / verhaeltnis
  if (fh > hoehe) { fh = hoehe; fb = fh * verhaeltnis }

  return {
    x: (breite - fb) / 2 / breite,
    y: (hoehe - fh) / 2 / hoehe,
    breite: fb / breite,
    hoehe: fh / hoehe,
  }
}

/**
 * Die zwei Wege beim Vergrößern — an einer Stelle.
 *
 * WARUM DIESE DATEI EXISTIERT: Preis und Beschriftung standen zuerst zweimal
 * da — einmal im Menü auf der Ergebniskachel, einmal in der Bestätigung, die
 * 200 ms später erscheint. Das Menü nannte für 4× „ca. 2 ct", die Bestätigung
 * für jeden Faktor „rund einen halben Cent". Der Nutzer klickte auf zwei Cent
 * und las eine Sekunde später einen halben. Zwei Kopien einer Zahl driften
 * zuverlässig auseinander, und bei einer Preisangabe ist das kein Schönheits-
 * fehler.
 */

/**
 * Womit vergrößert wird.
 *
 * `lanczos` rechnet der PC selbst und kostet nichts — es verteilt vorhandene
 * Bildpunkte, erfindet aber keine Details. Die beiden anderen laufen über
 * fal.ai, rekonstruieren Haut, Haar und Stoff, und kosten Geld:
 *
 * - `seedvr2` (ByteDance) bleibt nah am Original, rekonstruiert zurückhaltend
 * - `crystal` (Clarity AI) geht freier zu Werke
 *
 * Welches besser ist, hängt vom Bild ab. Deshalb beide, statt eines
 * auszuwählen.
 */
export type Upscaler = 'lanczos' | 'seedvr2' | 'crystal' | 'gemini'

/**
 * Was im Menü angeboten wird — und in welcher Reihenfolge.
 *
 * `lanczos` steht bewusst NICHT mehr drin. Mark am 02.09.2026, nach dem
 * Vergleich an einem Porträt: „sehe ich kaum einen Unterschied, ist zwar
 * größer, aber genauso unscharf … werde ich nie nutzen." Gemessen stimmt das:
 * Lanczos verteilt vorhandene Bildpunkte, es kann keine Struktur hinzufügen.
 *
 * Der Wert bleibt im Typ, in der Datenbank und im Arbeiter erhalten — sonst
 * würden die bereits vorhandenen Aufträge in der Warteschlange ihre
 * Beschriftung verlieren und sich nicht mehr erneut einreihen lassen.
 * Weggenommen wird nur das Angebot, nicht die Vergangenheit.
 */
export const IM_MENUE: readonly Upscaler[] = ['seedvr2', 'gemini', 'crystal']

/** Die bezahlten Verfahren — an einer Stelle, damit niemand eins vergisst. */
export const KOSTET_GELD: readonly Upscaler[] = ['seedvr2', 'crystal']

export function kostetGeld(v: Upscaler | null | undefined): boolean {
  return !!v && KOSTET_GELD.includes(v)
}

export const VERFAHREN_NAME: Record<Upscaler, string> = {
  lanczos: 'Rechnen',
  seedvr2: 'KI · SeedVR2',
  crystal: 'KI · Crystal',
  gemini:  'KI · Gemini',
}

/** Was im Menü unter der Überschrift steht. */
export const VERFAHREN_HINWEIS: Record<Upscaler, string> = {
  lanczos: 'nur rechnerisch',
  seedvr2: 'treu und günstig — der Regelfall',
  crystal: 'schärfer, erfindet mehr, teuer',
  // „Gratis" und „höchste Auflösung" sind die beiden Wörter, die den Klick
  // auslösen. Der Vorbehalt muss deshalb daneben stehen und nicht erst in der
  // Bestätigung danach: Gemini baut das Bild NEU — am Porträt gemessen saßen
  // Brauenform und Lidfalte hinterher anders.
  gemini:  'gratis, bis 4K — rechnet das Bild NEU, bei Gesichtern prüfen',
}

/**
 * Was ein Verfahren als Ziel entgegennimmt.
 *
 * Gemini kennt KEINE Faktoren. Es rechnet in Seitenverhältnis plus
 * Größenklasse — aus 1122×1402 werden 3712×4608, also 3,31×. Diese Zahl in
 * eine Faktor-Auswahl zu pressen wäre eine Lüge auf dem Knopf. Deshalb hat
 * jedes Verfahren seine eigenen Stufen, und die Datenbank hat für beide Arten
 * eine eigene Spalte.
 */
export type Stufe =
  | { art: 'faktor'; wert: 2 | 3 | 4 }
  | { art: 'klasse'; wert: '1K' | '2K' | '4K' }

const FAKTOREN: Stufe[] = [
  { art: 'faktor', wert: 2 }, { art: 'faktor', wert: 3 }, { art: 'faktor', wert: 4 },
]

export const STUFEN: Record<Upscaler, Stufe[]> = {
  lanczos: FAKTOREN,
  seedvr2: FAKTOREN,
  crystal: FAKTOREN,
  // 1K wäre bei Marks Bildern eine Verkleinerung — deshalb nur 2K und 4K.
  gemini: [{ art: 'klasse', wert: '2K' }, { art: 'klasse', wert: '4K' }],
}

/**
 * Wie groß eine Gemini-Größenklasse tatsächlich wird — gemessen, nicht geraten.
 *
 * Am 02.09.2026 an echten Läufen: 2K aus einem 4:5-Bild ergab 1856×2304
 * (4,3 MP), 4K ergab 3712×4608 (17,1 MP); ein 16:9-Bild kam bei 4K auf
 * 5504×3072 (16,9 MP). Die Megapixel bleiben also gleich, die Kantenlängen
 * folgen dem Seitenverhältnis — deshalb steht hier die Fläche und nicht ein
 * Kantenmaß, das nur für ein Format stimmen würde.
 *
 * WARUM DAS IM MENÜ STEHT: Bei den Faktor-Stufen zeigt die Warteschlange die
 * konkreten Zielmaße an. Ohne eine Zahl daneben liest sich „4K" wie WENIGER
 * als „4×" — und liefert in Wahrheit mehr.
 */
export const KLASSE_FLAECHE: Record<'1K' | '2K' | '4K', string> = {
  '1K': 'ca. 1 MP',
  '2K': 'ca. 4 MP',
  '4K': 'ca. 17 MP',
}

/** Die Beschriftung einer Stufe im Menü. */
export function stufeLabel(stufe: Stufe): string {
  return stufe.art === 'faktor' ? `${stufe.wert}×` : stufe.wert
}

/**
 * Was ein KI-Lauf kostet, je Verfahren und Faktor.
 *
 * GEMESSEN am 02.09.2026, nicht geschätzt: Beide Verfahren liefen auf demselben
 * Bild (1122×1402, 2×), und der Preis ergibt sich aus dem Guthaben bei fal.ai
 * vorher und nachher.
 *
 * | Verfahren | 2× auf 1,6 MP | je Megapixel |
 * |---|---|---|
 * | SeedVR2 | 0,7 ct  | ~$0,0011 |
 * | Crystal | 9,6 ct  | ~$0,0152 |
 *
 * **Crystal kostet das Vierzehnfache.** Vorher stand hier für beide „ca. 0,5 ct"
 * — eine aus einer Recherche übernommene Zahl, die für Crystal um das
 * Neunzehnfache danebenlag. Bei einer Preisangabe, die vor dem Klick steht,
 * ist das kein Rundungsfehler, sondern eine falsche Auskunft.
 *
 * Die Werte für 3× und 4× sind HOCHGERECHNET (Fläche wächst quadratisch), nicht
 * gemessen. Ob Crystal überhaupt nach Megapixeln abrechnet oder pauschal je
 * Bild, ist mit einem einzigen Messpunkt nicht zu entscheiden.
 *
 * Ein weiterer Fallstrick: fal bucht **verzögert** ab. SeedVR2 zeigte
 * unmittelbar nach dem Lauf noch 0,00 — der Abzug kam erst rund eine Minute
 * später. Wer sofort nachmisst, misst falsch.
 */
/*
 * Nur die beiden bezahlten Verfahren. Gemini steht hier bewusst NICHT drin:
 * Es laeuft ueber Marks eigenen Zugang und kostet nichts extra — ein Eintrag
 * mit '0 ct' waere eine Preisangabe, wo es keinen Preis gibt.
 */
export const KI_PREIS: Record<'seedvr2' | 'crystal', Record<2 | 3 | 4, string>> = {
  seedvr2: { 2: 'ca. 0,7 ct', 3: 'ca. 1,6 ct', 4: 'ca. 2,8 ct' },
  crystal: { 2: 'ca. 10 ct',  3: 'ca. 22 ct',  4: 'ca. 38 ct'  },
}

/** Der Preis für eine Stufe, oder ein leerer Text bei den kostenlosen. */
export function preis(verfahren: Upscaler, stufe: Stufe): string {
  if (!kostetGeld(verfahren) || stufe.art !== 'faktor') return ''
  return KI_PREIS[verfahren as 'seedvr2' | 'crystal'][stufe.wert]
}

/** Ein Satz für Bestätigungen — dieselbe Zahl wie im Menü. */
export function kostenSatz(verfahren: Upscaler, stufe: Stufe): string {
  if (verfahren === 'gemini') {
    return 'Gemini baut das Bild neu auf — über Deinen eigenen Zugang, kostet nichts extra. '
      + 'Bei Gesichtern das Ergebnis ansehen: Es ist ein Nachbau, kein Vergrößern.'
  }
  if (!kostetGeld(verfahren)) {
    return 'Der Arbeiter rechnet sie auf dem PC — das kostet nichts.'
  }
  return `${VERFAHREN_NAME[verfahren]} über fal.ai — rekonstruiert Details, `
    + `kostet ${preis(verfahren, stufe)}.`
}

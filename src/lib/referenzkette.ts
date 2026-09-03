/**
 * Die Referenzkette eines Charakters (PROJ-48) — die Regeln, ohne Oberfläche.
 *
 * Mark macht das heute von Hand: Sheet erzeugen, herunterladen, wieder
 * hochladen, nächstes Sheet erzeugen. Bei drei Bildern je Charakter ist das
 * sein häufigster Handgriff — und der, bei dem am meisten schiefgeht.
 *
 * Was hier steht, ist absichtlich frei von React und Supabase: Reihenfolge,
 * Referenzzuordnung und die Frage „wo geht es weiter" sind die Stellen, an
 * denen ein Fehler teuer wäre, und nur als reine Funktionen sind sie ohne
 * Anmeldung prüfbar. Die Ausführung liegt in `use-referenzkette.ts`.
 */

export type KettenSchritt = 'kopf' | 'koerper' | 'referenzsheet'

/** Die drei Schritte in genau der Reihenfolge, in der sie laufen. */
export const KETTEN_SCHRITTE: KettenSchritt[] = ['kopf', 'koerper', 'referenzsheet']

/**
 * Wie die Variante heißt, in die das Ergebnis kommt.
 *
 * Mark am 03.09.2026 wörtlich: „Es werden drei eigene Varianten. Es werden
 * einmal Kopf, einmal Körper und einmal Referenzsheet." Die Namen sind damit
 * festgelegt und keine Geschmacksfrage — sie stehen hier einmal und nirgends
 * sonst.
 */
export const VARIANTEN_NAME: Record<KettenSchritt, string> = {
  kopf:          'Kopf',
  koerper:       'Körper',
  referenzsheet: 'Referenzsheet',
}

export const SCHRITT_LABEL: Record<KettenSchritt, string> = {
  kopf:          'Kopf-Sheet',
  koerper:       'Körper-Sheet',
  referenzsheet: 'Referenzsheet',
}

/**
 * Der Name der Variante für Marks EIGENES Körperfoto — ein Original, das er
 * bewusst zusätzlich mitgibt, kein Kettenergebnis.
 *
 * WARUM SIE NICHT IN `KettenSchritt` MITZÄHLT: `naechsterSchritt()` und
 * `offeneSchritte()` messen den Fortschritt der Kette an genau drei Varianten
 * (Kopf, Körper, Referenzsheet). Ein Körperfoto ist eine Eingabe, kein
 * Kettenergebnis — läge es mit in derselben Zählung, sähe die Kette nach dem
 * Hochladen eines Körperfotos aus, als sei sie schon einen Schritt weiter.
 */
/**
 * Hieß bis zum 03.09.2026 „Körperfoto". Mark benennt seine beiden
 * mitgebrachten Ausgangsbilder selbst „Kopf Original" und „Körper Original" —
 * er hatte „Kopf original" schon von Hand angelegt, bevor er es mir sagte.
 * Ein Name, den der Benutzer ohnehin benutzt, ist der richtige. Zum Zeitpunkt
 * der Umbenennung gab es keine einzige Variante namens „Körperfoto" in der
 * Datenbank (nachgemessen), es konnte also nichts verwaisen.
 */
export const KOERPERFOTO_VARIANTE = 'Körper Original'

/**
 * Wohin ein einzelnes, von Mark selbst mitgebrachtes Ausgangsfoto gehört —
 * zum Beispiel das Bild, mit dem ein Charakter über die Erweiterung angelegt
 * wird, oder eines, das er beim Anlegen direkt in der App hochlädt.
 *
 * MUSS SICH VON `VARIANTEN_NAME.kopf` UNTERSCHEIDEN: `standErmitteln()` in
 * use-referenzkette.ts liest ein vorhandenes Bild in der Variante „Kopf" als
 * Beweis, dass das Kopf-SHEET (die fünf Blickwinkel) schon erzeugt wurde, und
 * überspringt den Schritt. Ein einzelnes Ausgangsfoto dort abzulegen brächte
 * die Kette dazu, das eigentliche Kopf-Sheet nie zu erzeugen — genau das hat
 * Mark am 03.09.2026 an einem über die Erweiterung angelegten Charakter
 * bemerkt. „Kopf Original" ist sichtbar und bearbeitbar wie jede andere
 * Variante, zählt aber nicht zum Kettenfortschritt.
 */
export const KOPF_ORIGINAL_VARIANTE = 'Kopf Original'

/**
 * Welche ROLLE ein mitgegebenes Bild spielt — unabhängig davon, WELCHES Bild
 * es konkret ist.
 *
 * WARUM ROLLE UND BILD GETRENNT SIND, SEIT DEM 03.09.2026: Bis dahin gab es
 * eine Ansage je Bild-Herkunft. Das reichte nicht mehr, als der Körper-Schritt
 * eine zweite Bildquelle bekam (Marks eigenes Körperfoto ODER das
 * Originalfoto) — dasselbe Originalfoto spielt in Schritt 1 die Rolle
 * „Identität" (Gesicht erwünscht) und in Schritt 2, falls es dort als
 * Körperquelle dient, die Rolle „nur Körperbau" (Gesicht UNERWÜNSCHT). Eine
 * Ansage, die am Bild statt an der Rolle hängt, hätte das nicht auseinanderhalten
 * können.
 *
 * `koerperbauOriginal` und `koerperbauSheet` klingen ähnlich, sagen aber
 * bewusst Verschiedenes: Ein echtes Foto zeigt das tatsächliche, unveränderte
 * Gesicht der Person — das darf den erzeugten Kopf unter gar keinen Umständen
 * überstimmen, deshalb „ignore … entirely". Das erzeugte Körper-Sheet dagegen
 * ist selbst schon KI-Ergebnis, im Wissen um die Kopf-Referenz entstanden —
 * dort reicht „secondary", das unveränderte Verhalten von vorher.
 */
type Rolle = 'identitaet' | 'kopfsheet' | 'koerperbauOriginal' | 'koerperbauSheet'

const ANSAGE_TEXT: Record<Rolle, string> = {
  identitaet:          'ORIGINAL PHOTO OF THE PERSON — take the face, hair, skin tone and identity from it.',
  kopfsheet:           'HEAD REFERENCE SHEET — take the face, hair and skin tone from it. It shows the same person from several angles.',
  koerperbauOriginal:  'ORIGINAL PHOTO — take ONLY the body proportions, build and posture from it. Completely ignore any face visible in it; the head reference above alone decides the face.',
  koerperbauSheet:     'BODY REFERENCE SHEET — take the body proportions, build and posture from it. The face in it is secondary; the head reference above decides the face.',
}

export type Bildquelle = 'titelbild' | 'koerperfoto' | KettenSchritt

/**
 * Ob für den Körper-Schritt ein eigenes Körperfoto vorliegt — das einzige,
 * was `quellenFuer` von außen wissen muss.
 */
export type KoerperOptionen = { hatKoerperfoto: boolean }

/**
 * Welche Bilder ein Schritt braucht, mit ihrer jeweiligen Rolle.
 *
 * WARUM DER KÖRPER-SCHRITT SEIT DEM 03.09.2026 IMMER ZWEI BILDER BEKOMMT: Mark
 * — „ich habe bisher die Erfahrung gemacht … dass der Körper irgendwie immer
 * gleich aussieht." Vorher bekam er ausschließlich den erzeugten Kopf, und der
 * zeigt nur Kopf und Schultern — nirgends in der Kette stand ein Bild, das
 * zeigt, wie die Person tatsächlich gebaut ist. Das Modell musste den
 * Körperbau frei erfinden und griff dabei jedes Mal zu etwas Ähnlichem.
 *
 * Jetzt kommt als zweites Bild dazu:
 *   - Marks eigenes Körperfoto, wenn er eines mitgegeben hat — sein Fall
 *     „Ich kann dazu bewusst auch ein Körperbild als Zweites mit dazuladen."
 *   - sonst das Originalfoto — sein Fall „ich als Ursprungsbild praktisch
 *     schon ein Ganzkörperbild habe … das wird dann als Referenzbild für Kopf
 *     genommen. Und auch für Körper."
 * Zeigt keins von beiden wirklich einen Körper (reines Kopffoto, kein
 * Körperfoto hochgeladen), ist das zweite Bild uninformativ, aber nicht
 * schädlich — für genau diesen Fall gibt es zusätzlich die freie
 * Merkmalsauswahl in `koerperMerkmaleText()`.
 */
export function quellenFuer(
  schritt: KettenSchritt,
  optionen: KoerperOptionen,
): { bild: Bildquelle; rolle: Rolle }[] {
  switch (schritt) {
    case 'kopf':
      return [{ bild: 'titelbild', rolle: 'identitaet' }]
    case 'koerper':
      return [
        { bild: 'kopf', rolle: 'kopfsheet' },
        { bild: optionen.hatKoerperfoto ? 'koerperfoto' : 'titelbild', rolle: 'koerperbauOriginal' },
      ]
    case 'referenzsheet':
      return [
        { bild: 'kopf', rolle: 'kopfsheet' },
        { bild: 'koerper', rolle: 'koerperbauSheet' },
      ]
  }
}

/**
 * Der Zuordnungsblock für einen Schritt — oder null, wenn er keinen braucht.
 *
 * Auch bei EINEM Bild nötig: Der ursprüngliche Fehler war nicht die
 * Verwechslung zweier Bilder, sondern die Frage, welchen Aspekt eines Bildes
 * das Modell übernimmt.
 */
export function referenzAnsage(schritt: KettenSchritt, optionen: KoerperOptionen): string | null {
  const quellen = quellenFuer(schritt, optionen)
  if (quellen.length === 0) return null
  return [
    'REFERENCE IMAGES — they arrive in this exact order:',
    ...quellen.map((q, i) => `Image ${i + 1} = ${ANSAGE_TEXT[q.rolle]}`),
    'If the text above describes the person differently, follow the reference images and ignore the conflicting words.',
  ].join('\n')
}

/**
 * Die frei wählbaren Körpermerkmale — Marks Liste vom 03.09.2026 wörtlich:
 * „nicht nur schlank, kräftig, sportlich, groß, sondern auch … große
 * Oberweite, kleine Oberweite bei Frauen, Ausladen des Beckens … lange Beine,
 * kurze Beine."
 *
 * Jedes Feld ist einzeln optional (`undefined` = keine Angabe) — genau der
 * Fall, wenn ein Foto schon reicht und nur einzelne Merkmale nachgeschärft
 * werden sollen, oder wenn ein Merkmal (etwa Oberweite) bei diesem Charakter
 * gar nicht zutrifft.
 */
export type KoerperAuswahl = {
  bau?: 'schlank' | 'durchschnittlich' | 'kraeftig' | 'sportlich'
  groesse?: 'klein' | 'durchschnittlich' | 'gross'
  oberweite?: 'klein' | 'mittel' | 'gross'
  becken?: 'schmal' | 'durchschnittlich' | 'ausladend'
  beinlaenge?: 'kurz' | 'durchschnittlich' | 'lang'
}

const MERKMAL_TEXT: { [K in keyof KoerperAuswahl]: Record<NonNullable<KoerperAuswahl[K]>, string> } = {
  bau:        { schlank: 'slim build', durchschnittlich: 'average build', kraeftig: 'heavier, solid build', sportlich: 'athletic, toned build' },
  groesse:    { klein: 'short stature', durchschnittlich: 'average height', gross: 'tall stature' },
  oberweite:  { klein: 'small bust', mittel: 'medium bust', gross: 'large bust' },
  becken:     { schmal: 'narrow hips', durchschnittlich: 'average hip width', ausladend: 'wide, flared hips' },
  beinlaenge: { kurz: 'shorter legs relative to torso', durchschnittlich: 'average leg length', lang: 'long legs relative to torso' },
}

/**
 * Die Auswahl als Prompt-Text — oder `null`, wenn nichts ausgewählt wurde.
 *
 * Nur die tatsächlich gesetzten Felder werden genannt. Ein Merkmal, zu dem
 * Mark nichts sagt, soll dem Modell überlassen bleiben (aus dem Referenzbild
 * oder frei) — nicht mit einer erfundenen Vorgabe belegt werden.
 */
export function koerperMerkmaleText(auswahl: KoerperAuswahl): string | null {
  const zeilen = (Object.keys(MERKMAL_TEXT) as (keyof KoerperAuswahl)[])
    .map(schluessel => {
      const wert = auswahl[schluessel]
      if (!wert) return null
      return (MERKMAL_TEXT[schluessel] as Record<string, string>)[wert]
    })
    // `Boolean` statt `z !== null`: Ein Wert, der es an `MERKMAL_TEXT` vorbei
    // in `auswahl` schafft (Tippfehler an der Aufrufstelle, veraltete Option),
    // ergäbe sonst `undefined` und stünde als wörtliche Zeile „- undefined"
    // im Prompt — ohne Fehler, ohne dass es auffiele. So verschwindet die
    // Zeile still, statt falsch zu erscheinen.
    .filter((z): z is string => Boolean(z))
  if (zeilen.length === 0) return null
  return [
    'ADDITIONAL BODY CHARACTERISTICS — apply these specifically, on top of whatever the reference images show:',
    ...zeilen.map(z => `- ${z}`),
  ].join('\n')
}

/**
 * Der fertige Prompt eines Schrittes.
 *
 * Der Sheet-Prompt selbst bleibt UNANGETASTET — angehängt werden nur die
 * Merkmalsauswahl (falls Mark eine getroffen hat) und die Zuordnung. Das ist
 * dieselbe Trennung wie in `promptFuerAuftrag()`: Es gibt genau eine Stelle,
 * die den Prompt anfasst, und sie ist prüfbar.
 */
export function kettenPrompt(
  schritt: KettenSchritt,
  basis: string,
  optionen: KoerperOptionen & { koerperAuswahl?: KoerperAuswahl },
): string {
  const teile = [basis]
  if (schritt === 'koerper' && optionen.koerperAuswahl) {
    const merkmale = koerperMerkmaleText(optionen.koerperAuswahl)
    if (merkmale) teile.push(merkmale)
  }
  const ansage = referenzAnsage(schritt, optionen)
  if (ansage) teile.push(ansage)
  return teile.join('\n\n')
}

/**
 * Liegt dieses Bild im eigenen Speicher?
 *
 * Dieselbe Schranke, die der Arbeiter zieht (`bildHolen` in
 * `worker/src/supabase.ts`): Er läuft auf Marks PC und erreicht damit alles im
 * Heimnetz. Fremde Adressen lehnt er ab — und zwar erst, nachdem der Auftrag
 * in der Warteschlange stand. Deshalb wird hier VORHER geprüft: Sonst reiht
 * die Kette drei Aufträge ein, von denen der erste sicher scheitert.
 *
 * `basis` ist herausgezogen, damit die Regel ohne Umgebungsvariablen prüfbar
 * ist.
 */
export function istEigenerSpeicher(
  url: string | null | undefined,
  basis: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): boolean {
  if (!url || !basis) return false
  return url.startsWith(`${basis}/storage/v1/object/public/`)
}

/**
 * Wo geht es weiter?
 *
 * `vorhanden` sagt je Schritt, ob die zugehörige Variante schon ein Bild hat.
 * `null` heißt: alle drei liegen vor, es ist nichts mehr zu tun.
 *
 * WARUM DAS NICHT EINFACH EIN ZÄHLER IST: Der Ablauf lebt im Browser. Schließt
 * Mark den Tab, steht die Kette — beim nächsten Öffnen ist der einzige
 * verlässliche Zeuge des Fortschritts, was tatsächlich in der Datenbank liegt.
 * Eine Lücke in der Mitte (Kopf da, Körper fehlt, Referenzsheet da) ist dabei
 * möglich, wenn ein Blatt einzeln erzeugt wurde: Dann wird die LÜCKE gefüllt,
 * nicht das Ende — sonst fehlte dem Referenzsheet für immer seine Vorlage.
 */
export function naechsterSchritt(
  vorhanden: Record<KettenSchritt, boolean>,
): KettenSchritt | null {
  return KETTEN_SCHRITTE.find(s => !vorhanden[s]) ?? null
}

/**
 * Alle noch offenen Schritte, in Kettenreihenfolge.
 *
 * Der Läufer arbeitet diese Liste ab. Weil sie der festen Reihenfolge folgt,
 * ist die Vorlage eines Schrittes immer schon erzeugt, wenn er an die Reihe
 * kommt — auch beim Wiederaufnehmen mitten in der Kette.
 */
export function offeneSchritte(
  vorhanden: Record<KettenSchritt, boolean>,
): KettenSchritt[] {
  return KETTEN_SCHRITTE.filter(s => !vorhanden[s])
}

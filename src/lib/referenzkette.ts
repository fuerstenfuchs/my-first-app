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
 * Woher die Referenzbilder eines Schrittes kommen.
 *
 * `'titelbild'` heißt: das Originalbild des Charakters. Alles andere ist ein
 * vorheriger Schritt der Kette.
 *
 * Der Körper bekommt AUSDRÜCKLICH NUR den erzeugten Kopf und nicht zusätzlich
 * das Original — Marks Antwort 2 vom 03.09.2026. Zwei Vorlagen desselben
 * Gesichts sind für das Bildmodell zwei verschiedene Gesichter.
 */
export const QUELLEN: Record<KettenSchritt, ('titelbild' | KettenSchritt)[]> = {
  kopf:          ['titelbild'],
  koerper:       ['kopf'],
  referenzsheet: ['kopf', 'koerper'],
}

/**
 * Was jedes mitgegebene Bild bedeutet — in derselben Reihenfolge, in der die
 * Bilder ans Modell gehen.
 *
 * WARUM NICHT `referenzZuordnung()` AUS `image-generation.ts`: Die kennt nur
 * die Rollen Charakter/Outfit/Location und würde beim Referenzsheet zweimal
 * „CHARACTER — take the face … of this person" schreiben. Beim dritten Schritt
 * sind es aber zwei verschiedene Aufgaben: aus dem einen Bild kommt das
 * Gesicht, aus dem anderen der Körperbau. Am 01.09.2026 ist genau diese Sorte
 * fehlender Zuordnung schon einmal teuer geworden — das Modell nahm die Person
 * aus dem falschen Bild. Also wird sie hier je Schritt ausbuchstabiert.
 */
const ANSAGE: Record<'titelbild' | KettenSchritt, string> = {
  titelbild:     'ORIGINAL PHOTO OF THE PERSON — take the face, hair, skin tone and identity from it.',
  kopf:          'HEAD REFERENCE SHEET — take the face, hair and skin tone from it. It shows the same person from several angles.',
  koerper:       'BODY REFERENCE SHEET — take the body proportions, build and posture from it. The face in it is secondary; the head reference above decides the face.',
  referenzsheet: 'COMBINED REFERENCE SHEET — face, front and back of the same person.',
}

/**
 * Der Zuordnungsblock für einen Schritt — oder null, wenn er keinen braucht.
 *
 * Auch bei EINEM Bild nötig: Der ursprüngliche Fehler war nicht die
 * Verwechslung zweier Bilder, sondern die Frage, welchen Aspekt eines Bildes
 * das Modell übernimmt.
 */
export function referenzAnsage(schritt: KettenSchritt): string | null {
  const quellen = QUELLEN[schritt]
  if (quellen.length === 0) return null
  return [
    'REFERENCE IMAGES — they arrive in this exact order:',
    ...quellen.map((q, i) => `Image ${i + 1} = ${ANSAGE[q]}`),
    'If the text above describes the person differently, follow the reference images and ignore the conflicting words.',
  ].join('\n')
}

/**
 * Der fertige Prompt eines Schrittes.
 *
 * Der Sheet-Prompt selbst bleibt UNANGETASTET — angehängt wird nur die
 * Zuordnung. Das ist dieselbe Trennung wie in `promptFuerAuftrag()`: Es gibt
 * genau eine Stelle, die den Prompt anfasst, und sie ist prüfbar.
 */
export function kettenPrompt(schritt: KettenSchritt, basis: string): string {
  const ansage = referenzAnsage(schritt)
  return ansage ? `${basis}\n\n${ansage}` : basis
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

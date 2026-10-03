import type { AspectRatioKey } from './scene-builder-options'

/**
 * Bildgenerierung — was das Modell kann und was Trésor daraus macht.
 *
 * Am 01.09.2026 am laufenden Proxy nachgemessen, nicht aus der Dokumentation
 * abgeschrieben. Zwei Befunde, die hier festgehalten sind, weil sie die
 * Oberfläche bestimmen:
 *
 * 1. gpt-image-2 kennt nur drei Größen. Trésor bietet fünf Bildformate.
 * 2. Der Parameter `size` wirkt NUR ohne Referenzbild. Mit Referenz
 *    (/v1/images/edits) richtet sich das Ergebnis nach dem Referenzbild —
 *    eine Anfrage über 1024x1024 kam als 1122x1402 zurück. Wer mit Referenz
 *    ein bestimmtes Format will, muss es in den Prompt schreiben.
 */

/*
  DIE DREI SPIELARTEN VON GPT IMAGE 2.5 (11.09.2026).

  Mark am 11.09.2026: „Kannst Du ab sofort als erstes Bildmodell im Proxy GPT
  Image zwei Punkt fünf sunburst nehmen." Seine globale Regel nennt seit dem
  10.09. dasselbe — dort steht `gpt-image-2.5-sunburst` als Vorgabe, nachdem er
  eine Messreihe über 15 Bilder gesehen hat.

  Was die drei unterscheiden (aus seiner Messreihe, nicht aus einer
  Beschreibung):
   · sunburst — wärmer und heller, ruhigere Nacht. SEINE WAHL.
   · 2.5      — neutral und dokumentarisch, am besten für Gesichter.
   · flare    — mehr Kontrast und Sättigung, für Tageslicht und Produkte.

  In der Geschwindigkeit trennt sie nichts: 37,2 / 38,6 / 38,4 Sekunden im
  Mittel — die Streuung EINES Modells ist mit 24 Sekunden siebzehnmal größer
  als der Abstand zwischen ihnen.

  `kannReferenzen: true` ist nicht geraten: Die KI-Zentrale fährt seit dem
  10.09. mit `gpt-image-2.5-sunburst` und schickt Referenzbilder als `image[]`
  an `/v1/images/edits` — dieselbe Familie, derselbe Weg wie bei gpt-image-2.

  UNGEMESSEN GEBLIEBEN: ob 2.5 mehr als die drei Größen von gpt-image-2 kennt.
  Das ließe sich nur mit einer bezahlten Erzeugung feststellen. Die
  Größenzuordnung unten bleibt deshalb, wie sie war — sie stimmt für die
  Familie, und zu wenig Formate anzubieten ist der harmlosere Fehler.
*/
export const MODELLE = [
  {
    id: 'gpt-image-2.5-sunburst', label: 'GPT Image 2.5 Sunburst',
    note: 'Standard — wärmer und heller, ruhigere Nacht',
    kannReferenzen: true,
  },
  {
    id: 'gpt-image-2.5', label: 'GPT Image 2.5',
    note: 'Neutral und dokumentarisch — am besten für Gesichter',
    kannReferenzen: true,
  },
  {
    id: 'gpt-image-2.5-flare', label: 'GPT Image 2.5 Flare',
    note: 'Mehr Kontrast und Sättigung — Tageslicht und Produkte',
    kannReferenzen: true,
  },
  {
    // Bleibt in der Liste, ist aber nicht mehr die Vorgabe: In der
    // Warteschlange stehen Aufträge mit dieser Kennung, und ein Eintrag, den
    // die Anzeige nicht mehr auflösen kann, sähe dort aus wie ein Fehler.
    id: 'gpt-image-2', label: 'GPT Image 2',
    note: 'Vorgänger — folgt Referenzbildern treu',
    kannReferenzen: true,
  },
  {
    // = „Nano Banana Pro". Laut Marks Angabe das beste der Reihe:
    // Studioqualität, präzise Schrift, 4K. Der Proxy KENNT das Modell (es steht
    // in seinem Katalog), gibt es aber nur über einen Gemini-API-Schlüssel
    // frei — Marks antigravity-Anmeldung führt es nicht. Ohne Schlüssel
    // scheitert der Auftrag mit „unknown provider for model".
    // Gemessen am 02.09.2026: 36 Modelle aus drei Anbietern (anthropic 15,
    // antigravity 11, openai 10) — kein Anbieter vom Typ `gemini`.
    id: 'gemini-3-pro-image',
    label: 'Nano Banana Pro (Gemini 3 Pro Image)',
    note: 'Beste Qualität — braucht einen Gemini-Schlüssel im Proxy',
    kannReferenzen: false,
  },
  {
    // Das kleinste und schnellste der Reihe (~8 s). Ebenfalls nur mit
    // Gemini-Schlüssel. UNGEPRÜFT: ob es `imageSize` (1K/2K/4K) überhaupt
    // annimmt — die Pro-Reihe tut es, bei 2.5 Flash konnte ich es ohne
    // Schlüssel nicht messen. Sollte es ablehnen, steht der Grund als
    // Fehlertext in der Warteschlange.
    id: 'gemini-2.5-flash-image',
    label: 'Nano Banana (Gemini 2.5 Flash Image)',
    note: 'Schnell und einfach — braucht einen Gemini-Schlüssel im Proxy',
    kannReferenzen: false,
  },
  {
    id: 'gemini-3.1-flash-image',
    label: 'Gemini 3.1 Flash Image',
    note: 'Alle sieben Formate, bis 4K — läuft ohne Zusatzschlüssel',
    // Der nativen Gemini-Anbindung werden nur Prompt und Format übergeben.
    // Referenzbilder gingen dort lautlos verloren, während der Prompt weiter
    // „Image 1 = CHARACTER …" diktiert — das Ergebnis wäre eine erfundene
    // Person, und in der Warteschlange stünde trotzdem „2 Ref.". Deshalb
    // steht das hier als DATUM und nicht als Hinweistext: Eine Notiz, die im
    // Scene Builder gar nicht gerendert wird, schützt niemanden.
    kannReferenzen: false,
  },
  /*
    LOKALE MODELLE — der neue PC (RTX 5060 Ti), Mark am 01.10.2026 / 03.10.2026.

    Der Proxy bleibt der Standardweg: Diese Einträge stehen bewusst HINTER allen
    Proxy-Modellen, die Vorgabe bleibt `MODELLE[0]`. Lokal ist für das, was der
    Proxy ablehnt, oder wenn Mark ausdrücklich „lokal" will. Kosten: nur Strom.

    Die Vorsilbe `lokal:` ist die Weiche: Der Arbeiter schickt solche Aufträge
    NIE an den Proxy und die übrigen NIE an den neuen PC (worker/src/lokal.ts).
    Was gemessen wurde: werkzeuge/arbeiter-neuer-pc/BILDMODELLE.md im Fuchsbau.

    Ergebnisse brauchen keinen Umweg: Der Arbeiter holt die Referenzen aus
    Supabase, rechnet im Heimnetz und legt das fertige Bild wie jedes andere ab.
  */
  {
    id: 'lokal:qwen21', label: 'Lokal · Qwen-Image 2.1',
    note: 'Neuer PC — beste Ähnlichkeit (Personen, Tiere, Dinge) · nur nichtkommerziell',
    kannReferenzen: true,
  },
  {
    id: 'lokal:klein9b', label: 'Lokal · FLUX.2 klein 9B',
    note: 'Neuer PC — schönes Licht und Haut, Ähnlichkeit schwächer · nur nichtkommerziell',
    kannReferenzen: true,
  },
  {
    id: 'lokal:klein4b', label: 'Lokal · FLUX.2 klein 4B',
    note: 'Neuer PC — schnell, Ähnlichkeit schwach',
    kannReferenzen: true,
  },
  {
    id: 'lokal:sdxl_instantid', label: 'Lokal · SDXL + InstantID',
    note: 'Neuer PC — starkes Gesicht, nur Nahaufnahmen, genau EIN Referenzbild',
    kannReferenzen: true,
  },
] as const

export type ModellId = typeof MODELLE[number]['id']

/** Läuft dieses Modell auf dem neuen PC statt über den Proxy? */
export function istLokal(modell: string): boolean {
  return modell.startsWith('lokal:')
}

/** Wie viele Referenzbilder ein lokales Modell nimmt: [wenigstens, höchstens]. Gleich wie im Arbeiter. */
const LOKAL_REFERENZEN: Record<string, readonly [number, number]> = {
  'lokal:qwen21': [0, 4],
  'lokal:klein9b': [0, 4],
  'lokal:klein4b': [0, 4],
  'lokal:sdxl_instantid': [1, 1],
}

/**
 * Passt dieses Modell zu dieser Zahl von Referenzbildern?
 *
 * Proxy-Modelle: `kannReferenzen` entscheidet nur, OB welche mitgehen dürfen.
 * Lokale Modelle haben zusätzlich Grenzen nach oben und unten — SDXL+InstantID
 * braucht genau eines, die anderen höchstens vier. Eine Absage hier erspart
 * Mark, erst in der Warteschlange davon zu erfahren.
 */
export function passtZuReferenzen(modell: ModellId, anzahl: number): boolean {
  const m = MODELLE.find(x => x.id === modell)
  if (!m) return false
  if (anzahl > 0 && !m.kannReferenzen) return false
  const grenzen = LOKAL_REFERENZEN[modell]
  return grenzen ? anzahl >= grenzen[0] && anzahl <= grenzen[1] : true
}

/*
  DIE DREI AUFLÖSUNGSSTUFEN der lokalen Modelle (Mark, 03.10.2026): „Zwei
  Megapixel als neuen Standard. Wahlweise ein Megapixel. Und wahlweise die
  höchste Auflösung, 4,7 Megapixel — überall, im Trésor und im Fuchsbau."

  Gemessen an einem Ganzkörperbild (Qwen 2.1, 2 Referenzen): 1 MP 91 s · 2,2 MP
  164 s · 4,7 MP 389 s. Mehr Pixel im Gesicht machen Iris und Pupille rund und
  klar; die Zeit wächst ungefähr mit den Pixeln. Dieselbe Tabelle steht im
  Fuchsbau (src/anbieter/lokal.ts) und die Grenzen im Arbeiter.
*/
export const LOKAL_STUFEN = [
  { id: 'schnell',  label: '1 MP · schnell',                    mp: 1.0 },
  { id: 'standard', label: '2 MP · Standard',                   mp: 2.2 },
  { id: 'maximal',  label: 'bis 4,7 MP · maximal, 6–7 Min je Bild', mp: 4.7 },
] as const
export type LokalStufe = typeof LOKAL_STUFEN[number]['id']
export const LOKAL_STUFE_VORGABE: LokalStufe = 'standard'

/** Obergrenze je Seite im Arbeiter (zusammen höchstens 5 Megapixel). */
const LOKAL_MAX_SEITE = 2816

/** Seitenverhältnis ("16:9") und Stufe → Pixel, durch 16 teilbar. */
export function lokaleMasse(verhaeltnis: string, stufe: LokalStufe): [number, number] {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(verhaeltnis)
  const r = m && Number(m[1]) > 0 && Number(m[2]) > 0 ? Number(m[1]) / Number(m[2]) : 2 / 3
  const mp = LOKAL_STUFEN.find(s => s.id === stufe)?.mp ?? 2.2
  let h = Math.sqrt((mp * 1e6) / r)
  let w = h * r
  const gross = Math.max(w, h)
  if (gross > LOKAL_MAX_SEITE) { w *= LOKAL_MAX_SEITE / gross; h *= LOKAL_MAX_SEITE / gross }
  const auf16 = (x: number) => Math.max(512, Math.round(x / 16) * 16)
  return [auf16(w), auf16(h)]
}

/** Wenn kein Format gewählt ist, gilt das Verhältnis der gpt-Größe des Auftrags. */
const GPT_VERHAELTNIS: Record<string, string> = { '1024x1024': '1:1', '1536x1024': '3:2', '1024x1536': '2:3' }

/**
 * Die Größe, die ein lokales Modell WIRKLICH rechnet — für die Anzeige und den
 * Auftrag. Die gpt-Größe daneben stehen zu lassen, wäre falsch: Dort steht
 * 1536x1024, gerechnet werden z. B. 1824x1216 (Stufe Standard).
 *
 * SDXL + InstantID bleibt immer bei einem Megapixel: darüber wiederholt SDXL
 * Bildteile.
 */
/** SDXL rechnet in den Maßen, mit denen es trainiert wurde (1024er-Raster), nicht in den Stufen. */
const SDXL_MASSE: Record<string, string> = {
  '1:1': '1024x1024', '16:9': '1344x768', '9:16': '768x1344', '4:3': '1152x864', '3:4': '864x1152',
  '3:2': '1216x832', '2:3': '832x1216', '4:5': '896x1088', '21:9': '1536x640',
}

/** Haben die Stufen bei diesem Modell eine Wirkung? SDXL bleibt immer bei einem Megapixel. */
export function hatStufen(modell: string): boolean {
  return istLokal(modell) && modell !== 'lokal:sdxl_instantid'
}

export function lokaleGroesse(
  format: string | null | undefined, gptGroesse: string,
  stufe: LokalStufe = LOKAL_STUFE_VORGABE, modell?: string,
): string {
  const m = /(\d+)_(\d+)$/.exec(format ?? '')
  const verhaeltnis = m ? `${m[1]}:${m[2]}` : (GPT_VERHAELTNIS[gptGroesse] ?? '1:1')
  if (modell === 'lokal:sdxl_instantid') return SDXL_MASSE[verhaeltnis] ?? '1024x1024'
  const [w, h] = lokaleMasse(verhaeltnis, stufe)
  return `${w}x${h}`
}

/**
 * Wohin die Auswahl springt, wenn das gewählte Modell nicht mehr passt.
 *
 * Ein lokales Modell wird durch ein lokales ersetzt, nie durch den Proxy: Lokal
 * ist gerade für das da, was der Proxy ablehnt — ein stiller Wechsel dorthin
 * wäre der Ersatz, den die Zwei-Wege-Regel ausschließt (Critic, 03.10.2026).
 */
export function ersatzModell(aktuell: ModellId, anzahl: number): ModellId {
  if (istLokal(aktuell)) {
    const lokal = modelleFuer(anzahl).find(m => istLokal(m.id))
    if (lokal) return lokal.id
  }
  return 'gpt-image-2.5-sunburst'
}

/** Die Modelle, die zu dieser Zahl von Referenzbildern passen. */
export function modelleFuer(anzahl: number) {
  return MODELLE.filter(m => passtZuReferenzen(m.id, anzahl))
}

/** Die Modelle, die Referenzbilder verarbeiten können. */
export const MODELLE_MIT_REFERENZ = MODELLE.filter(m => m.kannReferenzen)

export function kannReferenzen(modell: ModellId): boolean {
  return MODELLE.find(m => m.id === modell)?.kannReferenzen ?? false
}

/**
 * Rechnet dieses Modell in Größenklassen statt in Pixeln?
 *
 * Gemini kennt kein `size`. Es nimmt Seitenverhältnis plus Größenklasse
 * (1K/2K/4K) — am 02.09.2026 gemessen. Und es ist auf `/v1/images/generations`
 * gar nicht erreichbar, sondern nur über den nativen Weg; der Arbeiter
 * verzweigt entsprechend.
 */
export function rechnetInKlassen(modell: ModellId): boolean {
  return modell.startsWith('gemini')
}

/** Die Größenklassen, die für ein erzeugtes Bild sinnvoll sind. */
export const KLASSEN = [
  { id: '1K', label: '1K', note: 'ca. 1 MP' },
  { id: '2K', label: '2K', note: 'ca. 4 MP' },
  { id: '4K', label: '4K', note: 'ca. 17 MP' },
] as const
export type KlassenId = typeof KLASSEN[number]['id']

/**
 * Was für ein Format tatsächlich herauskommt — je nach Modell verschieden.
 *
 * Der Unterschied ist groß, aber nicht so groß wie „exakt gegen ungenau":
 *
 * - gpt-image-2 kennt nur DREI Größen. 16:9 wird zu 3:2 (1,50 statt 1,78),
 *   9:16 zu 2:3 — das sind 16 Prozent daneben.
 * - Gemini kennt alle sieben Verhältnisse, trifft sie aber auch nicht auf die
 *   Stelle: Am 02.09.2026 gemessen ergab 16:9 ein Bild von 2752×1536, also
 *   1,7917 statt 1,7778 — 0,78 Prozent zu breit.
 *
 * Hier stand zuerst „exakt". Der erste echte Lauf hat das widerlegt, und eine
 * Formatangabe, die 0,8 Prozent verschweigt, ist genau die Sorte Zusage, an
 * der man sich später stößt.
 */
export function formatHinweis(
  modell: ModellId, format: AspectRatioKey | null, stufe: LokalStufe = LOKAL_STUFE_VORGABE,
): string {
  if (istLokal(modell)) return lokaleGroesse(format, groesseFuerFormat(format).size, stufe, modell).replace('x', '×')
  if (rechnetInKlassen(modell)) return 'auf ~1 % genau'
  const z = groesseFuerFormat(format)
  return z.hinweis ?? z.size
}

/** Die drei Größen, die gpt-image-2 tatsächlich annimmt. */
export const NATIVE_GROESSEN = ['1024x1024', '1536x1024', '1024x1536'] as const
export type NativeGroesse = typeof NATIVE_GROESSEN[number]

type FormatZuordnung = {
  size: NativeGroesse
  /** true, wenn das Trésor-Format genau einer nativen Größe entspricht. */
  exakt: boolean
  hinweis?: string
}

const ZUORDNUNG: Record<AspectRatioKey, FormatZuordnung> = {
  square_1_1:      { size: '1024x1024', exakt: true },
  landscape_16_9:  { size: '1536x1024', exakt: false, hinweis: 'wird 3:2 — nächstliegende Größe' },
  story_9_16:      { size: '1024x1536', exakt: false, hinweis: 'wird 2:3 — nächstliegende Größe' },
  portrait_4_5:    { size: '1024x1536', exakt: false, hinweis: 'wird 2:3 — etwas höher als 4:5' },
  cinematic_21_9:  { size: '1536x1024', exakt: false, hinweis: 'wird 3:2 — deutlich weniger breit als 21:9' },
  // 4:3 ist 1,333, die nächstliegende native Größe 1536x1024 ist 1,5 —
  // spürbar breiter. 3:4 entsprechend bei 1024x1536.
  classic_4_3:     { size: '1536x1024', exakt: false, hinweis: 'wird 3:2 — breiter als 4:3' },
  classic_3_4:     { size: '1024x1536', exakt: false, hinweis: 'wird 2:3 — höher als 3:4' },
}

/** Ohne gewähltes Format: quadratisch, die einzige Größe ohne Richtungsannahme. */
export const GROESSE_VORGABE: NativeGroesse = '1024x1024'

export function groesseFuerFormat(format: AspectRatioKey | null): FormatZuordnung {
  if (!format) return { size: GROESSE_VORGABE, exakt: true }
  return ZUORDNUNG[format] ?? { size: GROESSE_VORGABE, exakt: true }
}

/**
 * Sobald Referenzbilder mitgehen, ignoriert das Modell `size`. Dann hilft nur
 * eine Ansage im Prompt. Diese Zeile wird an den fertigen Prompt angehängt —
 * die Prompt-Erzeugung des Scene Builders selbst bleibt unangetastet.
 */
const FORMAT_ANSAGE: Record<AspectRatioKey, string> = {
  square_1_1:     'Output a SQUARE 1:1 image frame.',
  landscape_16_9: 'Output a WIDE 16:9 CINEMATIC LANDSCAPE frame.',
  story_9_16:     'Output a TALL 9:16 VERTICAL frame.',
  portrait_4_5:   'Output a VERTICAL 4:5 PORTRAIT frame.',
  classic_4_3:    'Output a CLASSIC 4:3 LANDSCAPE frame.',
  classic_3_4:    'Output a CLASSIC 3:4 VERTICAL frame.',
  cinematic_21_9: 'Output an ULTRA-WIDE 21:9 CINEMASCOPE frame.',
}

export function formatAnsage(format: AspectRatioKey | null): string | null {
  return format ? FORMAT_ANSAGE[format] ?? null : null
}

/**
 * Der fertige Zuordnungsblock — genau der Text, der an den Prompt gehängt wird.
 *
 * WARUM ALS EIGENE FUNKTION (PROJ-85): Der Bilddialog zeigt unter „Zusätze im
 * Prompt ansehen" an, was zusätzlich mitgeht. Baute er sich das selbst
 * zusammen, zeigte er bei eigenen Zuordnungszeilen weiter die allgemeine
 * Fassung — eine Vorschau, die etwas anderes verspricht als das, was
 * abgeschickt wird. Beide lesen jetzt aus derselben Quelle.
 */
export function zuordnungsBlock(
  rollen: ReferenzRolle[],
  zuordnungTexte?: string[],
  vorrangText?: string,
): string | null {
  if (!zuordnungTexte?.length) return referenzZuordnung(rollen)
  return [
    'REFERENCE IMAGES — they arrive in this exact order:',
    ...zuordnungTexte.map((z, i) => `Image ${i + 1} = ${z}`),
    vorrangText ?? vorrangSatz(rollen),
  ].join('\n')
}

/**
 * Den fertigen Prompt für den Auftrag zusammensetzen.
 *
 * Der Prompt des Scene Builders wird NICHT verändert — angehängt wird nur die
 * Formatansage, und auch die nur, wenn Referenzbilder mitgehen. Ohne Referenz
 * wirkt der Größenparameter, dann ist die Ansage überflüssig.
 *
 * Als eigene Funktion statt im Knopf, damit sie ohne Oberfläche prüfbar ist:
 * Es ist die einzige Stelle im ganzen Vorhaben, die den Prompt anfasst.
 */
export function promptFuerAuftrag(
  prompt: string, format: AspectRatioKey | null, rollen: ReferenzRolle[],
  /*
    EIGENE ZUORDNUNGSZEILEN — für Fälle, in denen dieselbe Rolle mehrfach
    vorkommt (PROJ-78).

    Die Standardzeilen sagen „Image 1 = CHARACTER, Image 2 = CHARACTER". Bei
    zwei Personen mit je eigenem Outfit ist das wertlos: Nichts darin verbindet
    das dritte Bild mit der ersten Person. Das Modell rät — und rät falsch, die
    Jacke landet bei der Falschen.

    Wer hier eigene Zeilen mitgibt, benennt jedes Bild einzeln. Die Reihenfolge
    muss zu `reference_urls` passen; das ist die Verantwortung des Aufrufers.
  */
  zuordnungTexte?: string[],
  /*
    EIGENER VORRANGSATZ (PROJ-84).

    Der Standardsatz sagt: „Beschreibt der Text die Person anders, folge dem
    Referenzbild und ignoriere die widersprechenden Worte." Fuer ein einzelnes
    Portraet ist das richtig — wer ein Gesicht anhaengt, will genau dieses.

    Bei einem GRUPPENBLATT kehrt derselbe Satz sich gegen den Prompt: Das Bild
    zeigt die Leute aufrecht nebeneinander, der Text verlangt kauern, sitzen,
    gestaffelt stehen. Der Standardsatz wiese das Modell an, im Zweifel dem
    Blatt zu folgen — und die ganze Konstellation waere ausgehebelt.

    Wer hier etwas mitgibt, engt den Vorrang ein, statt ihn zu streichen: Das
    Bild entscheidet weiterhin, WER jemand ist; der Text, WO und WIE er steht.
  */
  vorrangText?: string,
): string {
  const mitReferenz = rollen.length > 0
  const teile = [prompt]

  // Zuerst die Zuordnung: Sie sagt, welches Bild wofür steht. Ohne sie nimmt
  // das Modell schon mal die Person aus dem Outfit-Bild.
  const zuordnung = zuordnungsBlock(rollen, zuordnungTexte, vorrangText)
  if (zuordnung) teile.push(zuordnung)

  // Die Formatansage nur mit Referenz — ohne Referenz wirkt der Größenparameter.
  if (mitReferenz) {
    const ansage = formatAnsage(format)
    if (ansage) teile.push(ansage)
  }

  return teile.join('\n\n')
}

/**
 * Referenzbilder — wer ist was.
 *
 * Am 01.09.2026 an einem echten Ergebnis gesehen: Bei Charakter + Outfit
 * übernahm gpt-image-2 die Person aus dem OUTFIT-Bild statt aus dem
 * Charakterbild. Die Ursache war nicht der Prompt, sondern die fehlende
 * Zuordnung — die Bilder gingen unbeschriftet als image[] mit, und die Sätze
 * „Use the provided character reference." / „…outfit reference." sagen nicht,
 * welches Bild gemeint ist. Das Modell hat geraten.
 *
 * Deshalb geht jetzt eine ausdrückliche Zuordnung mit, in derselben Reihenfolge
 * wie die Bilder. Positiv formuliert (nehmen, nicht verbieten) — gpt-image-2
 * folgt Positiv-Listen zuverlässiger als Verboten.
 */
export type ReferenzRolle = 'character' | 'outfit' | 'location'

export type Referenz = { url: string; rolle: ReferenzRolle }

export const ROLLEN_ANWEISUNG: Record<ReferenzRolle, string> = {
  character: 'CHARACTER — take the face, hair, skin tone and body identity of this person.',
  outfit:    'OUTFIT — take only the garments, their cut, fabric and colour. The person wearing them in this image is a mannequin for the clothes, not the subject.',
  location:  'LOCATION — take only the setting and architecture of this place. Lighting, time of day and weather are defined in the text above, not by this image.',
}

export const ROLLEN_LABEL: Record<ReferenzRolle, string> = {
  character: 'Charakter',
  outfit:    'Outfit',
  location:  'Location',
}

/**
 * Der Zuordnungsblock, der dem Modell sagt, welches Bild wofür steht.
 *
 * Auch bei EINEM Bild nötig — der ursprüngliche Fehler war nicht die
 * Verwechslung zweier Bilder, sondern die Frage, welchen Aspekt eines Bildes
 * das Modell nimmt. Ein einzelnes Outfit-Foto mit Person darin führt ohne
 * Ansage genauso zur falschen Person wie zwei Bilder.
 */
export function referenzZuordnung(rollen: ReferenzRolle[]): string | null {
  if (rollen.length === 0) return null
  const zeilen = rollen.map((rolle, i) => `Image ${i + 1} = ${ROLLEN_ANWEISUNG[rolle]}`)
  return [
    'REFERENCE IMAGES — they arrive in this exact order:',
    ...zeilen,
    vorrangSatz(rollen),
  ].join('\n')
}

/**
 * Was gilt, wenn der Prompt etwas anderes beschreibt als das Referenzbild zeigt?
 *
 * Ohne Ansage entscheidet das Modell selbst — und das ist unvorhersehbar. Steht
 * im Prompt „blonde Frau, Mitte 30" und die Charakterreferenz zeigt einen
 * älteren Mann, kann beides herauskommen, auch eine Mischung.
 *
 * Festgelegt: Für den Aspekt, den ein Bild abdeckt, gewinnt das Bild. Alles
 * andere — Szene, Licht, Kamera, Stimmung — kommt weiter aus dem Text. Das ist
 * die Regel, die zum Zweck passt: Wer ein Referenzbild anhängt, will genau
 * diese Person, dieses Kleidungsstück, diesen Ort.
 */
function vorrangSatz(rollen: ReferenzRolle[]): string {
  const bereiche: string[] = []
  if (rollen.includes('character')) bereiche.push('the person')
  if (rollen.includes('outfit'))    bereiche.push('the clothing')
  if (rollen.includes('location'))  bereiche.push('the place')
  return (
    'If the text above describes ' + bereiche.join(' or ') +
    ' differently, follow the reference image for that aspect and ignore the ' +
    'conflicting words. Everything else — scene, lighting, camera, mood — ' +
    'comes from the text.'
  )
}

export const DURCHLAEUFE = [1, 2, 3, 4] as const
export type Durchlaeufe = typeof DURCHLAEUFE[number]

export type JobStatus = 'queued' | 'running' | 'done' | 'failed'

export const STATUS_TEXT: Record<JobStatus, string> = {
  queued:  'Wartet',
  running: 'Läuft',
  done:    'Fertig',
  failed:  'Fehlgeschlagen',
}

/*
  DIE ZUSTANDSFARBEN, GERECHNET FUER DEN BELEUCHTETEN TISCH (PROJ-65).

  Vorher: `-400`-Toene auf hellen Traegern, und `queued` sogar auf `bg-muted` —
  einem DECKENDEN, gruenstichigen Grau. Auf einer durchscheinenden Glasplatte
  las sich das als Loch, und „Wartet" ist der haeufigste Zustand einer
  Warteschlange.

  Gerechnet auf der Platte an ihrer hellsten Stelle: Die `-400`-Toene kamen auf
  2,4 bis 3,0, `failed` sogar auf 1,33 — unsichtbar. Die `-300`-Toene liegen
  bei 4,9 bis 5,4.
*/
export const STATUS_FARBE: Record<JobStatus, string> = {
  queued:  'bg-slate-400/15 text-slate-300',
  running: 'bg-blue-500/15 text-blue-300',
  done:    'bg-emerald-500/15 text-emerald-300',
  failed:  'bg-red-500/15 text-red-300',
}

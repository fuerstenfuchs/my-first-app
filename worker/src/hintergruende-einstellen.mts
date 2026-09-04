/**
 * Marks acht Studio-Hintergruende als Locations einstellen.
 *
 * EINMALIGER LAUF, aber WIEDERHOLBAR: Jeder Schritt prueft vorher, ob es die
 * Zeile schon gibt. Ein zweiter Aufruf legt nichts doppelt an.
 *
 * WARUM HIER IM ARBEITER UND NICHT ALS SQL: Die Bilder muessen in den
 * Speicher-Eimer hochgeladen werden, und dafuer braucht es den Dienstschluessel.
 * Der steht in `.env`, und `.env` ist fuer Claude gesperrt (CLAUDE.md). Der
 * Arbeiter liest ihn ueber `--env-file=.env` selbst ein — genau wie
 * `pruefen.ts`. So laeuft der Schluessel nie durch einen Chatverlauf.
 *
 * Aufruf:
 *   cd worker && node --env-file=.env src/hintergruende-einstellen.mts
 *
 * WARUM ZWEI VARIANTEN JE HINTERGRUND: `loadRefImages` beschriftet jedes
 * Referenzbild mit dem Namen seiner Variante. Zwei Varianten „Hochformat" und
 * „Quer 16:9" heisst also: Mark sieht im Referenz-Waehler beide Formate mit
 * Namen und nimmt das, das zu seiner Bildorientierung passt. Ein Studio-
 * Portraet ist hochkant, eine liegende Person quer — Mark am 04.09.2026.
 */

import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { config, ohneGeheimnis } from './config.ts'

const USER_ID = '9df10e22-9b6f-477e-9000-bd99097eb198'
const EIMER = 'location-images'
const ORDNER = 'C:/Users/markg/Documents/Claude-Bilder/studio-hintergruende'
const KATEGORIE = 'studio-hintergrund'

/** Das Merkmal, an dem ein zweiter Lauf seine eigenen Zeilen wiedererkennt. */
const HERKUNFT = 'studio-hintergruende-2026-09-04'

const HINTERGRUENDE: { datei: string; name: string; beschreibung: string; tags: string[] }[] = [
  { datei: 'braun-marmoriert', name: 'Braun marmoriert',
    beschreibung: 'Klassischer Old-Master-Hintergrund in warmem Braun, nach aussen abdunkelnd, mit hellerem Kern hinter dem Kopf. Der Standard fuer warme Portraets.',
    tags: ['studio', 'braun', 'warm', 'old master', 'portrait'] },
  { datei: 'grau-marmoriert', name: 'Grau marmoriert',
    beschreibung: 'Neutraler grauer Studiokarton, gewischt, mit weichem Lichtkern. Faerbt die Haut nicht ein — die sichere Wahl, wenn die Kleidung Farbe traegt.',
    tags: ['studio', 'grau', 'neutral', 'portrait'] },
  { datei: 'blaugrau-marmoriert', name: 'Blaugrau mit Boden',
    beschreibung: 'Kuehler blaugrauer Hintergrund, der unten in einen Studioboden uebergeht. Fuer Ganzfiguren, bei denen der Boden mit ins Bild soll.',
    tags: ['studio', 'blaugrau', 'kuehl', 'boden', 'ganzfigur'] },
  { datei: 'beige-grunge', name: 'Beige Grunge',
    beschreibung: 'Helle beige Wand mit dunklen Abriebspuren und Kratzern, fast wie eine alte Leinwand. Hell genug fuer High-Key, mit Struktur.',
    tags: ['studio', 'beige', 'hell', 'grunge', 'vintage'] },
  { datei: 'kupfer-patina', name: 'Kupfer-Patina',
    beschreibung: 'Rostbraune Metallflaeche mit gruenspaniger Patina. Der farbigste der Kartons — traegt ein Bild allein und passt zu Erdtoenen.',
    tags: ['studio', 'kupfer', 'patina', 'gruen', 'rost', 'farbig'] },
  { datei: 'ziegelwand-holzboden', name: 'Ziegelwand mit Holzboden',
    beschreibung: 'Hell verputzte Ziegelwand mit hellem Dielenboden. Kein Karton, sondern ein Raum mit Fluchtlinien — die Person steht darin, statt davor.',
    tags: ['raum', 'ziegel', 'holzboden', 'loft', 'hell', 'ganzfigur'] },
  { datei: 'retro-kreise-muster', name: 'Retro-Kreise, durchgehend',
    beschreibung: 'Siebziger-Jahre-Tapete in Gelb, Orange und Braun, gleichmaessig ueber die ganze Flaeche. Achtung: Der Ausschnitt bestimmt, wie gross die Kreise neben der Person wirken.',
    tags: ['retro', '70er', 'muster', 'gelb', 'orange', 'tapete'] },
  { datei: 'retro-kreise-verlauf', name: 'Retro-Kreise, auslaufend',
    beschreibung: 'Dieselben Siebziger-Kreise, aber nach unten in ruhiges Braun auslaufend. Laesst unten Platz fuer die Person, ohne dass das Muster mit ihr konkurriert.',
    tags: ['retro', '70er', 'muster', 'verlauf', 'gelb', 'braun'] },
]

const VARIANTEN = [
  { schluessel: 'original', name: 'Hochformat', hinweis: 'Der Karton, wie er haengt. Fuer Studio-Portraets.' },
  { schluessel: '16zu9',    name: 'Quer 16:9',  hinweis: 'Querformatiger Ausschnitt. Fuer liegende Posen und filmische Bilder.' },
]

const kopf = {
  apikey: config.supabaseKey,
  Authorization: `Bearer ${config.supabaseKey}`,
}

async function rest(pfad: string, init: RequestInit = {}): Promise<unknown> {
  const antwort = await fetch(`${config.supabaseUrl}/rest/v1/${pfad}`, {
    ...init,
    headers: { ...kopf, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(60_000),
  })
  const text = await antwort.text()
  if (!antwort.ok) throw new Error(ohneGeheimnis(`${pfad} → HTTP ${antwort.status}: ${text.slice(0, 300)}`))
  return text ? JSON.parse(text) : null
}

/** Ein Bild in den Eimer legen. Ueberschreibt, damit ein zweiter Lauf traegt. */
async function hochladen(lokal: string, ziel: string): Promise<string> {
  const daten = await readFile(lokal)
  const antwort = await fetch(
    `${config.supabaseUrl}/storage/v1/object/${EIMER}/${ziel}`,
    {
      method: 'POST',
      headers: { ...kopf, 'Content-Type': 'image/png', 'x-upsert': 'true' },
      body: new Uint8Array(daten),
      signal: AbortSignal.timeout(120_000),
    },
  )
  if (!antwort.ok) {
    throw new Error(ohneGeheimnis(
      `${basename(lokal)} nicht hochgeladen (HTTP ${antwort.status}): ${(await antwort.text()).slice(0, 200)}`))
  }
  return `${config.supabaseUrl}/storage/v1/object/public/${EIMER}/${ziel}`
}

async function main() {
  console.log('Studio-Hintergruende einstellen\n' + '='.repeat(50))

  // ── 1. Die eigene Kategorie ────────────────────────────────────────────────
  const vorhandeneKat = await rest(
    `custom_categories?scope=eq.location&key=eq.${KATEGORIE}&select=id`) as unknown[]
  if (vorhandeneKat.length === 0) {
    await rest('custom_categories', {
      method: 'POST',
      body: JSON.stringify({
        user_id: USER_ID, scope: 'location', key: KATEGORIE,
        label: 'Studio-Hintergrund', emoji: '🎞️',
      }),
    })
    console.log('Kategorie „Studio-Hintergrund" angelegt')
  } else {
    console.log('Kategorie „Studio-Hintergrund" gab es schon')
  }

  // ── 2. Die acht Hintergruende ──────────────────────────────────────────────
  let neu = 0, uebersprungen = 0
  for (const hg of HINTERGRUENDE) {
    const schon = await rest(
      `locations?select=id&metadata->>herkunft=eq.${HERKUNFT}&name=eq.${encodeURIComponent(hg.name)}`) as { id: string }[]
    if (schon.length > 0) {
      console.log(`  ${hg.name} — gab es schon, uebersprungen`)
      uebersprungen++
      continue
    }

    // Erst die Bilder, dann die Zeilen: Ein Fehlschlag beim Hochladen soll
    // keine Location ohne Bild hinterlassen.
    const urls: Record<string, string> = {}
    for (const v of VARIANTEN) {
      const lokal = `${ORDNER}/${hg.datei}-${v.schluessel}.png`
      urls[v.schluessel] = await hochladen(
        lokal, `${USER_ID}/studio-hintergruende/${hg.datei}-${v.schluessel}.png`)
    }

    const [loc] = await rest('locations', {
      method: 'POST',
      body: JSON.stringify({
        user_id: USER_ID,
        name: hg.name,
        description: hg.beschreibung,
        category: KATEGORIE,
        tags: hg.tags,
        cover_image_url: urls.original,
        metadata: { herkunft: HERKUNFT, quelle: 'Marks eigene Hintergruende, Produktfotos gesaeubert' },
      }),
    }) as { id: string }[]

    for (const [i, v] of VARIANTEN.entries()) {
      const [variante] = await rest('location_variants', {
        method: 'POST',
        body: JSON.stringify({
          location_id: loc.id, user_id: USER_ID,
          name: v.name, description: v.hinweis, sort_order: i,
        }),
      }) as { id: string }[]

      await rest('location_images', {
        method: 'POST',
        body: JSON.stringify({
          variant_id: variante.id, user_id: USER_ID,
          url: urls[v.schluessel],
          storage_path: `${USER_ID}/studio-hintergruende/${hg.datei}-${v.schluessel}.png`,
          sort_order: 0,
        }),
      })
    }

    console.log(`  ${hg.name} — angelegt, 2 Formate`)
    neu++
  }

  console.log('='.repeat(50))
  console.log(`Fertig: ${neu} neu, ${uebersprungen} schon vorhanden.`)
}

main().catch(f => {
  console.error('FEHLGESCHLAGEN:', f instanceof Error ? f.message : f)
  process.exit(1)
})

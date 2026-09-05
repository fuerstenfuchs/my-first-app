/**
 * Erzeugt kleine Vorschaubilder für alle Bilder im Speicher (PROJ-68).
 *
 * WARUM: Mark am 05.09.2026: „Mir ist nur aufgefallen, dass alle Bilder immer
 * sehr lange brauchen zu laden. Werden da immer die Originalbilder geladen?"
 *
 * Ja, wurden sie. Nachgemessen im Speicher:
 *   661 PNG  = 1709 MB   (428 davon über 2 MB, zehn über 10 MB)
 *   521 JPEG =  151 MB
 * Ein einzelnes PNG war 38 MB groß und brauchte 35 Sekunden. In einem Raster
 * mit achtzig Kacheln à 132 Pixel lädt der Browser damit Hunderte Megabyte,
 * um Daumennägel zu zeigen.
 *
 * WARUM NICHT DIE UMWANDLUNG VON SUPABASE: Deren Bilddienst
 * (`/render/image/...`) antwortet auf diesem Tarif mit HTTP 403 — nachgemessen,
 * nicht vermutet.
 *
 * WARUM NICHT DER BILDDIENST VON VERCEL: Der rechnet nach verarbeiteten
 * Quellbildern ab. Bei rund 1200 Dateien wäre das eine laufende Kostenfrage,
 * und laufende Kosten entscheidet Mark, nicht ich.
 *
 * ALSO SELBST GEMACHT: Der Arbeiter hat `sharp` ohnehin an Bord und läuft auf
 * Marks PC. Die Vorschau kostet nichts außer etwas Speicherplatz — rund 60 kB
 * je Bild statt 3 MB.
 *
 * ES WIRD NICHTS ÜBERSCHRIEBEN. Die Vorschau liegt neben dem Original unter
 * `vorschau/<pfad>.jpg`. Wer sie löscht, verliert nichts.
 *
 * Der Lauf ist WIEDERHOLBAR: Was schon eine Vorschau hat, wird übersprungen.
 * Ein Abbruch ist deshalb harmlos.
 *
 * Aufruf:
 *   cd worker && node --env-file=.env src/vorschaubilder.mts [eimer …]
 */

import sharp from 'sharp'
import { config } from './config.ts'

/** Breite der Vorschau. 480 reicht für jede Kachel und jedes Regal. */
const BREITE = 480
const GUETE = 72
export const VORSCHAU_PRAEFIX = 'vorschau/'

const EIMER = process.argv.slice(2).filter(a => !a.startsWith('--'))
const ALLE = [
  'generated-images', 'character-images', 'prompt-media', 'visual-assets',
  'location-images', 'outfit-images', 'fashion-assets', 'pose-action-images',
  'prompt-covers', 'location-archetype-images', 'outfit-archetype-images',
  'character-archetype-images',
]
const ZU_TUN = EIMER.length ? EIMER : ALLE

const kopf = { apikey: config.supabaseKey, Authorization: `Bearer ${config.supabaseKey}` }

type Eintrag = { name: string; metadata?: { size?: number; mimetype?: string } | null }

/** Blättert einen Eimer durch — die Liste liefert höchstens 100 auf einmal. */
async function alleDateien(eimer: string, ordner = ''): Promise<Eintrag[]> {
  const raus: Eintrag[] = []
  let versatz = 0
  for (;;) {
    const antwort = await fetch(`${config.supabaseUrl}/storage/v1/object/list/${eimer}`, {
      method: 'POST',
      headers: { ...kopf, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: ordner, limit: 100, offset: versatz }),
    })
    if (!antwort.ok) {
      console.error(`  ${eimer}: Liste fehlgeschlagen (HTTP ${antwort.status})`)
      return raus
    }
    const teil = await antwort.json() as Eintrag[]
    if (teil.length === 0) break
    for (const e of teil) {
      // Ordner haben keine Metadaten — in sie hinein.
      if (!e.metadata) {
        raus.push(...await alleDateien(eimer, ordner ? `${ordner}/${e.name}` : e.name))
      } else {
        raus.push({ ...e, name: ordner ? `${ordner}/${e.name}` : e.name })
      }
    }
    versatz += teil.length
    if (teil.length < 100) break
  }
  return raus
}

let gesamtVorher = 0
let gesamtNachher = 0
let gemacht = 0
let uebersprungen = 0
let fehler = 0

for (const eimer of ZU_TUN) {
  const dateien = await alleDateien(eimer)
  const vorhandene = new Set(
    dateien.filter(d => d.name.startsWith(VORSCHAU_PRAEFIX))
           .map(d => d.name.slice(VORSCHAU_PRAEFIX.length)))
  const bilder = dateien.filter(d =>
    !d.name.startsWith(VORSCHAU_PRAEFIX) &&
    (d.metadata?.mimetype ?? '').startsWith('image/'))

  console.log(`\n${eimer}: ${bilder.length} Bilder, ${vorhandene.size} haben schon eine Vorschau`)

  for (const bild of bilder) {
    if (vorhandene.has(`${bild.name}.jpg`)) { uebersprungen++; continue }
    try {
      const roh = await fetch(`${config.supabaseUrl}/storage/v1/object/${eimer}/${bild.name}`, { headers: kopf })
      if (!roh.ok) { console.error(`  [x] ${bild.name}: HTTP ${roh.status}`); fehler++; continue }
      const quelle = Buffer.from(await roh.arrayBuffer())

      const klein = await sharp(quelle)
        // `rotate()` ohne Argument wendet die EXIF-Drehung an. Ohne das läge
        // ein Handyfoto in der Vorschau auf der Seite.
        .rotate()
        .resize({ width: BREITE, withoutEnlargement: true })
        .jpeg({ quality: GUETE, mozjpeg: true })
        .toBuffer()

      const hoch = await fetch(
        `${config.supabaseUrl}/storage/v1/object/${eimer}/${VORSCHAU_PRAEFIX}${bild.name}.jpg`,
        { method: 'POST', headers: { ...kopf, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
          body: new Uint8Array(klein) },
      )
      if (!hoch.ok) { console.error(`  [x] ${bild.name}: Hochladen HTTP ${hoch.status}`); fehler++; continue }

      gesamtVorher += bild.metadata?.size ?? quelle.length
      gesamtNachher += klein.length
      gemacht++
      if (gemacht % 25 === 0) console.log(`  … ${gemacht} erzeugt`)
    } catch (e) {
      console.error(`  [x] ${bild.name}: ${(e as Error).message}`)
      fehler++
    }
  }
}

const mb = (n: number) => (n / 1024 / 1024).toFixed(1) + ' MB'
console.log('\n' + '─'.repeat(60))
console.log(`${gemacht} Vorschaubilder erzeugt, ${uebersprungen} übersprungen, ${fehler} Fehler.`)
if (gemacht) {
  console.log(`Aus ${mb(gesamtVorher)} wurden ${mb(gesamtNachher)} — Faktor ` +
    (gesamtVorher / gesamtNachher).toFixed(1) + '.')
}

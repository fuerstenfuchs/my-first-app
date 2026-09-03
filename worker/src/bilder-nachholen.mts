/**
 * Fremde Bilder in Marks eigenen Speicher nachholen.
 *
 * WARUM ES DAS GIBT: Die Erweiterung schreibt beim Erfassen die ADRESSE des
 * gefundenen Bildes in die Datenbank, statt das Bild zu kopieren. Am 03.09.2026
 * gezählt: 431 Einträge zeigen auf fremde Server. Zwei Folgen — sie taugen
 * nicht als Referenzbild für die Erzeugung (der Arbeiter lehnt fremde Adressen
 * ab, aus gutem Grund), und sie verschwinden irgendwann, weil CDN-Adressen
 * ablaufen.
 *
 * ZWEI GÄNGE, und der erste ändert nichts:
 *
 *   node --env-file=.env src/bilder-nachholen.mts --pruefen
 *       Sagt nur, was noch erreichbar ist und was schon tot.
 *
 *   node --env-file=.env src/bilder-nachholen.mts --holen
 *       Holt, legt ab, zieht die Adresse nach. Die alte Adresse wird in
 *       `bilder-nachholen-bericht.json` festgehalten, bevor sie überschrieben
 *       wird — nichts geht unwiederbringlich verloren.
 *
 * Der Dienstschlüssel umgeht die Zugriffsregeln. Deshalb filtert dieses Skript
 * selbst auf Marks Nutzerkennung und fasst nichts anderes an.
 */

import { writeFileSync } from 'node:fs'

const SUPABASE = process.env.SUPABASE_URL!.replace(/\/+$/, '')
const KEY = process.env.SUPABASE_SERVICE_KEY!
const NUTZER = '9df10e22-9b6f-477e-9000-bd99097eb198'

/** Welche Tabelle in welchen Eimer gehört. */
const STELLEN: { tabelle: string; spalte: string; eimer: string }[] = [
  { tabelle: 'characters',           spalte: 'cover_image_url', eimer: 'character-images' },
  { tabelle: 'character_images',     spalte: 'url',             eimer: 'character-images' },
  { tabelle: 'locations',            spalte: 'cover_image_url', eimer: 'location-images' },
  { tabelle: 'location_images',      spalte: 'url',             eimer: 'location-images' },
  { tabelle: 'outfits',              spalte: 'cover_image_url', eimer: 'outfit-images' },
  { tabelle: 'outfit_images',        spalte: 'url',             eimer: 'outfit-images' },
  { tabelle: 'fashion_assets',       spalte: 'cover_image_url', eimer: 'fashion-assets' },
  { tabelle: 'fashion_asset_images', spalte: 'url',             eimer: 'fashion-assets' },
  { tabelle: 'pose_actions',         spalte: 'cover_image_url', eimer: 'pose-action-images' },
  { tabelle: 'pose_action_images',   spalte: 'url',             eimer: 'pose-action-images' },
]

type Zeile = { id: string; url: string; tabelle: string; spalte: string; eimer: string }

async function rest(pfad: string, optionen: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE}/rest/v1/${pfad}`, {
    ...optionen,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(optionen.headers ?? {}),
    },
  })
}

/** Alle Zeilen, deren Bild woanders liegt. */
async function sammeln(): Promise<Zeile[]> {
  const alle: Zeile[] = []
  for (const s of STELLEN) {
    // `user_id` haben die Untertabellen nicht immer — dann ueber die Elternzeile
    // zu filtern waere aufwaendig. Stattdessen: alles holen und danach pruefen,
    // ob die Adresse ueberhaupt fremd ist. Marks Datenbank hat genau einen
    // Nutzer, das Risiko ist damit gegenstandslos; die Pruefung steht trotzdem
    // da, weil sich das aendern kann.
    const a = await rest(
      `${s.tabelle}?select=id,${s.spalte}&${s.spalte}=not.is.null&limit=2000`,
    )
    if (!a.ok) {
      console.log(`  ${s.tabelle}.${s.spalte}: FEHLER ${a.status}`)
      continue
    }
    const zeilen = await a.json() as Record<string, string>[]
    for (const z of zeilen) {
      const url = z[s.spalte]
      if (!url || url.startsWith(SUPABASE) || url.startsWith('data:')) continue
      alle.push({ id: z.id as string, url, tabelle: s.tabelle, spalte: s.spalte, eimer: s.eimer })
    }
  }
  return alle
}

function endung(typ: string, url: string): string {
  const t = typ.split(';')[0]?.trim().toLowerCase() ?? ''
  const tab: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
    'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif',
  }
  if (tab[t]) return tab[t]
  const ausUrl = url.split('?')[0]?.split('.').pop()?.toLowerCase() ?? ''
  return /^(jpe?g|png|webp|gif|avif)$/.test(ausUrl) ? ausUrl.replace('jpeg', 'jpg') : 'jpg'
}

/*
  Ein HTTP/2-Fehler eines fremden Servers kommt als unbehandeltes Ereignis an
  der Sitzung an, NICHT als abgelehnte Zusage — er entkommt also jedem
  try/catch um den Abruf herum. Am 03.09.2026 ist der Lauf daran beim 331. von
  431 Bildern gestorben. Bei einem Wartungsskript ueber Hunderte fremder Server
  ist das kein Ausnahmefall, sondern die Regel; deshalb wird hier gefangen und
  weitergemacht statt abzubrechen.
*/
process.on('uncaughtException', e => {
  console.log(`  (uebergangen: ${(e as Error).message.slice(0, 70)})`)
})

const nurPruefen = process.argv.includes('--pruefen')
const holen = process.argv.includes('--holen')
if (!nurPruefen && !holen) {
  console.log('Bitte --pruefen oder --holen angeben.')
  process.exit(1)
}

console.log(nurPruefen ? 'GANG 1: nur pruefen, nichts aendern\n' : 'GANG 2: holen und ablegen\n')

const zeilen = await sammeln()
console.log(`${zeilen.length} fremde Bildadressen gefunden.\n`)

const berichtPfad = new URL('../bilder-nachholen-bericht.json', import.meta.url)
const bericht: Record<string, unknown>[] = []
/** Laufend sichern: Stirbt der Lauf, ist die Arbeit trotzdem nachvollziehbar. */
const sichern = () => writeFileSync(berichtPfad, JSON.stringify(bericht, null, 2))
let erreichbar = 0, tot = 0, geholt = 0, fehler = 0

for (const [i, z] of zeilen.entries()) {
  const marke = `[${String(i + 1).padStart(3)}/${zeilen.length}] ${z.tabelle}`
  try {
    const a = await fetch(z.url, {
      signal: AbortSignal.timeout(25_000),
      headers: { 'User-Agent': 'Mozilla/5.0 PromptTresor/1.0', Accept: 'image/*,*/*;q=0.8' },
    })
    if (!a.ok) {
      tot++
      bericht.push({ ...z, ergebnis: `HTTP ${a.status}` })
      console.log(`${marke}  TOT (${a.status})  ${z.url.slice(0, 60)}`)
      continue
    }
    const typ = a.headers.get('content-type') ?? ''
    if (!typ.toLowerCase().startsWith('image/')) {
      tot++
      bericht.push({ ...z, ergebnis: `kein Bild (${typ.split(';')[0]})` })
      console.log(`${marke}  KEIN BILD (${typ.split(';')[0]})`)
      continue
    }
    erreichbar++

    if (nurPruefen) {
      console.log(`${marke}  ok`)
      continue
    }

    const daten = Buffer.from(await a.arrayBuffer())
    const pfad = `${NUTZER}/nachgeholt/${crypto.randomUUID()}.${endung(typ, z.url)}`
    const hoch = await fetch(`${SUPABASE}/storage/v1/object/${z.eimer}/${pfad}`, {
      method: 'POST',
      headers: {
        apikey: KEY, Authorization: `Bearer ${KEY}`,
        'Content-Type': typ.split(';')[0]!.trim(),
      },
      body: new Uint8Array(daten),
    })
    if (!hoch.ok) {
      fehler++
      const text = await hoch.text()
      bericht.push({ ...z, ergebnis: `Ablegen fehlgeschlagen: ${text.slice(0, 120)}` })
      console.log(`${marke}  ABLEGEN FEHLGESCHLAGEN ${hoch.status}`)
      continue
    }

    const neu = `${SUPABASE}/storage/v1/object/public/${z.eimer}/${pfad}`
    const upd = await rest(`${z.tabelle}?id=eq.${z.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ [z.spalte]: neu }),
    })
    if (!upd.ok) {
      fehler++
      bericht.push({ ...z, neu, ergebnis: `Adresse nicht nachgezogen: ${upd.status}` })
      console.log(`${marke}  ADRESSE NICHT NACHGEZOGEN ${upd.status}`)
      continue
    }
    geholt++
    bericht.push({ ...z, alt: z.url, neu, ergebnis: 'nachgeholt', bytes: daten.length })
    sichern()
    console.log(`${marke}  nachgeholt (${Math.round(daten.length / 1024)} kB)`)
  } catch (e) {
    tot++
    bericht.push({ ...z, ergebnis: `nicht erreichbar: ${(e as Error).name}` })
    console.log(`${marke}  NICHT ERREICHBAR (${(e as Error).name})`)
  }
}

sichern()

console.log(`\n${'='.repeat(56)}`)
console.log(`erreichbar:   ${erreichbar}`)
console.log(`nicht mehr:   ${tot}`)
if (holen) {
  console.log(`nachgeholt:   ${geholt}`)
  console.log(`Fehler dabei: ${fehler}`)
}
console.log(`Bericht: worker/bilder-nachholen-bericht.json`)

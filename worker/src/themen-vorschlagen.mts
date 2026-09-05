/**
 * Schlägt Themen für die Prompt-Datenbank VOR — und speichert nichts (PROJ-63).
 *
 * WARUM ES DAS GIBT: Von 80 Prompts haben 51 kein Schlagwort, 3 sind Favorit,
 * einer ist bewertet, 30 liegen in einer Sammlung. Es gibt kein Feld mit
 * wenigen festen Werten, nach dem man ordnen könnte — `tool` und `category`
 * standen nur im Plan und wurden nie gebaut. Die Ordnung, die Mark nicht
 * pflegt, macht deshalb die Maschine einmal.
 *
 * WARUM ES NUR VORSCHLÄGT: Mark soll die Themen sehen, BEVOR sie in seiner
 * Datenbank stehen. Ein Vorschlag, den man wegwerfen kann, kostet nichts;
 * eine falsche Einsortierung von 80 Prompts muss man von Hand aufräumen.
 *
 * WARUM IM ARBEITER UND NICHT IN DER APP: Hier liegen der Dienstschlüssel und
 * der Proxy-Zugang. Dieselbe Stelle wie `hintergruende-einstellen.mts`.
 *
 * Aufruf:
 *   cd worker && node --env-file=.env src/themen-vorschlagen.mts [modell]
 *   cd worker && node --env-file=.env src/themen-vorschlagen.mts [modell] --speichern
 *
 * Ohne `--speichern` wird NUR angezeigt. Mit `--speichern` werden die Themen
 * angelegt und die Prompts zugeordnet — und nur dann, wenn noch keine Themen
 * da sind. Wiederholtes Laufenlassen soll nicht doppelte Themen erzeugen.
 */

import { config, ohneGeheimnis } from './config.ts'

const args = process.argv.slice(2)
const SPEICHERN = args.includes('--speichern')
const MODELL = args.find(a => !a.startsWith('--')) ?? 'claude-opus-5'

const kopf = {
  apikey: config.supabaseKey,
  Authorization: `Bearer ${config.supabaseKey}`,
  'Content-Type': 'application/json',
}

type Zeile = {
  id: string
  title: string
  description: string | null
  content: string
  cover_image_url: string | null
  tags: string[] | null
}

// Der Arbeiter spricht mit Supabase ueber REST, nicht ueber einen Client —
// dieselbe Bauweise wie in `supabase.ts`.
const leseAntwort = await fetch(
  `${config.supabaseUrl}/rest/v1/prompts` +
  `?select=id,title,description,content,cover_image_url,tags&order=created_at.desc`,
  { headers: kopf },
)
if (!leseAntwort.ok) {
  console.error(`Konnte die Prompts nicht lesen: HTTP ${leseAntwort.status}`)
  process.exit(1)
}
const zeilen = await leseAntwort.json() as Zeile[]
console.log(`${zeilen.length} Prompts gelesen.\n`)

/*
  Der Inhalt wird gekürzt: Für die Einordnung reicht der Anfang. Ein
  vollständiger Bildprompt ist oft 1500 Zeichen lang und beschreibt danach nur
  noch Licht und Kameradetails — die trennen keine Themen.
*/
const liste = zeilen.map((z, i) => {
  const inhalt = (z.content ?? '').replace(/\s+/g, ' ').slice(0, 220)
  const bes = (z.description ?? '').replace(/\s+/g, ' ').slice(0, 100)
  const tags = z.tags?.length ? ` [${z.tags.join(', ')}]` : ''
  return `${i}. ${z.title}${tags}${bes ? ` — ${bes}` : ''}\n   ${inhalt}`
}).join('\n')

const auftrag = `Du ordnest die Prompt-Sammlung eines Fotografen und KI-Bildermachers.

Hier sind ${zeilen.length} Prompts, jeder mit laufender Nummer, Titel und Anfang des Inhalts:

${liste}

Bilde daraus 6 bis 9 THEMEN, nach denen er seine Sammlung durchsuchen würde.

Regeln:
- Themennamen auf DEUTSCH, kurz, zwei bis drei Wörter, konkret. Keine Fachwörter,
  keine englischen Begriffe. Gute Beispiele: "Porträt & Person", "Studio & Licht",
  "Landschaft & Ort". Schlechte: "Diverses", "Kreativ", "Assets".
- Ordne JEDEN Prompt genau einem Thema zu.
- Wo du dir nicht sicher bist, nimm das Thema "Sonstiges". Lieber dort als falsch
  einsortiert — er räumt es einmal von Hand auf. Zwinge nichts in ein Thema.
- Wähle je Thema VIER Prompts, die dafür stehen: der erste ist das Titelbild.
  Nimm die, an denen man das Thema am schnellsten wiedererkennt — nicht die
  neuesten und nicht die längsten.
- Titelbild und Belege MÜSSEN mit [BILD] gekennzeichnet sein. Ein Prompt
  [ohne Bild] darf dort nicht stehen — die Karte hätte sonst ein leeres Feld.
- Ein Thema mit weniger als drei Prompts lohnt nicht; leg es mit einem
  verwandten zusammen.

Antworte AUSSCHLIESSLICH mit JSON, ohne Vorrede und ohne Code-Zaun:
{"themen":[{"name":"...","beschreibung":"ein Satz, was hineingehört",
"titelbild":0,"belege":[1,2,3],"prompts":[0,1,2,3]}]}
"titelbild" und "belege" sind Nummern aus der Liste oben, "prompts" alle Nummern
dieses Themas.`

console.log(`Frage ${MODELL} …`)
const t0 = Date.now()

const antwort = await fetch(`${config.proxyUrl}/v1/chat/completions`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${config.proxyToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: MODELL,
    messages: [{ role: 'user', content: auftrag }],
    max_tokens: 16000,
  }),
  signal: AbortSignal.timeout(300_000),
}).catch((e: Error) => {
  console.error(ohneGeheimnis(`Proxy nicht erreichbar: ${e.message}`))
  process.exit(1)
})

if (!antwort.ok) {
  console.error(`HTTP ${antwort.status}: ${ohneGeheimnis((await antwort.text()).slice(0, 400))}`)
  process.exit(1)
}

const roh = await antwort.json() as {
  choices?: { message?: { content?: string }; finish_reason?: string }[]
}
const text = roh.choices?.[0]?.message?.content ?? ''
if (!text) {
  // Am 05.09.2026 kam von claude-opus-5 nach 88 s eine leere Antwort. Ohne
  // diese Ausgabe raet man, woran es lag.
  console.error('Leere Antwort. Abbruchgrund: '
    + (roh.choices?.[0]?.finish_reason ?? '?') + ', Felder: ' + JSON.stringify(roh).slice(0, 400))
  process.exit(1)
}
console.log(`Antwort nach ${((Date.now() - t0) / 1000).toFixed(1)} s.\n`)

// Der Code-Zaun kommt trotz Ansage manchmal mit — abschneiden statt scheitern.
const json = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
let vorschlag: { themen: { name: string; beschreibung: string; titelbild: number;
                          belege: number[]; prompts: number[] }[] }
try {
  vorschlag = JSON.parse(json)
} catch {
  console.error('Antwort war kein JSON. Anfang:\n' + text.slice(0, 600))
  process.exit(1)
}

/*
  NACHBEREITEN, STATT SICH ZU VERLASSEN.

  Beim ersten Durchgang blieb ein Prompt unzugeordnet und ein Titelbild hatte
  gar kein Bild. Beides ist mit zwei Schleifen zu heilen — und das gehört hier
  hin und nicht in den Auftragstext: Eine Regel, die das Modell befolgen SOLL,
  ist keine Zusicherung.
*/
const sonstiges = vorschlag.themen.find(t => /sonstig/i.test(t.name))
  ?? (vorschlag.themen.push({ name: 'Sonstiges', beschreibung: 'Noch nicht einsortiert.',
        titelbild: -1, belege: [], prompts: [] }), vorschlag.themen.at(-1)!)

const schonDrin = new Set(vorschlag.themen.flatMap(t => t.prompts))
const uebrig = zeilen.map((_, i) => i).filter(i => !schonDrin.has(i))
if (uebrig.length) {
  sonstiges.prompts.push(...uebrig)
  console.log(`${uebrig.length} übrig gebliebene Prompts nach „Sonstiges" gelegt.`)
}

for (const t of vorschlag.themen) {
  const mitBild = t.prompts.filter(i => zeilen[i]?.cover_image_url)
  if (!zeilen[t.titelbild]?.cover_image_url && mitBild.length) {
    console.log(`„${t.name}": Titelbild hatte kein Bild — getauscht gegen „${zeilen[mitBild[0]].title}".`)
    t.titelbild = mitBild[0]
  }
  t.belege = t.belege.filter(i => zeilen[i]?.cover_image_url && i !== t.titelbild)
  for (const i of mitBild) {
    if (t.belege.length >= 3) break
    if (i !== t.titelbild && !t.belege.includes(i)) t.belege.push(i)
  }
}

vorschlag.themen = vorschlag.themen.filter(t => t.prompts.length > 0)

let zugeordnet = 0
console.log('')
console.log('─'.repeat(72))
for (const t of vorschlag.themen) {
  zugeordnet += t.prompts.length
  const titel = zeilen[t.titelbild]
  console.log(`\n■ ${t.name}  (${t.prompts.length} Prompts)`)
  console.log(`  ${t.beschreibung}`)
  console.log(`  Titelbild: ${titel?.title ?? '?'}${titel?.cover_image_url ? '' : '  ← OHNE BILD'}`)
  console.log(`  Belege:    ${t.belege.map(i => zeilen[i]?.title ?? '?').join(' · ')}`)
  const rest = t.prompts.filter(i => i !== t.titelbild && !t.belege.includes(i))
  if (rest.length) {
    console.log(`  Weitere:   ${rest.map(i => zeilen[i]?.title ?? '?').slice(0, 8).join(' · ')}`
      + (rest.length > 8 ? ` … (+${rest.length - 8})` : ''))
  }
}
console.log('\n' + '─'.repeat(72))
console.log(`${vorschlag.themen.length} Themen, ${zugeordnet} von ${zeilen.length} Prompts zugeordnet.`)

const alle = new Set(vorschlag.themen.flatMap(t => t.prompts))
const fehlend = zeilen.map((_, i) => i).filter(i => !alle.has(i))
if (fehlend.length) {
  console.log(`\nNICHT ZUGEORDNET (${fehlend.length}): ` +
    fehlend.map(i => zeilen[i].title).join(' · '))
}
const ohneBild = vorschlag.themen.filter(t => !zeilen[t.titelbild]?.cover_image_url)
if (ohneBild.length) {
  console.log(`\nACHTUNG — Titelbild ohne Bild bei: ${ohneBild.map(t => t.name).join(', ')}`)
}

if (!SPEICHERN) {
  console.log('')
  console.log('Es wurde NICHTS gespeichert. Das ist ein Vorschlag.')
  console.log(`Zum Uebernehmen: ... src/themen-vorschlagen.mts ${MODELL} --speichern`)
  process.exit(0)
}

// -- Speichern --------------------------------------------------------------
const vorhanden = await (await fetch(
  `${config.supabaseUrl}/rest/v1/themen?select=id&limit=1`, { headers: kopf })).json() as unknown[]
if (vorhanden.length) {
  console.error('')
  console.error('Es gibt bereits Themen. Ein zweiter Lauf legte alles doppelt an.')
  console.error('Zum Neuaufbau die Themen erst in der App loeschen.')
  process.exit(1)
}

const nutzer = await (await fetch(
  `${config.supabaseUrl}/rest/v1/prompts?select=user_id&limit=1`,
  { headers: kopf })).json() as { user_id: string }[]
const userId = nutzer[0]?.user_id
if (!userId) { console.error('Keine Benutzerkennung gefunden.'); process.exit(1) }

console.log('')
console.log('Lege Themen an ...')
let nr = 0
for (const t of vorschlag.themen) {
  const anlegen = await fetch(`${config.supabaseUrl}/rest/v1/themen`, {
    method: 'POST',
    headers: { ...kopf, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      name: t.name,
      beschreibung: t.beschreibung,
      titelbild_prompt_id: zeilen[t.titelbild]?.id ?? null,
      beleg_prompt_ids: t.belege.map(i => zeilen[i]?.id).filter(Boolean),
      sortierung: /sonstig/i.test(t.name) ? 999 : nr++,
    }),
  })
  if (!anlegen.ok) {
    console.error(`Thema fehlgeschlagen: HTTP ${anlegen.status} ${(await anlegen.text()).slice(0, 200)}`)
    process.exit(1)
  }
  const [angelegt] = await anlegen.json() as { id: string }[]

  // Die Zuordnung in EINEM Aufruf je Thema: 80 Einzelaufrufe waeren langsam und
  // hinterliessen bei einem Abbruch einen halb sortierten Bestand.
  const ids = t.prompts.map(i => zeilen[i]?.id).filter(Boolean)
  const zuordnen = await fetch(
    `${config.supabaseUrl}/rest/v1/prompts?id=in.(${ids.join(',')})`,
    { method: 'PATCH', headers: kopf, body: JSON.stringify({ thema_id: angelegt.id }) },
  )
  if (!zuordnen.ok) {
    console.error(`Zuordnung fehlgeschlagen: HTTP ${zuordnen.status}`)
    process.exit(1)
  }
  console.log(`  ${t.name.padEnd(34)} ${String(ids.length).padStart(3)} Prompts`)
}

const offen = await (await fetch(
  `${config.supabaseUrl}/rest/v1/prompts?select=id&thema_id=is.null`,
  { headers: kopf })).json() as unknown[]
console.log('')
console.log(`Fertig. ${vorschlag.themen.length} Themen angelegt, ${offen.length} Prompts ohne Thema.`)

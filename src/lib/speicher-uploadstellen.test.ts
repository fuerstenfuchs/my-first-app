import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative, sep } from 'path'

/**
 * QUELLTEXT-WÄCHTER: Wer lädt Bilder in den Speicher hoch?
 *
 * WARUM: Am 15.09.2026 wurden alle großen Bilder durch WebP ≤ 2048 ersetzt
 * (329 MB statt voll). Fünfzehn Upload-Stellen luden bis dahin Originale hoch,
 * jede für sich. Jetzt gehen sie über `bildHochladen` (`src/lib/bild-hochladen.ts`),
 * das vorher verkleinert. Die nächste neue Stelle, die direkt hochlädt, füllte
 * den Speicher wieder — und kein anderer Test fiele darüber.
 *
 * GEZÄHLT wird jedes `.upload(`, `?.upload(` und `['upload']` in Dateien, die
 * `storage` erwähnen — in `src` und in der Chrome-Erweiterung. Grob mit Absicht,
 * wie `speicher-loeschstellen.test.ts`: lieber einmal zu streng.
 *
 * ERLAUBT, je mit genauer Anzahl und Grund:
 */
const ERLAUBTE_ANZAHL = new Map<string, [number, string]>([
  ['src/lib/bild-hochladen.ts', [1,
    'die eine Upload-Funktion — verkleinert vorher']],
  ['src/hooks/use-bild-bearbeiten.ts', [1,
    'eigene Bearbeitung in generated-images, kein Baustein-Eimer: Werkstoff ' +
    'für Vergrößern und weitere Bearbeitung — über generated-images entscheidet Stufe 2']],
  ['src/app/api/referenz-holen/route.ts', [1,
    'Server, holt eine Referenz von einer fremden Adresse nach generated-images, ' +
    'kein Baustein-Eimer und nicht im Auftrag vom 15.09.2026 — offener Punkt, ' +
    'ob sie mit sharp verkleinert werden soll']],
  ['src/app/api/share/route.ts', [1,
    'Server, verkleinert selbst mit sharp (`bild-fuer-speicher-server.ts`)']],
  // ── Arbeiter (seit 15.09.2026 mitgeprüft, Critic S6) ──
  ['worker/src/supabase.ts', [1,
    'ergebnisAblegen — verkleinert selbst und legt das Original vorher nach Backblaze ' +
    '(worker/src/speicher.ts, b2.ts); dieselbe Adresse dient dem frischen Zurücklesen']],
  ['worker/src/vorschaubilder.mts', [2,
    'Wartungsskript von Hand: legt nur 480-px-Vorschaubilder unter vorschau/ ab ' +
    '(eine der beiden Stellen liest das Original)']],
  ['worker/src/hintergruende-einstellen.mts', [1,
    'Einrichtungsskript von Hand: Studio-Hintergründe, einmalig eingespielt']],
  ['worker/src/bilder-nachholen.mts', [1,
    'Reparaturskript von Hand (03.09.2026): holte fremde Bilder einmalig in den eigenen Speicher']],
])

const PROJEKT = join(__dirname, '..', '..')
const ORDNER = [join(PROJEKT, 'src'), join(PROJEKT, 'extension', 'src'), join(PROJEKT, 'worker', 'src')]

const HOCHLADEAUFRUF = /\??\.\s*upload\s*\(|\??\.?\s*\[\s*(['"`])upload\1\s*\]/g
/** Hochladen über eine vorab signierte Adresse — derselbe Weg, anders geschrieben. */
const SIGNIERT = /uploadToSignedUrl\s*\(/g
/**
 * Der Arbeiter spricht die REST-Schnittstelle direkt an: `fetch(… /storage/v1/object/<eimer>/…, { method: 'POST' })`.
 * Gezählt wird jede solche Adresse in einer Datei, die überhaupt POST oder PUT
 * schickt — ohne die reinen Leseadressen (`public`, `info`, `list`, `sign`).
 */
const SPEICHER_REST = /\/storage\/v1\/object\/(?!(?:public|info|list|sign|authenticated)\/)/g
const SCHREIBT = /method\s*:\s*['"`](?:POST|PUT)['"`]/

function speicherUploads(text: string): number {
  if (!/storage/i.test(text)) return 0
  const sdk = (text.match(HOCHLADEAUFRUF)?.length ?? 0) + (text.match(SIGNIERT)?.length ?? 0)
  const rest = SCHREIBT.test(text) ? (text.match(SPEICHER_REST)?.length ?? 0) : 0
  return sdk + rest
}

function quelldateien(ordner: string): string[] {
  const raus: string[] = []
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) { raus.push(...quelldateien(pfad)); continue }
    if (!/\.(ts|tsx|mts)$/.test(name)) continue
    if (/\.(test|spec)\.(ts|tsx)$/.test(name)) continue
    raus.push(pfad)
  }
  return raus
}

describe('Wächter-Muster (prüft sich selbst)', () => {
  it('erkennt die Formen', () => {
    expect(speicherUploads(`supabase.storage.from('x').upload(p, f)`)).toBe(1)
    expect(speicherUploads(`const { storage } = s\nawait storage.from(eimer(x))?.upload(p, f, { upsert: true })`)).toBe(1)
    expect(speicherUploads(`supabase.storage.from(b)['upload'](p, f)`)).toBe(1)
    expect(speicherUploads(`storage.from(a).upload(x, y)\nstorage.from(b).upload(z, w)`)).toBe(2)
  })
  it('Dateien ohne storage bleiben außen vor', () => {
    expect(speicherUploads(`form.upload(datei)`)).toBe(0)
  })
  it('erkennt signierte Uploads und direkte REST-Schreibzugriffe', () => {
    expect(speicherUploads(`supabase.storage.from(b).uploadToSignedUrl(p, token, f)`)).toBe(1)
    expect(speicherUploads(
      `await fetch(\`\${url}/storage/v1/object/\${eimer}/\${pfad}\`, { method: 'POST', body })`)).toBe(1)
    expect(speicherUploads(`fetch(u + '/storage/v1/object/generated-images/a.png', { method: "PUT" })`)).toBe(1)
  })
  it('reine Lesezugriffe zählen nicht', () => {
    expect(speicherUploads(
      `fetch(\`\${url}/storage/v1/object/public/\${eimer}/x\`)\nfetch(\`\${url}/storage/v1/object/list/\${eimer}\`, { method: 'POST' })`)).toBe(0)
  })
})

describe('Upload-Stellen im Speicher', () => {
  const dateien = ORDNER.flatMap(quelldateien).map(p => ({
    name: relative(PROJEKT, p).split(sep).join('/'),
    anzahl: speicherUploads(readFileSync(p, 'utf8')),
  }))

  it('findet überhaupt Quelldateien in allen drei Ordnern', () => {
    expect(dateien.some(d => d.name.startsWith('src/'))).toBe(true)
    expect(dateien.some(d => d.name.startsWith('extension/src/'))).toBe(true)
    expect(dateien.some(d => d.name.startsWith('worker/src/'))).toBe(true)
  })

  it('nirgends sonst wird direkt hochgeladen', () => {
    const verboten = dateien
      .filter(d => d.anzahl > 0 && !ERLAUBTE_ANZAHL.has(d.name))
      .map(d => `${d.name} (${d.anzahl}×) — bitte über bildHochladen aus src/lib/bild-hochladen.ts`)
    expect(verboten).toEqual([])
  })

  it('die erlaubten Stellen laden genau so oft hoch wie festgehalten', () => {
    const ist = [...ERLAUBTE_ANZAHL.keys()].map(name => ({
      name, anzahl: dateien.find(x => x.name === name)?.anzahl ?? 'Datei fehlt',
    }))
    expect(ist).toEqual([...ERLAUBTE_ANZAHL].map(([name, [anzahl]]) => ({ name, anzahl })))
  })
})

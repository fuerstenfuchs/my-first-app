/**
 * Lokale Bilder — der Arbeiter auf dem neuen PC (RTX 5060 Ti).
 *
 * Mark am 01.10.2026: Der neue Rechner erzeugt lokal, was der Proxy nicht
 * macht, oder wenn er ausdrücklich „lokal" sagt. Hier ist die Trésor-Seite
 * davon; die Gegenstelle ist dieselbe wie im Fuchsbau (src/anbieter/lokal.ts).
 *
 * ZWEI-WEGE-BINDUNG: Ein Modell mit der Vorsilbe `lokal:` geht NIE an den
 * Proxy, und ein Proxy-Modell geht nie hierher. Kein stiller Ersatz.
 *
 * REFERENZEN: Sie kommen als Supabase-Adressen (`bildHolen` lässt nur den
 * eigenen Speicher zu) und gehen als Base64 an den neuen PC. Der Arbeiter dort
 * wird mit höchstens 1024 px gefüttert — grössere Vorlagen haben ihm am
 * 02.10.2026 den Speicher gesprengt (Qwen, 16 GB).
 *
 * Nichts davon verlässt das Heimnetz ausser dem fertigen Bild, das wie jedes
 * Ergebnis nach Supabase/Backblaze abgelegt wird.
 */

import sharp from 'sharp'
import { config } from './config.ts'
import { bildHolen } from './supabase.ts'
import { bildart } from './netz.ts'
import type { ImageJob } from './supabase.ts'

export const LOKAL_PRAEFIX = 'lokal:'

/** Die Modelle des Arbeiters. Schlüssel = was hinter `lokal:` steht. `referenzen` = [wenigstens, höchstens]. */
export const LOKALE_MODELLE = {
  qwen21:         { referenzen: [0, 4] },
  krea2:          { referenzen: [0, 0] },
  klein9b:        { referenzen: [0, 4] },
  klein4b:        { referenzen: [0, 4] },
  sdxl_instantid: { referenzen: [1, 1] },
} as const
export type LokalesModell = keyof typeof LOKALE_MODELLE

export function istLokalesModell(modell: string | null | undefined): boolean {
  return !!modell?.trim().startsWith(LOKAL_PRAEFIX)
}

/** Der Modellname hinter der Vorsilbe — geprüft, nie durchgereicht. */
export function lokalesModellPruefen(gewuenscht: string): LokalesModell {
  const w = gewuenscht.trim().slice(LOKAL_PRAEFIX.length)
  if (Object.prototype.hasOwnProperty.call(LOKALE_MODELLE, w)) return w as LokalesModell
  throw new Error(
    `„${gewuenscht}" ist kein lokales Bildmodell. Möglich sind: ` +
    `${Object.keys(LOKALE_MODELLE).map(k => LOKAL_PRAEFIX + k).join(', ')}.`,
  )
}

/** Seitenverhältnis → Pixel (rund ein Megapixel, durch 16 teilbar). */
const FORMATE: Record<string, [number, number]> = {
  '1:1':  [1024, 1024],
  '16:9': [1344, 768],
  '9:16': [768, 1344],
  '4:3':  [1152, 864],
  '3:4':  [864, 1152],
  '3:2':  [1248, 832],
  '2:3':  [832, 1248],
  '4:5':  [896, 1120],
  '21:9': [1568, 672],
}

/** `landscape_16_9` → [1344, 768]; unbekannt oder leer → undefined (der Arbeiter nimmt sein Standardmass). */
const SIZE_ZU_FORMAT: Record<string, [number, number]> = {
  '1024x1024': [1024, 1024],
  '1536x1024': [1248, 832],
  '1024x1536': [832, 1248],
}

/**
 * Die App schreibt bei lokalen Aufträgen das echte Pixelmass in `size` (Stufen
 * 1 / 2 / 4,7 MP) — nur Zulässiges durchlassen: durch 16 teilbar, je Seite
 * 512 bis 2816, zusammen höchstens 5 Megapixel (dieselben Grenzen wie im
 * Arbeiter). Die drei gpt-Größen zählen NICHT: Sie stammen von Aufträgen aus
 * der Zeit vor den Stufen, dort entscheidet das Seitenverhältnis.
 */
export function masseAusSize(size: string): [number, number] | undefined {
  if (size in SIZE_ZU_FORMAT) return undefined
  const m = /^(\d{3,4})x(\d{3,4})$/.exec(size)
  if (!m) return undefined
  const b = Number(m[1]), h = Number(m[2])
  return b % 16 === 0 && h % 16 === 0 && b >= 512 && h >= 512 && b <= 2816 && h <= 2816 && b * h <= 5_000_000 ? [b, h] : undefined
}

export function masseFuerFormat(aspect: string | null | undefined): [number, number] | undefined {
  const m = /(\d+)_(\d+)$/.exec(aspect ?? '')
  return m ? FORMATE[`${m[1]}:${m[2]}`] : undefined
}

const POLL_MS = 2500
const GRENZE_MS = 50 * 60_000
const REF_KANTE = 1024

type Einstellung = { url: string; token: string }

function einstellung(): Einstellung {
  const url = config.arbeiterUrl
  const token = config.arbeiterToken
  if (!url) throw new Error('Lokale Bilder sind nicht eingerichtet: ARBEITER_URL fehlt in worker/.env (z. B. http://192.168.178.86:8190).')
  if (!token) throw new Error('Lokale Bilder sind nicht eingerichtet: ARBEITER_TOKEN fehlt in worker/.env (steht in token.txt im Ordner des Arbeiters auf dem neuen PC).')
  return { url, token }
}

function ohneToken(text: string, token: string): string {
  return token ? text.split(token).join('…') : text
}

async function frage(
  e: Einstellung, pfad: string,
  opt: { methode?: string; rumpf?: unknown; ms?: number; signal?: AbortSignal } = {},
): Promise<Response> {
  const zeit = AbortSignal.timeout(opt.ms ?? 15_000)
  try {
    return await fetch(`${e.url}${pfad}`, {
      method: opt.methode ?? 'GET',
      headers: { 'X-Fuchs-Token': e.token, ...(opt.rumpf !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: opt.rumpf !== undefined ? JSON.stringify(opt.rumpf) : undefined,
      signal: opt.signal ? AbortSignal.any([opt.signal, zeit]) : zeit,
      // Keiner Weiterleitung folgen: fetch nimmt eigene Kopfzeilen mit, auch an einen dritten Rechner.
      redirect: 'error',
    })
  } catch (f) {
    const fehler = f as Error
    if (fehler.name === 'AbortError') throw fehler
    throw new Error(ohneToken(
      fehler.name === 'TimeoutError'
        ? 'Der neue PC antwortet nicht (Zeitüberschreitung). Ist er an und der Arbeiter gestartet?'
        : `Der neue PC ist nicht erreichbar: ${fehler.message}`,
      e.token,
    ))
  }
}

async function jsonOderFehler(antwort: Response, token: string): Promise<Record<string, unknown>> {
  const j = await antwort.json().catch(() => null) as Record<string, unknown> | null
  if (antwort.status === 401) throw new Error('Der Arbeiter lehnt den Schlüssel ab (ARBEITER_TOKEN stimmt nicht).')
  if (!antwort.ok) throw new Error(ohneToken(`Der Arbeiter lehnt ab (${antwort.status}): ${String(j?.fehler ?? 'ohne Begründung')}`, token))
  return j ?? {}
}

/** Eine Vorlage holen (nur eigener Speicher) und auf höchstens 1024 px bringen. */
async function referenzVorbereiten(url: string, nr: number): Promise<{ name: string; base64: string }> {
  const { daten } = await bildHolen(url)
  const png = await sharp(Buffer.from(daten))
    .rotate()
    .resize({ width: REF_KANTE, height: REF_KANTE, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()
  return { name: `referenz-${nr + 1}.png`, base64: png.toString('base64') }
}

export function kreaGewichte(meta: unknown): boolean {
  const lokal = (meta as { lokal?: { krea_gewichte?: unknown } } | null)?.lokal
  return lokal?.krea_gewichte === true
}

/** Ein Bild lokal erzeugen. Gibt die PNG-Daten zurück. */
export async function bildErzeugenLokal(
  job: ImageJob, signal?: AbortSignal, melde: (text: string) => void = () => {},
): Promise<ArrayBuffer> {
  const e = einstellung()
  const modell = lokalesModellPruefen(job.model)
  const [lo, hi] = LOKALE_MODELLE[modell].referenzen
  const anzahl = job.reference_urls.length
  if (anzahl < lo || anzahl > hi) {
    throw new Error(`${LOKAL_PRAEFIX}${modell} braucht ${lo === hi ? lo : `${lo} bis ${hi}`} Referenzbild(er), der Auftrag hat ${anzahl}.`)
  }

  // Die Gegenstelle lehnt laengere Prompts ab (arbeiter.py) — klar sagen, statt dreimal scheitern.
  if (job.prompt.length > 6000) {
    throw new Error(`Der Prompt ist ${job.prompt.length} Zeichen lang; lokale Modelle nehmen höchstens 6000.`)
  }
  const referenzen = []
  for (const [i, url] of job.reference_urls.entries()) referenzen.push(await referenzVorbereiten(url, i))
  const summe = referenzen.reduce((s, r) => s + r.base64.length, 0)
  if (summe > 48 * 1024 * 1024) {
    throw new Error(`Die Referenzbilder sind zusammen zu gross (${Math.round(summe / 1048576)} MB als Text).`)
  }

  // Ohne Format die gpt-Groesse des Auftrags uebersetzen — sonst nimmt der neue PC
  // sein Hochformat-Standardmass, auch wo die Oberflaeche "quadratisch" zeigt.
  const mass = masseAusSize(job.size) ?? masseFuerFormat(job.aspect_ratio) ?? SIZE_ZU_FORMAT[job.size]
  const bestellung = {
    modell,
    prompt: job.prompt,
    referenzen,
    anzahl: 1,
    // Schalter „Krea-Gewichte" (nur Krea 2) reist in scene_meta.lokal
    ...(modell === 'krea2' && kreaGewichte(job.scene_meta) ? { krea_gewichte: true } : {}),
    ...(mass ? { breite: mass[0], hoehe: mass[1] } : {}),
    nachbearbeitung: { hochrechnen: 0, augenfarbe: false, augen_referenz: 0 },
  }

  const start = Date.now()
  const angelegt = await jsonOderFehler(
    await frage(e, '/auftrag', { methode: 'POST', rumpf: bestellung, ms: 60_000, signal }), e.token,
  )
  const id = String(angelegt.id ?? '')
  if (!/^[0-9a-f]{12}$/.test(id)) throw new Error('Der Arbeiter hat keine gültige Auftragsnummer geliefert.')
  const dort = `/auftrag/${encodeURIComponent(id)}`

  type Zustand = { zustand: string; meldung?: string; fehler?: string | null; ergebnisse?: { name: string }[] }
  let letzteMeldung = ''
  // AUFRÄUMEN AUF DEM NEUEN PC IN JEDEM FALL: DELETE bricht einen wartenden oder
  // rechnenden Auftrag dort ab, einen fertigen entfernt es samt Bildern.
  try {
    let z: Zustand = { zustand: 'wartet' }
    let ausfaelle = 0
    for (;;) {
      if (signal?.aborted) throw Object.assign(new Error('Abgebrochen — der Auftrag auf dem neuen PC wird mit abgebrochen.'), { name: 'AbortError' })
      if (Date.now() - start > GRENZE_MS) throw new Error('Der neue PC hat nach 50 Minuten nicht geliefert (Auftrag dort abgebrochen).')
      try {
        z = await jsonOderFehler(await frage(e, dort, { signal }), e.token) as unknown as Zustand
        ausfaelle = 0
      } catch (f) {
        if ((f as Error).name === 'AbortError') throw f
        // Eine Ablehnung der Gegenstelle (falscher Schluessel, unbekannter Auftrag) wird nicht besser durchs Warten.
        if (/^Der Arbeiter lehnt/.test((f as Error).message)) throw f
        // Ein kurzer Aussetzer (Neustart des Dienstes) soll den Auftrag nicht kippen.
        if (++ausfaelle >= 12) throw f
        await new Promise(r => setTimeout(r, POLL_MS))
        continue
      }
      if (z.zustand === 'fertig' || z.zustand === 'fehlgeschlagen' || z.zustand === 'abgebrochen') break
      if (z.meldung && z.meldung !== letzteMeldung) { letzteMeldung = z.meldung; melde(`  neuer PC: ${z.meldung}`) }
      await new Promise(r => setTimeout(r, POLL_MS))
    }
    if (z.zustand !== 'fertig') {
      throw new Error(z.zustand === 'abgebrochen'
        ? 'Der Auftrag wurde auf dem neuen PC abgebrochen.'
        : ohneToken(`Der neue PC meldet: ${z.fehler ?? 'fehlgeschlagen'}`, e.token))
    }
    const name = String(z.ergebnisse?.[0]?.name ?? '')
    // Der Name kommt aus einer Antwort von aussen: nur das bekannte Muster, nie ein Pfad.
    if (!/^bild-[1-4]\.png$/.test(name)) throw new Error('Die Gegenstelle hat keinen gültigen Bildnamen geliefert.')
    const a = await frage(e, `${dort}/bild/${name}`, { ms: 120_000, signal })
    if (!a.ok) throw new Error(`Das fertige Bild ließ sich nicht abholen (HTTP ${a.status}).`)
    const puffer = Buffer.from(await a.arrayBuffer())
    if (puffer.length < 100) throw new Error('Der neue PC hat zu wenig Daten für ein Bild geliefert.')
    if (!bildart(puffer)) throw new Error('Der neue PC hat etwas geliefert, das kein Bild ist.')
    return puffer.buffer.slice(puffer.byteOffset, puffer.byteOffset + puffer.byteLength) as ArrayBuffer
  } finally {
    await frage(e, dort, { methode: 'DELETE', ms: 8000 }).catch(() => undefined)
  }
}

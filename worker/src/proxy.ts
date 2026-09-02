/**
 * Der Weg zum Bildmodell.
 *
 * Verhält sich bewusst genauso wie das bewährte Werkzeug bild.mjs:
 * mit Referenzbildern an /v1/images/edits, ohne an /v1/images/generations,
 * und es wird ausschließlich b64_json angenommen.
 */

import { config, ohneGeheimnis } from './config.ts'
import { PROXY_UNERREICHBAR } from './netz.ts'
import { bildHolen } from './supabase.ts'
import type { ImageJob } from './supabase.ts'

/** Was gpt-image-2 tatsächlich kann. Alles andere lehnt die Gegenstelle ab. */
export const ERLAUBTE_GROESSEN = ['1024x1024', '1536x1024', '1024x1536'] as const

function dateiEndung(typ: string): string {
  if (typ.includes('jpeg') || typ.includes('jpg')) return 'jpg'
  if (typ.includes('webp')) return 'webp'
  return 'png'
}

/**
 * Ein Bild erzeugen. Gibt die rohen PNG-Daten zurück.
 *
 * `signal` kommt von außen, damit ein Abbruch des Arbeiters eine laufende
 * Anfrage nicht verwaist stehen lässt.
 */
export async function bildErzeugen(job: ImageJob, signal?: AbortSignal): Promise<ArrayBuffer> {
  const mitVorlage = job.reference_urls.length > 0
  const zielUrl = `${config.proxyUrl}/v1/images/${mitVorlage ? 'edits' : 'generations'}`

  const groesse = (ERLAUBTE_GROESSEN as readonly string[]).includes(job.size)
    ? job.size
    : '1024x1024'

  const kopf: Record<string, string> = { Authorization: `Bearer ${config.proxyToken}` }
  let rumpf: BodyInit

  if (mitVorlage) {
    // Kein Content-Type von Hand setzen — die Trennmarke kennt nur FormData.
    const form = new FormData()
    form.set('model', job.model)
    form.set('prompt', job.prompt)
    form.set('size', groesse)
    form.set('quality', 'high')
    // Der entscheidende Parameter, sobald ein Referenzfoto mitgeht: ohne ihn
    // geht die Ähnlichkeit verloren, unabhängig vom Prompt.
    form.set('input_fidelity', job.input_fidelity ?? 'high')

    const einzeln = job.reference_urls.length === 1
    for (const [i, url] of job.reference_urls.entries()) {
      const { daten, typ } = await bildHolen(url)
      // Sprechender Dateiname statt "referenz-0": Die eigentliche Zuordnung
      // steht im Prompt, aber ein Name wie "1-character.png" kann nur helfen —
      // und er macht die Fehlersuche lesbar.
      const rolle = job.reference_roles?.[i] ?? 'reference'
      form.append(
        einzeln ? 'image' : 'image[]',
        new Blob([daten], { type: typ }),
        `${i + 1}-${rolle}.${dateiEndung(typ)}`,
      )
    }
    rumpf = form
  } else {
    kopf['Content-Type'] = 'application/json'
    rumpf = JSON.stringify({
      model: job.model,
      prompt: job.prompt,
      n: 1,
      size: groesse,
      quality: 'high',
    })
  }

  const zeitgrenze = AbortSignal.timeout(config.requestTimeoutMs)
  const abbruch = signal ? AbortSignal.any([signal, zeitgrenze]) : zeitgrenze

  let antwort: Response
  try {
    antwort = await fetch(zielUrl, { method: 'POST', headers: kopf, body: rumpf, signal: abbruch })
  } catch (e) {
    const fehler = e as Error
    if (fehler.name === 'TimeoutError') {
      throw new Error(`Das Bildmodell hat nach ${Math.round(config.requestTimeoutMs / 1000)}s nicht geantwortet.`)
    }
    if (fehler.name === 'AbortError') throw fehler
    throw new Error(ohneGeheimnis(
      `${PROXY_UNERREICHBAR}: ${fehler.message}. Läuft EasyCLIProxyAPI auf ${config.proxyUrl}?`,
    ))
  }

  if (!antwort.ok) {
    const roh = await antwort.text().catch(() => '')
    throw new Error(ohneGeheimnis(`Das Bildmodell hat abgelehnt (HTTP ${antwort.status}): ${roh.slice(0, 400)}`))
  }

  const json = await antwort.json().catch(() => null) as
    { data?: { b64_json?: string; url?: string }[] } | null

  const b64 = json?.data?.[0]?.b64_json
  if (!b64) {
    // Eine URL wird NICHT nachgeladen: ein zweiter Aufruf an eine Adresse aus
    // einer Antwort ist genau der Weg, den die Sicherheitsregel ausschließt.
    throw new Error(
      json?.data?.[0]?.url
        ? 'Die Gegenstelle hat eine URL statt der Bilddaten geliefert. Dieser Weg lädt keine '
          + 'Adressen aus Antworten nach — den Proxy auf b64_json einstellen.'
        : 'Die Antwort enthielt kein Bild (data[0].b64_json fehlt).',
    )
  }

  const puffer = Buffer.from(b64, 'base64')
  if (puffer.length < 100) throw new Error('Die Antwort enthielt zu wenig Daten für ein Bild.')
  // Eigener ArrayBuffer statt eines Ausschnitts aus dem Node-Pool — sonst
  // haengt am Blob mehr Speicher als das Bild gross ist.
  return puffer.buffer.slice(puffer.byteOffset, puffer.byteOffset + puffer.byteLength) as ArrayBuffer
}

import {
  ANALYSE_PROMPT, ANALYSE_ANGABEN, jsonAusAntwort, type AnalyseArt,
} from '../../../src/lib/analyse-prompts'

/**
 * Analyse über Marks eigenen Proxy — die Fassung für die Erweiterung.
 *
 * WARUM DIE PROMPTS AUS DER APP IMPORTIERT WERDEN UND NICHT HIER STEHEN:
 * `src/lib/analyse-prompts.ts` ist frei stehend (keine eigenen Importe), also
 * kann Vite sie in dieses Bündel ziehen. Eine Kopie hier wäre genau die Drift,
 * gegen die diese Datei am 03.09.2026 angelegt wurde: Einer der beiden Texte
 * wird irgendwann geändert, der andere nicht, und die Ergebnisse in App und
 * Erweiterung laufen langsam auseinander, ohne dass etwas bricht.
 *
 * WARUM DIE ERWEITERUNG DEN PROXY ÜBERHAUPT ERREICHT: Sie hat `<all_urls>` in
 * den `host_permissions`. Anfragen aus einer Erweiterungsseite unterliegen
 * damit nicht denselben Schranken wie eine gewöhnliche Webseite — genau
 * deshalb geht hier ein Weg, der der App auf Vercel verwehrt wäre.
 *
 * WARUM EIGENE EINSTELLUNGEN: Die App legt ihre im `localStorage` ihres
 * Ursprungs ab, und dort kommt die Erweiterung nicht heran. Der Schlüssel muss
 * hier deshalb ein zweites Mal eingetragen werden. Nicht schön, aber ehrlich —
 * die Alternative wäre, ihn aus einem geöffneten App-Tab zu fischen, und das
 * würde still versagen, sobald der Tab zu ist.
 */

export const PROXY_SPEICHER = 'proxyEinstellungen'
export const PROXY_VORGABE_URL = 'http://localhost:8317'

export const PROXY_MODELLE = [
  { id: 'claude-opus-4-6',       beschreibung: 'Genaueste Beschreibung, ~16 s' },
  { id: 'gemini-3.6-flash-high', beschreibung: 'Am schnellsten, ~5 s, dafür knapper' },
  { id: 'gpt-5.4',               beschreibung: 'Am ausführlichsten, ~17 s' },
] as const

export const PROXY_VORGABE_MODELL: string = PROXY_MODELLE[0].id

export interface ProxyEinstellungen {
  url: string
  token: string
  modell: string
}

const LEER: ProxyEinstellungen = {
  url: PROXY_VORGABE_URL, token: '', modell: PROXY_VORGABE_MODELL,
}

export async function proxyLesen(): Promise<ProxyEinstellungen> {
  try {
    const g = await chrome.storage.local.get(PROXY_SPEICHER)
    const e = g?.[PROXY_SPEICHER] as Partial<ProxyEinstellungen> | undefined
    if (!e) return LEER
    return {
      url:    typeof e.url === 'string' && e.url.trim() ? e.url.trim() : PROXY_VORGABE_URL,
      token:  typeof e.token === 'string' ? e.token : '',
      modell: PROXY_MODELLE.some(m => m.id === e.modell) ? (e.modell as string) : PROXY_VORGABE_MODELL,
    }
  } catch {
    return LEER
  }
}

export async function proxySchreiben(e: ProxyEinstellungen): Promise<void> {
  try { await chrome.storage.local.set({ [PROXY_SPEICHER]: e }) } catch { /* egal */ }
}

export function proxyBereit(e: ProxyEinstellungen): boolean {
  return e.url.trim().length > 0 && e.token.trim().length > 0
}

/**
 * Adresse zurechtlegen — und `127.0.0.1` durch `localhost` ersetzen.
 *
 * Am 03.09.2026 in der App nachgemessen: Auf die blanke Zahlenadresse braucht
 * Chrome 20 019 ms, auf `localhost` 4 ms. Ob das in einer Erweiterung genauso
 * ist, wurde NICHT gemessen — aber es schadet nichts, und wenn es dieselbe
 * Ursache hat, spart es zwanzig Sekunden je Bild.
 */
export function basis(url: string): string {
  return url.trim()
    .replace(/\/+$/, '')
    .replace(/^(https?:\/\/)127\.0\.0\.1(?=[:/]|$)/i, '$1localhost')
}

/** Wie viele Modelle antworten — oder ein Satz, den man lesen kann. */
export async function proxyPruefen(
  e: ProxyEinstellungen,
): Promise<{ ok: true; anzahl: number } | { ok: false; text: string }> {
  if (!proxyBereit(e)) {
    return { ok: false, text: 'Adresse und Zugangsschlüssel fehlen noch.' }
  }
  try {
    const a = await fetch(`${basis(e.url)}/v1/models`, {
      headers: { Authorization: `Bearer ${e.token}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (a.status === 401 || a.status === 403) {
      return { ok: false, text: 'Der Proxy läuft, aber der Zugangsschlüssel stimmt nicht.' }
    }
    if (!a.ok) return { ok: false, text: `Der Proxy antwortete mit ${a.status}.` }
    const j = await a.json() as { data?: unknown[] }
    return { ok: true, anzahl: (j.data ?? []).length }
  } catch (err) {
    const name = (err as Error).name
    return {
      ok: false,
      text: name === 'TimeoutError'
        ? 'Der Proxy hat nicht rechtzeitig geantwortet.'
        : `Der Proxy unter ${e.url} ist nicht erreichbar. Läuft die CLIProxyAPI auf diesem Rechner?`,
    }
  }
}

/** Ein Bild analysieren lassen. Wirft, wenn etwas nicht klappt — der Aufrufer faellt dann zurueck. */
export async function analyseUeberProxy<T>(
  art: AnalyseArt,
  bildBase64: string,
  mediaType: string,
  e: ProxyEinstellungen,
  /**
   * Ein Modell nur fuer diesen einen Aufruf.
   *
   * WARUM: In Quick Capture stehen Modellknoepfe. Ohne diesen Weg waeren sie
   * wirkungslos, sobald der Proxy laeuft — ein Knopf, der nichts tut, ist
   * schlimmer als kein Knopf.
   */
  modellDiesmal?: string,
): Promise<T> {
  const angaben = ANALYSE_ANGABEN[art]
  const a = await fetch(`${basis(e.url)}/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${e.token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: modellDiesmal || e.modell,
      max_tokens: angaben.maxWorte,
      messages: [
        { role: 'system', content: ANALYSE_PROMPT[art] },
        { role: 'user', content: [
          { type: 'text', text: angaben.nutzerText },
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${bildBase64}` } },
        ]},
      ],
    }),
  })

  if (!a.ok) {
    const j = await a.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(j?.error?.message ?? `Der Proxy antwortete mit ${a.status}.`)
  }

  const j = await a.json() as { choices?: { message?: { content?: string } }[] }
  const roh = j.choices?.[0]?.message?.content?.trim()
  if (!roh) throw new Error('Der Proxy hat eine leere Antwort geliefert.')

  return angaben.ausgabe === 'json' ? jsonAusAntwort<T>(roh) : ({ prompt: roh } as T)
}

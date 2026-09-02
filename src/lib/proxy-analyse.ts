/**
 * Der Zugang zu Marks eigenem Proxy — ausschliesslich aus dem BROWSER.
 *
 * WARUM NICHT VOM SERVER: Die App laeuft auf Vercel, die CLIProxyAPI auf Marks
 * PC unter 127.0.0.1:8317. Ein Server bei Vercel kann diese Adresse nicht
 * erreichen — „localhost" ist dort SEIN eigener Rechner, nicht Marks. Der
 * einzige Teil der App, der auf demselben Geraet laeuft wie der Proxy, ist der
 * Browser. Deshalb geht dieser Weg durch den Browser, obwohl das ungewoehnlich
 * aussieht. Es ist keine Bequemlichkeit, es ist die einzige Moeglichkeit.
 *
 * WARUM DIE EINSTELLUNG IN localStorage LIEGT UND NICHT IN SUPABASE: Sie ist
 * rechnergebunden. Auf dem Handy waere ein Eintrag „127.0.0.1:8317" schlicht
 * falsch — dort laeuft kein Proxy, und die Analyse liefe jedes Mal erst in
 * einen Zeitfehler, bevor sie ueber die Route geht. Dazu kommt: ein
 * Zugangsschluessel gehoert nicht in eine Cloud-Datenbank, aus der er nie
 * wieder verschwindet.
 */

import { ANALYSE_PROMPT, ANALYSE_ANGABEN, jsonAusAntwort, type AnalyseArt } from '@/lib/analyse-prompts'

export const PROXY_SPEICHER_SCHLUESSEL = 'tresor.proxy'
// `localhost`, NICHT `127.0.0.1` — siehe die Messung bei `basis()` weiter unten.
export const PROXY_VORGABE_URL = 'http://localhost:8317'

/** Frist fuer eine Analyse. Gemessen wurden ~5-17 s; 60 s laesst reichlich Luft. */
const FRIST_MS = 60_000
/** Fuer den blossen Verbindungstest reicht deutlich weniger. */
const PRUEF_FRIST_MS = 10_000

/**
 * Die drei Modelle, die fuer die Bildanalyse in Frage kommen — die Zeiten sind
 * am 03.09.2026 gemessen, nicht geschaetzt. Der Proxy bietet 36 Modelle an;
 * eine Liste mit allen waere hier keine Freiheit, sondern eine Fehlerquelle:
 * die meisten sehen kein Bild und wuerden nur eine leere Antwort liefern.
 */
export const PROXY_MODELLE = [
  { id: 'claude-opus-4-6',       beschreibung: 'Genaueste Beschreibung, ~16 s' },
  { id: 'gemini-3.6-flash-high', beschreibung: 'Am schnellsten, ~5 s, dafür knapper' },
  { id: 'gpt-5.4',               beschreibung: 'Am ausführlichsten, ~17 s' },
] as const

export type ProxyModellId = typeof PROXY_MODELLE[number]['id']

export const PROXY_VORGABE_MODELL: string = PROXY_MODELLE[0].id

export interface ProxyEinstellungen {
  url: string
  token: string
  modell: string
}

const LEER: ProxyEinstellungen = { url: PROXY_VORGABE_URL, token: '', modell: PROXY_VORGABE_MODELL }

/**
 * Einstellungen lesen.
 *
 * JEDER Zugriff auf localStorage steht in try/catch — im privaten Fenster und
 * bei blockierten Seitendaten wirft schon das blosse Lesen. Ohne den Fang
 * faellt nicht die Proxy-Einstellung aus, sondern die ganze Seite.
 */
export function proxyEinstellungenLesen(): ProxyEinstellungen {
  if (typeof window === 'undefined') return LEER
  try {
    const roh = window.localStorage.getItem(PROXY_SPEICHER_SCHLUESSEL)
    if (!roh) return LEER
    const gelesen = JSON.parse(roh) as Partial<ProxyEinstellungen>
    return {
      url:    typeof gelesen.url    === 'string' && gelesen.url.trim() ? gelesen.url.trim() : PROXY_VORGABE_URL,
      token:  typeof gelesen.token  === 'string' ? gelesen.token : '',
      modell: typeof gelesen.modell === 'string' && gelesen.modell ? gelesen.modell : PROXY_VORGABE_MODELL,
    }
  } catch {
    return LEER
  }
}

/** Einstellungen schreiben. Gibt zurueck, ob es geklappt hat — stumm scheitern waere schlecht. */
export function proxyEinstellungenSchreiben(teil: Partial<ProxyEinstellungen>): boolean {
  if (typeof window === 'undefined') return false
  try {
    const neu = { ...proxyEinstellungenLesen(), ...teil }
    window.localStorage.setItem(PROXY_SPEICHER_SCHLUESSEL, JSON.stringify(neu))
    return true
  } catch {
    return false
  }
}

/** Ist der Proxy ueberhaupt eingerichtet? Ohne Adresse UND Schluessel: nein. */
export function proxyBereit(): boolean {
  const e = proxyEinstellungenLesen()
  return e.url.trim().length > 0 && e.token.trim().length > 0
}

/**
 * Die Adresse in die Form bringen, in der der Browser sie schnell erreicht.
 *
 * ZWEI DINGE PASSIEREN HIER, das zweite ist das wichtige.
 *
 * 1. Schraegstrich am Ende weg, sonst wird aus „…:8317/" ein „…:8317//v1/models".
 *
 * 2. `127.0.0.1` wird zu `localhost`. Am 03.09.2026 im Browser nachgemessen,
 *    derselbe Proxy, dieselbe Anfrage, nur die Schreibweise der Adresse:
 *
 *      http://127.0.0.1:8317   ->  401 nach 20 019 ms
 *      http://localhost:8317   ->  401 nach      4 ms
 *
 *    Viertausendfach. Und es ist verlaesslich, nicht einmalig — viermal
 *    hintereinander 3 bis 4 ms. Ausserhalb des Browsers (curl) ist die
 *    Zahlenadresse dagegen sofort da, es liegt also an Chrome und nicht am
 *    Proxy: Auf die blanke IP wendet er offenbar Pruefungen an, von denen der
 *    Name `localhost` ausgenommen ist.
 *
 *    Die Umschreibung passiert absichtlich HIER und nicht beim Speichern:
 *    Mark hat die Zahlenadresse bereits eingetragen, und die steht auch in der
 *    `worker/.env`, aus der er sie abschreibt. Es waere die falsche Antwort,
 *    ihn eine Adresse aendern zu lassen, die richtig ist — sie ist nur fuer
 *    den Browser die langsamere.
 */
function basis(url: string): string {
  return url.trim()
    .replace(/\/+$/, '')
    .replace(/^(https?:\/\/)127\.0\.0\.1(?=[:/]|$)/i, '$1localhost')
}

export const _basis = basis  // nur zum Pruefen

/**
 * Aus einem geworfenen Fehler einen Satz machen, den man lesen kann.
 *
 * „TypeError: Failed to fetch" sagt einem Menschen nichts — und es ist genau
 * der Fehler, der kommt, wenn der Proxy aus ist, also der haeufigste. Der
 * Hinweis auf das andere Geraet steht dabei, weil die zweithaeufigste Ursache
 * ist, dass die App gerade auf dem Handy laeuft.
 */
function fehlerSatz(err: unknown, url: string): string {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'Der Proxy hat nicht rechtzeitig geantwortet.'
  }
  if (err instanceof TypeError) {
    return `Der Proxy unter ${url} ist nicht erreichbar. Läuft die CLIProxyAPI auf diesem Rechner? (Auf einem anderen Gerät — etwa dem Handy — kann sie es nie sein.)`
  }
  return err instanceof Error ? err.message : 'Unbekannter Fehler beim Proxy-Zugriff.'
}

/** Abbruch nach Frist, ohne das Abbruchsignal des Aufrufers zu verlieren. */
function mitFrist(ms: number, fremd?: AbortSignal): { signal: AbortSignal; fertig: () => void } {
  const steuerung = new AbortController()
  const uhr = setTimeout(() => steuerung.abort(), ms)
  const weiterreichen = () => steuerung.abort()
  if (fremd) {
    if (fremd.aborted) steuerung.abort()
    else fremd.addEventListener('abort', weiterreichen)
  }
  return {
    signal: steuerung.signal,
    fertig: () => {
      clearTimeout(uhr)
      fremd?.removeEventListener('abort', weiterreichen)
    },
  }
}

export type ProxyPruefung =
  | { ok: true; anzahl: number }
  | { ok: false; fehler: string }

/**
 * Verbindungstest: Wie viele Modelle meldet der Proxy?
 *
 * Bewusst `/v1/models` und keine Probeanalyse — der Test soll sagen, ob
 * Adresse und Schluessel stimmen, und darf dafuer weder Wartezeit noch ein
 * Kontingent verbrauchen.
 */
export async function proxyPruefen(einstellungen?: ProxyEinstellungen): Promise<ProxyPruefung> {
  const e = einstellungen ?? proxyEinstellungenLesen()
  const adresse = basis(e.url)
  if (!adresse) return { ok: false, fehler: 'Es ist keine Adresse eingetragen.' }
  if (!e.token.trim()) return { ok: false, fehler: 'Es ist kein Zugangsschlüssel eingetragen.' }

  const { signal, fertig } = mitFrist(PRUEF_FRIST_MS)
  try {
    const res = await fetch(`${adresse}/v1/models`, {
      headers: { Authorization: `Bearer ${e.token.trim()}` },
      signal,
    })
    if (res.status === 401 || res.status === 403) {
      return { ok: false, fehler: `Der Zugangsschlüssel wird abgelehnt (HTTP ${res.status}).` }
    }
    if (!res.ok) {
      return { ok: false, fehler: `Der Proxy antwortet mit HTTP ${res.status}.` }
    }
    const daten = await res.json() as { data?: unknown[] }
    const anzahl = Array.isArray(daten.data) ? daten.data.length : 0
    if (anzahl === 0) return { ok: false, fehler: 'Der Proxy antwortet, meldet aber kein einziges Modell.' }
    return { ok: true, anzahl }
  } catch (err) {
    return { ok: false, fehler: fehlerSatz(err, adresse) }
  } finally {
    fertig()
  }
}

export interface ProxyAnalyseAuftrag {
  art: AnalyseArt
  /** Reines Base64 OHNE `data:`-Vorspann — so, wie die Aufrufer es ohnehin schon bauen. */
  bildBase64: string
  mediaType?: string
  modell?: string
  signal?: AbortSignal
}

/** Aus der Antwort den Text holen. Manche Modelle liefern Textstuecke statt eines Strings. */
function textAusAntwort(daten: unknown): string {
  const inhalt = (daten as {
    choices?: { message?: { content?: unknown } }[]
  })?.choices?.[0]?.message?.content

  if (typeof inhalt === 'string') return inhalt.trim()
  if (Array.isArray(inhalt)) {
    return inhalt
      .map(teil => (typeof teil === 'string' ? teil : (teil as { text?: string })?.text ?? ''))
      .join('')
      .trim()
  }
  return ''
}

/**
 * Eine Analyse ueber den Proxy laufen lassen.
 *
 * Prompt und Vorgaben kommen aus `analyse-prompts.ts` — DENSELBEN, die auch
 * die Server-Route benutzt. Nur so liefern beide Wege vergleichbare
 * Ergebnisse; zwei Kopien wuerden langsam auseinanderlaufen, und niemand
 * saehe es.
 */
export async function analysiereUeberProxy<T = unknown>(auftrag: ProxyAnalyseAuftrag): Promise<T> {
  const e = proxyEinstellungenLesen()
  const adresse = basis(e.url)
  if (!adresse) throw new Error('Es ist keine Proxy-Adresse eingetragen.')
  if (!e.token.trim()) throw new Error('Es ist kein Proxy-Zugangsschlüssel eingetragen.')

  const angaben = ANALYSE_ANGABEN[auftrag.art]
  const mime = (auftrag.mediaType ?? 'image/jpeg').split(';')[0].trim() || 'image/jpeg'
  const { signal, fertig } = mitFrist(FRIST_MS, auftrag.signal)

  try {
    const res = await fetch(`${adresse}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${e.token.trim()}`,
      },
      signal,
      body: JSON.stringify({
        model: auftrag.modell ?? e.modell ?? PROXY_VORGABE_MODELL,
        max_tokens: angaben.maxWorte,
        messages: [
          { role: 'system', content: ANALYSE_PROMPT[auftrag.art] },
          {
            role: 'user',
            content: [
              // Bild als data-URI: Der Proxy spricht das OpenAI-Format, und eine
              // Supabase-URL koennte er im Zweifel gar nicht selbst laden.
              { type: 'image_url', image_url: { url: `data:${mime};base64,${auftrag.bildBase64}` } },
              { type: 'text', text: angaben.nutzerText },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      const roh = await res.text().catch(() => '')
      throw new Error(`Der Proxy antwortet mit HTTP ${res.status}${roh ? ` — ${roh.slice(0, 200)}` : ''}`)
    }

    const text = textAusAntwort(await res.json())
    if (!text) throw new Error('Der Proxy hat eine leere Antwort geliefert.')

    if (angaben.ausgabe === 'json') return jsonAusAntwort<T>(text)
    return text as unknown as T
  } catch (err) {
    // Der Aufrufer faellt hierauf auf die Server-Route zurueck. Damit in der
    // Meldung nicht „Failed to fetch" steht, wird hier uebersetzt.
    throw new Error(fehlerSatz(err, adresse))
  } finally {
    fertig()
  }
}

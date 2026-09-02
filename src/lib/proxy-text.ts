import {
  proxyEinstellungenLesen, proxyBereit, _basis,
} from '@/lib/proxy-analyse'

/**
 * Prompts schreiben lassen — Text statt Bild, über denselben Proxy.
 *
 * Mark am 03.09.2026: „Oft habe ich zwar eine Idee von irgendwas, kann das aber
 * nicht genau ausdrücken und dann frage ich einfach … nach einem Prompt zum
 * Beispiel für irgendwas und der wird mir dann ausgegeben."
 *
 * WARUM EIGENE MODELLE UND NICHT DIE AUS `proxy-analyse`: Ein Bild ansehen und
 * einen Prompt schreiben sind zwei verschiedene Aufgaben, und die Modelle sind
 * darin verschieden gut. Am 03.09.2026 an derselben Frage gemessen („alter
 * Fischer, neblig, morgens am Meer, melancholisch"):
 *
 *   claude-opus-5           7,4 s   1111 Zeichen — nennt sogar die Bildaufteilung
 *   claude-sonnet-5         5,9 s   1070 Zeichen
 *   gpt-5.6-sol             5,8 s    968 Zeichen
 *   gemini-3.8-flash-high   4,0 s    657 Zeichen — griff als einziges 16:9 von selbst auf
 *
 * WARUM KEIN RÜCKFALL AUF EINEN BEZAHLTEN DIENST: Bei den Analysen gab es
 * einen bestehenden bezahlten Weg, auf den zurückgefallen wird. Hier gibt es
 * keinen — und ein neues Feld, das ungefragt Geld ausgibt, wäre die falsche
 * Voreinstellung. Ist der Proxy aus, sagt es das.
 */

export const TEXT_MODELLE = [
  { id: 'claude-opus-5',         beschreibung: 'Genaueste Prompts, ~7 s' },
  { id: 'claude-sonnet-5',       beschreibung: 'Fast so gut, etwas schneller' },
  { id: 'gemini-3.8-flash-high', beschreibung: 'Am schnellsten, ~4 s, kompakter' },
] as const

export type TextModellId = typeof TEXT_MODELLE[number]['id']
export const TEXT_VORGABE_MODELL: string = TEXT_MODELLE[0].id

/** Wo die Modellwahl des Assistenten liegt — getrennt von der der Analyse. */
export const TEXT_MODELL_SCHLUESSEL = 'tresor.prompt-modell'

export function textModellLesen(): string {
  try {
    const w = localStorage.getItem(TEXT_MODELL_SCHLUESSEL)
    return TEXT_MODELLE.some(m => m.id === w) ? (w as string) : TEXT_VORGABE_MODELL
  } catch {
    return TEXT_VORGABE_MODELL
  }
}

export function textModellSchreiben(id: string): void {
  try { localStorage.setItem(TEXT_MODELL_SCHLUESSEL, id) } catch { /* egal */ }
}

export type Zusammenhang = {
  /** Welches Bildmodell den Prompt später ausführt. */
  bildModell: string
  /** Das gewählte Format, in Worten („Landscape (16:9)"). */
  format: string
  /** Liegen Referenzbilder an? */
  referenzen: number
}

/**
 * Die Anweisung an das Textmodell.
 *
 * WARUM DER ZUSAMMENHANG MIT HINEINGEHT: Ein Prompt für gpt-image-2 sieht
 * anders aus als einer für Gemini, und mit Referenzbild richtet sich gpt-image-2
 * nach der Vorlage statt nach dem Größenparameter (am 01.09.2026 gemessen).
 * Ohne diese Angaben schriebe der Assistent Prompts für ein Werkzeug, das gar
 * nicht benutzt wird.
 */
export function anweisung(z: Zusammenhang): string {
  const zeilen = [
    'Du bist Prompt-Ingenieur für KI-Bildgeneratoren.',
    '',
    'Der Nutzer beschreibt auf Deutsch, was ihm vorschwebt — oft vage. Deine',
    'Aufgabe: daraus EINEN fertigen, ausführlichen Bildprompt auf ENGLISCH machen.',
    '',
    `Zielmodell: ${z.bildModell}. Gewähltes Format: ${z.format}.`,
  ]

  if (z.referenzen > 0) {
    zeilen.push(
      '',
      `Es ${z.referenzen === 1 ? 'liegt 1 Referenzbild' : `liegen ${z.referenzen} Referenzbilder`} an.`,
      'Beziehe dich ausdrücklich darauf („Use the provided reference…") und',
      'beschreibe NICHT das Aussehen der Person — das liefert die Referenz.',
    )
  }

  zeilen.push(
    '',
    'Regeln:',
    '- Antworte NUR mit dem Prompt. Keine Einleitung, keine Erklärung, keine Anführungszeichen.',
    '- Deck ab: Motiv, Bildausschnitt und Kamerawinkel, Licht, Farbstimmung, Umgebung, Stil, Qualität.',
    '- Schreib in kommagetrennten beschreibenden Wendungen.',
    '- Wo der Nutzer vage bleibt, triff eine begründete Wahl statt zu fragen.',
    '- Bittet der Nutzer um eine Änderung („kürzer", „mehr Nebel"), gib den',
    '  VOLLSTÄNDIGEN überarbeiteten Prompt zurück, nicht nur den geänderten Teil.',
  )
  return zeilen.join('\n')
}

export type Nachricht = { rolle: 'nutzer' | 'assistent'; text: string }

export class ProxyAus extends Error {
  constructor() {
    super('Der eigene Proxy ist nicht eingerichtet. Trag ihn in den Einstellungen ein — ohne ihn kann hier nichts geschrieben werden.')
  }
}

/**
 * Einen Prompt schreiben (oder überarbeiten) lassen.
 *
 * `verlauf` trägt das bisherige Hin und Her: Genau das Nachschärfen ist der
 * Grund, warum Mark sonst in einen Chat wechselt. Ein einzelner Schuss reicht
 * nicht.
 */
export async function promptSchreiben(
  verlauf: Nachricht[],
  z: Zusammenhang,
  optionen: { modell?: string; signal?: AbortSignal } = {},
): Promise<string> {
  const e = proxyEinstellungenLesen()
  if (!proxyBereit()) throw new ProxyAus()

  const modell = optionen.modell ?? textModellLesen()
  // Eine Frist für den GANZEN Vorgang, Fortsetzungen eingeschlossen. Die
  // längste gemessene Antwort brauchte 74 Sekunden.
  const frist = AbortSignal.timeout(GESAMTFRIST_MS)
  const abbruch = optionen.signal
    ? AbortSignal.any([optionen.signal, frist])
    : frist

  const nachrichten: { role: string; content: string }[] = [
    { role: 'system', content: anweisung(z) },
    ...verlauf.map(n => ({
      role: n.rolle === 'nutzer' ? 'user' : 'assistant',
      content: n.text,
    })),
  ]

  let gesamt = ''
  for (let runde = 0; runde <= MAX_FORTSETZUNGEN; runde++) {
    const { text, abgeschnitten } = await einRuf(nachrichten, modell, e, abbruch)
    gesamt += text

    if (!abgeschnitten) break

    if (runde === MAX_FORTSETZUNGEN) {
      // Nach so vielen Runden nicht weiter — aber AUCH NICHT SCHWEIGEN. Genau
      // das stille Abschneiden hat Mark gemeldet: Man sieht der Antwort nicht
      // an, ob das Modell fertig war oder abgewürgt wurde.
      gesamt += '\n\n[Hier bricht es ab — auch nach '
        + `${MAX_FORTSETZUNGEN + 1} Anläufen war die Antwort noch nicht zu Ende. `
        + 'Frag nach dem Rest.]'
      break
    }

    // Fortsetzen: Das bisher Geschriebene geht als Zug des Assistenten mit,
    // damit das Modell weiß, wo es stand.
    nachrichten.push({ role: 'assistant', content: text })
    nachrichten.push({
      role: 'user',
      content: 'Mach genau dort weiter, wo du aufgehört hast. Keine Wiederholung, '
        + 'keine Einleitung, kein erneutes Nummerieren — setz den Satz fort.',
    })
  }

  return saeubern(gesamt)
}

/**
 * Wie lang eine Antwort werden darf.
 *
 * WARUM 8000 UND NICHT 1200: Mark am 03.09.2026 — „die wurden aber irgendwann
 * abgeschnitten … der sollte beliebig lang sein". Nachgestellt mit einer Frage
 * nach zwölf ausführlichen Prompts:
 *
 *   max_tokens 1200  ->  finish_reason „length",   2802 Zeichen, mitten im Satz
 *   max_tokens 8000  ->  finish_reason „stop",    10795 Zeichen, vollständig
 *
 * Und weil auch 8000 irgendwann nicht reichen, wird bei „length" von selbst
 * fortgesetzt. Erst das macht die Antwort wirklich beliebig lang — eine höhere
 * feste Grenze wäre nur eine Grenze weiter hinten.
 */
const MAX_WORTE = 8000
const MAX_FORTSETZUNGEN = 3
const GESAMTFRIST_MS = 300_000

/** Ein einzelner Ruf. Meldet mit, ob das Modell mittendrin aufhören musste. */
async function einRuf(
  nachrichten: { role: string; content: string }[],
  modell: string,
  e: { url: string; token: string },
  signal: AbortSignal,
): Promise<{ text: string; abgeschnitten: boolean }> {
  const antwort = await fetch(`${_basis(e.url)}/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${e.token}`, 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ model: modell, max_tokens: MAX_WORTE, messages: nachrichten }),
  })

  if (!antwort.ok) {
    const j = await antwort.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(
      j?.error?.message
        ? `Der Proxy meldet: ${j.error.message}`
        : `Der Proxy antwortete mit ${antwort.status}.`,
    )
  }

  const j = await antwort.json() as {
    choices?: { message?: { content?: string }; finish_reason?: string }[]
  }
  const wahl = j.choices?.[0]
  const text = wahl?.message?.content
  if (!text) throw new Error('Der Proxy hat eine leere Antwort zurückgegeben.')

  return { text, abgeschnitten: wahl?.finish_reason === 'length' }
}

/**
 * Zaun und Anführungszeichen abstreifen.
 *
 * Manche Modelle setzen sie trotz Anweisung darum — im Prompt-Feld wäre das
 * sichtbarer Unrat.
 */
function saeubern(text: string): string {
  return text
    .replace(/^```(?:\w+)?\n?/, '')
    .replace(/\n?```$/, '')
    .replace(/^["„»]|["“«]$/g, '')
    .trim()
}

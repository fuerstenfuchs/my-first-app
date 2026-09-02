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
  const frist = AbortSignal.timeout(120_000)
  const abbruch = optionen.signal
    ? AbortSignal.any([optionen.signal, frist])
    : frist

  const antwort = await fetch(`${_basis(e.url)}/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${e.token}`, 'Content-Type': 'application/json' },
    signal: abbruch,
    body: JSON.stringify({
      model: modell,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: anweisung(z) },
        ...verlauf.map(n => ({
          role: n.rolle === 'nutzer' ? 'user' : 'assistant',
          content: n.text,
        })),
      ],
    }),
  })

  if (!antwort.ok) {
    const j = await antwort.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(
      j?.error?.message
        ? `Der Proxy meldet: ${j.error.message}`
        : `Der Proxy antwortete mit ${antwort.status}.`,
    )
  }

  const j = await antwort.json() as { choices?: { message?: { content?: string } }[] }
  const text = j.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('Der Proxy hat einen leeren Prompt zurückgegeben.')

  // Manche Modelle setzen trotz Anweisung Anführungszeichen oder einen Zaun
  // darum. Das wäre im Prompt-Feld sichtbarer Unrat.
  return text
    .replace(/^```(?:\w+)?\n?/, '')
    .replace(/\n?```$/, '')
    .replace(/^["„»]|["“«]$/g, '')
    .trim()
}

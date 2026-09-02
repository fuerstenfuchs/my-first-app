/**
 * Der Gemini-Weg: ein vorhandenes Bild in hoher Auflösung nachbauen lassen.
 *
 * Das ist KEIN Vergrößerer. Gemini rechnet das Bild neu — es kopiert keine
 * Bildpunkte. Deshalb kommt mehr Auflösung heraus, als jeder Upscaler liefert
 * (aus 1122×1402 werden 3712×4608), aber das Ergebnis ist eine Nachbildung.
 * Bei Gesichtern ist das der entscheidende Vorbehalt: Am 02.09.2026 an einem
 * Porträt geprüft — dieselbe Frau, aber Brauenform und Lidfalte saßen anders.
 * Für Landschaften, Räume und Gegenstände ist es unproblematisch.
 *
 * Es läuft über Marks antigravity-Anmeldung im lokalen Proxy und kostet daher
 * nichts extra.
 *
 * WICHTIG — was am selben Tag gemessen wurde: Gemini ist NICHT auf
 * `/v1/images/generations` erreichbar (dort HTTP 400), sondern nur auf dem
 * nativen Weg. Und es kennt kein `size` in Pixeln, sondern Seitenverhältnis
 * plus Größenklasse getrennt.
 */

import sharp from 'sharp'
import { config, ohneGeheimnis } from './config.ts'

const MODELL = 'gemini-3.1-flash-image'

/** Was Google annimmt — von Google selbst gemeldet, nicht geraten. */
export const SEITENVERHAELTNISSE = [
  '1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4',
  '8:1', '9:16', '16:9', '21:9',
] as const

export const GROESSENKLASSEN = ['512', '512P', '512PX', '1K', '2K', '4K'] as const

/**
 * Der Auftrag an Gemini — an einer Stelle, weil jede Zeile darin erarbeitet ist.
 *
 * Fassung 1 sagte nur „ändere nichts". Ergebnis: Gemini hat die Haut geglättet,
 * Falten entfernt und die Frau sichtbar verjüngt. Die Abschnitte IDENTITY und
 * SHARPNESS sind die Antwort darauf — mit ihnen kamen die Falten zurück.
 *
 * Der Abschnitt COLOUR steht hier, WEIL ER NICHT WIRKT. Gemessen: Der
 * Farbabstand zum Original lag ohne ihn bei 5,76 und mit ihm bei 6,10 — also
 * unverändert. Der Farbstich (Rot +3,6, Blau +4,5, Grün gleich, also Richtung
 * Magenta) lässt sich nicht wegformulieren, er entsteht beim Neurechnen. Er
 * bleibt trotzdem stehen, damit niemand ihn ein zweites Mal „noch dazuschreibt"
 * in der Annahme, es hätte nur gefehlt. Repariert wird er hinterher, in
 * `farbeAngleichen()`.
 */
export const UPSCALE_PROMPT = [
  'Reproduce this exact photograph at higher resolution. This is an UPSCALING task,',
  'not an edit and not a reinterpretation.',
  '',
  'IDENTITY — must not change: the same person, the same facial structure and',
  'proportions, every existing wrinkle, fold, pore, freckle and blemish exactly',
  'where it is. Do NOT smooth the skin. Do NOT beautify. Do NOT make the person',
  'look younger, healthier or slimmer. Do NOT remove or soften a single line.',
  'Same hair, same jewellery, same garment and its exact pattern, same pose,',
  'same framing and crop, same background.',
  '',
  'COLOUR — must not change: keep the identical colours, white balance, skin tone,',
  'saturation, contrast and brightness of the input. Do NOT warm it, do NOT cool it,',
  'do NOT add any magenta, pink or amber cast, do NOT grade or stylise.',
  '',
  'SHARPNESS — this is what you add: render crisp, high-acutance detail exactly as a',
  'high-resolution camera would resolve this same scene. Individual hairs and',
  'eyelashes clearly separated, skin pores and fine wrinkle lines distinctly visible,',
  'fabric weave and knit structure resolved thread by thread. No softening, no blur,',
  'no denoising, no plastic or waxy skin.',
].join('\n')

/**
 * Das Seitenverhältnis wählen, das den Maßen am nächsten kommt.
 *
 * Ohne das schneidet Gemini um: Es rechnet immer in eines seiner Verhältnisse,
 * und welches, entscheidet es sonst selbst.
 */
export function bestesVerhaeltnis(breite: number, hoehe: number): string {
  const ziel = breite / hoehe
  let beste = '1:1'
  let abstand = Infinity
  for (const v of SEITENVERHAELTNISSE) {
    const [a, b] = v.split(':').map(Number)
    const d = Math.abs(a / b - ziel)
    if (d < abstand) { abstand = d; beste = v }
  }
  return beste
}

/**
 * Die Farben auf das Original zurückführen.
 *
 * Je Kanal eine Gerade (aus = ein × Faktor + Versatz), so gewählt, dass
 * Mittelwert und Streuung wieder denen des Originals entsprechen. Gemessen am
 * 02.09.2026: Der Farbabstand fiel damit von 6,10 auf 1,30 — der Rest kommt
 * vom neu gerechneten Bildinhalt und ist kein Farbstich mehr.
 *
 * Rechnerisch, kostenlos, und im Gegensatz zum Prompt wirkt es zuverlässig.
 */
export async function farbeAngleichen(
  ergebnis: Buffer, vorbild: Buffer,
): Promise<Buffer> {
  const [z, q] = await Promise.all([
    sharp(vorbild).stats(),
    sharp(ergebnis).stats(),
  ])
  const kanaele = [0, 1, 2]
  const faktor = kanaele.map(i => z.channels[i].stdev / (q.channels[i].stdev || 1))
  const versatz = kanaele.map(i => z.channels[i].mean - faktor[i] * q.channels[i].mean)

  return sharp(ergebnis).linear(faktor, versatz).jpeg({ quality: 95 }).toBuffer()
}

export type GeminiErgebnis = {
  daten: Buffer
  breite: number
  hoehe: number
  verhaeltnis: string
  klasse: string
}

export async function bildNachbauen(
  quelle: Buffer,
  klasse: typeof GROESSENKLASSEN[number] = '4K',
  optionen: { farbeAngleichen?: boolean; signal?: AbortSignal } = {},
): Promise<GeminiErgebnis> {
  const info = await sharp(quelle).metadata()
  if (!info.width || !info.height) {
    throw new Error('Das Ausgangsbild hat keine lesbaren Maße.')
  }
  const verhaeltnis = bestesVerhaeltnis(info.width, info.height)

  const antwort = await fetch(
    `${config.proxyUrl}/v1beta/models/${MODELL}:generateContent`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.proxyToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { inline_data: { mime_type: 'image/png', data: quelle.toString('base64') } },
            { text: UPSCALE_PROMPT },
          ],
        }],
        generationConfig: { imageConfig: { aspectRatio: verhaeltnis, imageSize: klasse } },
      }),
      signal: optionen.signal ?? AbortSignal.timeout(config.requestTimeoutMs),
    },
  )

  const roh = await antwort.text()
  if (!antwort.ok) {
    throw new Error(ohneGeheimnis(`Gemini → HTTP ${antwort.status}: ${roh.slice(0, 400)}`))
  }

  const j = JSON.parse(roh) as {
    candidates?: { content?: { parts?: Record<string, { data?: string }>[] } }[]
  }
  const teile = j.candidates?.[0]?.content?.parts ?? []
  // Der Proxy reicht mal `inlineData`, mal `inline_data` durch — je nachdem,
  // welchen Weg die Antwort genommen hat.
  const treffer = teile.find(p => p.inlineData?.data || p.inline_data?.data)
  const daten = treffer?.inlineData?.data ?? treffer?.inline_data?.data
  if (!daten) throw new Error('Gemini hat kein Bild zurückgegeben.')

  // Ausdruecklich ArrayBufferLike: sharps toBuffer() liefert diesen Typ, und
  // ohne die Angabe leitet TypeScript vom Buffer.from() den engeren ab.
  let bild: Buffer<ArrayBufferLike> = Buffer.from(daten, 'base64')
  if (optionen.farbeAngleichen !== false) {
    bild = await farbeAngleichen(bild, quelle)
  }

  const m = await sharp(bild).metadata()
  return {
    daten: bild,
    breite: m.width ?? 0,
    hoehe: m.height ?? 0,
    verhaeltnis,
    klasse,
  }
}

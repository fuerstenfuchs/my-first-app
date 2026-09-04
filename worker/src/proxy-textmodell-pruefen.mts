/**
 * Läuft das TEXTMODELL des Proxys gerade — oder ist das Kontingent leer?
 *
 * WARUM `npm run pruefen` das nicht beantwortet: Das prüft nur, ob der Proxy
 * erreichbar ist und ob das Modell in seiner Liste steht. Ob dahinter noch
 * Kontingent liegt, sieht man erst, wenn man wirklich etwas fragt — am
 * 04.09.2026 stand `gpt-image-2` in der Liste und lieferte trotzdem HTTP 429.
 *
 * Fragt mit dem kleinstmöglichen Auftrag: ein Wort, ein Token Antwort.
 *
 * Aufruf:
 *   cd worker && node --env-file=.env src/proxy-textmodell-pruefen.mts [modell]
 */

import { config, ohneGeheimnis } from './config.ts'

const modell = process.argv[2] ?? 'gpt-5.4'

console.log(`Frage ${config.proxyUrl} nach dem Modell ${modell} …`)

const antwort = await fetch(`${config.proxyUrl}/v1/chat/completions`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${config.proxyToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: modell,
    messages: [{ role: 'user', content: 'ok' }],
    max_tokens: 1,
  }),
  signal: AbortSignal.timeout(60_000),
}).catch((e: Error) => {
  console.error(ohneGeheimnis(`Proxy nicht erreichbar: ${e.message}`))
  process.exit(1)
})

const text = await antwort.text()

if (antwort.ok) {
  console.log(`\n[ok] ${modell} antwortet. Die Analyse läuft über den Proxy.`)
  process.exit(0)
}

console.log(`\n[nein] HTTP ${antwort.status}`)
console.log(ohneGeheimnis(text.slice(0, 400)))

const zeit = text.match(/"reset_time"\s*:\s*"([^"]+)"/)?.[1]
if (zeit) console.log(`\nWieder frei in: ${zeit}`)
if (/usage_limit_reached|cooling down/.test(text)) {
  console.log('Das Kontingent ist erschöpft — die Analyse fällt auf den bezahlten Dienst zurück.')
}
process.exit(2)

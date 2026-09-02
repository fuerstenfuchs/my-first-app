/**
 * Ein Bild von Hand über Gemini in hohe Auflösung bringen.
 *
 *   npm run gross -- bild.png [ziel.jpg] [4K|2K|1K]
 *
 * Warum als eigener Befehl und nicht in der Warteschlange: Der Gemini-Weg ist
 * kein Vergrößern, sondern ein Nachbau — bei Gesichtern muss man das Ergebnis
 * ansehen und entscheiden, ob es die Figur noch ist. Solange das keine
 * Routineentscheidung ist, gehört es nicht in einen Knopf, der nebenbei
 * geklickt wird.
 *
 * Kostet nichts extra: läuft über Marks antigravity-Anmeldung im Proxy.
 */

import fs from 'node:fs'
import path from 'node:path'
import { bildNachbauen, GROESSENKLASSEN } from './gemini.ts'

const [quelle, zielRoh, klasseRoh] = process.argv.slice(2)

if (!quelle) {
  console.error(`
Bild in hoher Auflösung nachbauen lassen.

  npm run gross -- <bild> [ziel] [${GROESSENKLASSEN.join('|')}]

Ohne Ziel wird neben das Original geschrieben, mit "-gross" im Namen.
Ohne Klasse wird 4K genommen.
`)
  process.exit(1)
}

if (!fs.existsSync(quelle)) {
  console.error(`Die Datei gibt es nicht: ${quelle}`)
  process.exit(1)
}

const klasse = (klasseRoh ?? '4K') as typeof GROESSENKLASSEN[number]
if (!GROESSENKLASSEN.includes(klasse)) {
  console.error(`"${klasse}" ist keine Größenklasse. Erlaubt: ${GROESSENKLASSEN.join(', ')}`)
  process.exit(1)
}

const ziel = zielRoh ?? path.join(
  path.dirname(quelle),
  `${path.basename(quelle, path.extname(quelle))}-gross.jpg`,
)

const eingang = fs.readFileSync(quelle)
console.log(`Quelle: ${quelle} (${Math.round(eingang.length / 1024)} kB)`)
console.log('Gemini rechnet…')

const begonnen = Date.now()
try {
  const e = await bildNachbauen(eingang, klasse)
  fs.writeFileSync(ziel, e.daten)
  console.log(
    `Fertig: ${e.breite}×${e.hoehe} (${e.verhaeltnis}, ${e.klasse}) ` +
    `in ${Math.round((Date.now() - begonnen) / 1000)}s · ` +
    `${Math.round(e.daten.length / 1024)} kB`,
  )
  console.log(`Datei:  ${ziel}`)
  console.log('Farben wurden auf das Original zurückgerechnet.')
} catch (e) {
  console.error(`Fehlgeschlagen: ${(e as Error).message}`)
  process.exit(1)
}

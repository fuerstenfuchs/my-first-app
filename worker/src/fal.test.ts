/**
 * Wächter über die Adressprüfung der fal.ai-Anbindung.
 *
 * WARUM AUSGERECHNET DIESE FUNKTION GEPRÜFT WIRD: Der Arbeiter lädt am Ende
 * eine Adresse herunter, die aus einer fremden Antwort stammt. Fiele die
 * Prüfung weg oder würde sie zu großzügig, wäre das ein Weg, ihn beliebige
 * Adressen abrufen zu lassen — auch `http://127.0.0.1:8317`, wo der Bild-Proxy
 * mitsamt Token lauscht. Ein Tippfehler in der Hostliste sieht harmlos aus und
 * fällt beim Ausprobieren nie auf, weil der gute Fall weiter funktioniert.
 *
 * Läuft mit: npm run test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

// Die Konfiguration verlangt beim Laden Pflichtwerte und beendet sonst den
// Prozess. Deshalb erst die Umgebung setzen, dann das Modul holen.
process.env.PROXY_URL ??= 'http://127.0.0.1:8317'
process.env.PROXY_TOKEN ??= 'test'
process.env.SUPABASE_URL ??= 'https://beispiel.supabase.co'
process.env.SUPABASE_SERVICE_KEY ??= 'test'

const { hostErlaubt, datenAdresse } = await import('./fal.ts')

/*
 * DER TYP IN DER DATA-ADRESSE FOLGT DEN BYTES (15.09.2026).
 * Vorher stand fest `data:image/png`. Mark hat entschieden, große Bilder an
 * derselben Adresse durch WebP zu ersetzen — `0.png` enthält dann WebP. Ab
 * dem Absenden kostet es Geld; ein falscher Typ darf dort nicht hinausgehen.
 */
test('datenAdresse nennt den echten Typ, nicht den aus dem Namen', () => {
  const webp = Buffer.from([0x52,0x49,0x46,0x46, 1,2,3,4, 0x57,0x45,0x42,0x50, 9,9])
  const jpg  = Buffer.from([0xff,0xd8,0xff,0xe0, 0,0,0,0, 0,0,0,0])
  const png  = Buffer.from([0x89,0x50,0x4e,0x47, 0x0d,0x0a,0x1a,0x0a, 0,0,0,0])
  assert.ok(datenAdresse(webp).startsWith('data:image/webp;base64,'))
  assert.ok(datenAdresse(jpg).startsWith('data:image/jpeg;base64,'))
  assert.ok(datenAdresse(png).startsWith('data:image/png;base64,'))
  // Auch aus einem ArrayBuffer, wie ihn `ergebnisHolen` liefert — und die
  // Bytes müssen vollständig ankommen.
  const ab = webp.buffer.slice(webp.byteOffset, webp.byteOffset + webp.length)
  assert.equal(datenAdresse(ab), `data:image/webp;base64,${webp.toString('base64')}`)
})

test('datenAdresse lehnt Nicht-Bilder ab, bevor etwas bezahlt wird', () => {
  assert.throws(() => datenAdresse(Buffer.from('<!DOCTYPE html><html>oops</html>')), /kein erkennbares Bild/)
})

test('erlaubt die Adressen von fal.ai', () => {
  for (const url of [
    'https://queue.fal.run/fal-ai/seedvr/requests/abc/status',
    'https://fal.media/files/abc/bild.png',
    'https://v3.fal.media/files/abc/bild.png',
    'https://cdn.fal.media/files/abc/bild.png',
  ]) {
    assert.equal(hostErlaubt(url), true, url)
  }
})

test('lehnt alles andere ab', () => {
  for (const url of [
    // Der Bild-Proxy auf diesem Rechner — das eigentliche Ziel eines Angriffs.
    'http://127.0.0.1:8317/v1/models',
    'https://127.0.0.1:8317/v1/models',
    'http://localhost/',
    // Metadatendienst von Cloud-Anbietern, der klassische Fall.
    'http://169.254.169.254/latest/meta-data/',
    // Sieht aus wie fal, ist es aber nicht: Der Punkt davor fehlt.
    'https://boesefal.media/bild.png',
    'https://fal.media.angreifer.de/bild.png',
    // Richtiger Host, falsches Protokoll — abhörbar.
    'http://fal.media/files/abc/bild.png',
    'file:///C:/Users/markg/.ssh/id_rsa',
    'nicht einmal eine URL',
    '',
  ]) {
    assert.equal(hostErlaubt(url), false, url)
  }
})

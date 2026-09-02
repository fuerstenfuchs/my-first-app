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

const { hostErlaubt } = await import('./fal.ts')

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

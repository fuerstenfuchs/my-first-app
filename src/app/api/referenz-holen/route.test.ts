import { describe, it, expect } from 'vitest'
import { istInternesZiel } from './route'

/**
 * Die Wache gegen SSRF — festgenagelt, nicht kommentiert.
 *
 * Diese Route holt eine Adresse, die von außen kommt: Mark zieht ein Bild von
 * irgendeiner Webseite herein, und der Server geht hin und lädt es. Fällt die
 * Prüfung aus, ist das ein Weg, den Server für sich sprechen zu lassen — auf
 * `127.0.0.1:8317` (Marks Proxy, mit seinem Zugangsschlüssel), auf
 * `169.254.169.254` (Metadatenadresse der Cloud-Anbieter, klassischer
 * Schlüsseldiebstahl) oder auf jede Maschine im selben Netz.
 *
 * Eine Wache, die man nicht prüft, ist eine Vermutung. Deshalb steht hier jede
 * Sorte Adresse einzeln, mit ihrem Grund.
 */

describe('istInternesZiel — was nicht geholt werden darf', () => {
  const gesperrt: [string, string][] = [
    ['127.0.0.1',        'Schleife — hier liefe Marks Proxy auf 8317'],
    ['127.1.2.3',        'die ganze 127er-Schleife, nicht nur .0.1'],
    ['0.0.0.0',          'steht auf vielen Systemen für „diese Maschine"'],
    ['10.0.0.5',         'privates Netz'],
    ['172.16.0.1',       'privates Netz, untere Kante'],
    ['172.31.255.254',   'privates Netz, obere Kante'],
    ['192.168.1.1',      'Heimnetz — hier stünde Marks Router'],
    ['169.254.169.254',  'Cloud-Metadaten: der bekannteste SSRF-Zielpunkt'],
    ['100.64.0.1',       'Carrier-NAT'],
    ['224.0.0.1',        'Multicast'],
    ['255.255.255.255',  'Rundruf'],
    ['::1',              'Schleife in IPv6'],
    ['::',               'unbestimmte Adresse'],
    ['fd00::1',          'eindeutig lokal (IPv6-Gegenstück zum privaten Netz)'],
    ['fe80::1',          'Link-Local in IPv6'],
    ['ff02::1',          'Multicast in IPv6'],
    ['::ffff:127.0.0.1', 'IPv4 in IPv6 verpackt — die klassische Lücke'],
    ['::ffff:192.168.0.1', 'privates Netz, in IPv6 verpackt'],
    ['kein.ip',          'nicht deutbar — im Zweifel nein'],
    ['',                 'leer'],
  ]

  for (const [ip, grund] of gesperrt) {
    it(`sperrt ${ip || '(leer)'} — ${grund}`, () => {
      expect(istInternesZiel(ip)).toBe(true)
    })
  }
})

describe('istInternesZiel — was durchgelassen wird', () => {
  const erlaubt: [string, string][] = [
    ['1.1.1.1',           'öffentlicher Namensdienst'],
    ['8.8.8.8',           'öffentlich'],
    ['93.184.216.34',     'example.com'],
    ['172.15.0.1',        'knapp UNTER dem privaten 172.16er-Block'],
    ['172.32.0.1',        'knapp ÜBER dem privaten 172.31er-Block'],
    ['192.167.1.1',       'knapp neben 192.168'],
    ['100.63.0.1',        'knapp unter Carrier-NAT'],
    ['100.128.0.1',       'knapp über Carrier-NAT'],
    ['169.253.0.1',       'knapp neben Link-Local'],
    ['2606:4700:4700::1111', 'öffentliches IPv6'],
  ]

  for (const [ip, grund] of erlaubt) {
    it(`lässt ${ip} durch — ${grund}`, () => {
      expect(istInternesZiel(ip)).toBe(false)
    })
  }
})

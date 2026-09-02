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
    ['::ffff:127.0.0.1', 'IPv4 in IPv6 verpackt, punktiert'],
    ['::ffff:192.168.0.1', 'privates Netz, in IPv6 verpackt'],

    // ── DIE FORM, DIE WIRKLICH ANKOMMT ────────────────────────────────────
    // Am 02.09.2026 nachgemessen: `new URL('http://[::ffff:127.0.0.1]/')`
    // gibt als Hostnamen die NORMALISIERTE Hexform zurück, `::ffff:7f00:1`.
    // Die erste Fassung dieser Wache suchte nur die punktierte Form. Sie war
    // grün getestet und trotzdem offen — der Test prüfte die Schreibweise, die
    // im Betrieb nie eintrifft. Deshalb steht jede dieser Zeilen hier einzeln.
    ['::ffff:7f00:1',    'HEXFORM von 127.0.0.1 — hierüber war die Wache offen'],
    ['::ffff:a9fe:a9fe', 'Hexform von 169.254.169.254, den Cloud-Metadaten'],
    ['::ffff:c0a8:1',    'Hexform von 192.168.0.1'],
    ['::ffff:a00:1',     'Hexform von 10.0.0.1'],
    ['0:0:0:0:0:ffff:7f00:1', 'dieselbe Adresse ungekürzt'],
    ['::7f00:1',         'veraltete IPv4-kompatible Form'],
    ['64:ff9b::7f00:1',  'NAT64 mit 127.0.0.1 darin'],
    ['2002:7f00:1::',    '6to4 — trägt eine IPv4 in sich'],
    ['2001:0:53aa::1',   'Teredo — trägt eine IPv4 in sich'],
    ['fdff::1',          'obere Kante von fc00::/7'],
    ['febf::1',          'obere Kante des Link-Local-Bereichs'],
    ['ffff::1',          'obere Kante von Multicast'],
    ['::ffff:7f00:1%eth0', 'mit Zonenkennung angehängt'],
    [':::1',             'kaputte Schreibweise — im Zweifel nein'],
    ['1:2:3:4:5:6:7',    'zu wenige Gruppen'],
    ['gggg::1',          'keine Hexziffern'],
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
    ['2a00:1450:4001:82f::200e', 'öffentliches IPv6, ausgeschrieben'],
    ['::ffff:8.8.8.8',    'öffentliche IPv4 in IPv6 verpackt, punktiert'],
    ['::ffff:808:808',    'dieselbe in Hexform — muss durchgehen'],
    ['2001:4860:4860::8888', 'öffentlich, beginnt mit 2001 aber ist kein Teredo'],
  ]

  for (const [ip, grund] of erlaubt) {
    it(`lässt ${ip} durch — ${grund}`, () => {
      expect(istInternesZiel(ip)).toBe(false)
    })
  }
})

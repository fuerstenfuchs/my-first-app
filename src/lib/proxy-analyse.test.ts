import { describe, it, expect } from 'vitest'
import { _basis } from './proxy-analyse'

/**
 * Die Adresse des Proxy — und warum aus 127.0.0.1 ein localhost wird.
 *
 * WARUM DAS GETESTET GEHOERT: Es ist eine Regel, der man nicht ansieht, wozu
 * sie da ist. Am 03.09.2026 im Browser nachgemessen, derselbe Proxy, dieselbe
 * Anfrage, nur die Schreibweise:
 *
 *   http://127.0.0.1:8317  ->  401 nach 20 019 ms
 *   http://localhost:8317  ->  401 nach      4 ms
 *
 * Nimmt jemand die Umschreibung spaeter heraus, weil sie ueberfluessig
 * aussieht, wird die Analyse wieder zwanzig Sekunden brauchen — und niemand
 * wuerde den Zusammenhang vermuten. Dieser Test haelt ihn fest.
 */

describe('basis — Adresse des Proxy', () => {
  it('macht aus der Zahlenadresse localhost', () => {
    expect(_basis('http://127.0.0.1:8317')).toBe('http://localhost:8317')
    expect(_basis('https://127.0.0.1:8317')).toBe('https://localhost:8317')
    expect(_basis('http://127.0.0.1')).toBe('http://localhost')
  })

  it('schneidet Schraegstriche am Ende ab', () => {
    expect(_basis('http://localhost:8317/')).toBe('http://localhost:8317')
    expect(_basis('http://127.0.0.1:8317///')).toBe('http://localhost:8317')
  })

  it('laesst andere Adressen in Ruhe', () => {
    expect(_basis('http://192.168.1.50:8317')).toBe('http://192.168.1.50:8317')
    expect(_basis('http://proxy.fritz.box:8317')).toBe('http://proxy.fritz.box:8317')
    expect(_basis('http://localhost:8317')).toBe('http://localhost:8317')
  })

  it('fasst eine Adresse nicht an, die nur zufaellig so beginnt', () => {
    // 127.0.0.10 ist ein anderer Rechner als 127.0.0.1 — hier darf nichts
    // ersetzt werden, sonst zeigte die Anfrage plötzlich woandershin.
    expect(_basis('http://127.0.0.10:8317')).toBe('http://127.0.0.10:8317')
    expect(_basis('http://127.0.0.100')).toBe('http://127.0.0.100')
  })

  it('raeumt Leerzeichen weg', () => {
    expect(_basis('  http://127.0.0.1:8317  ')).toBe('http://localhost:8317')
  })
})

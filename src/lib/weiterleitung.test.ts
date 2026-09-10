import { describe, it, expect } from 'vitest'
import { hiesigerWeg } from './weiterleitung'

/*
  Der Rueckweg nach der Anmeldung — und warum er geprueft gehoert.

  Seit dem 10.09.2026 merkt sich der Proxy in `?weiter=`, wohin jemand wollte,
  bevor er zur Anmeldung geschickt wurde. Ohne das ging ein Verweis auf einen
  einzelnen Prompt verloren, sobald man gerade nicht angemeldet war — und das
  ist ausgerechnet bei Verweisen aus einem anderen Programm der haeufige Fall.

  Der Wert steht in der Adresszeile. Er ist damit von aussen bestimmbar, und
  ohne Pruefung waere er eine offene Weiterleitung.
*/

describe('hiesigerWeg', () => {
  it('laesst einen gewoehnlichen Weg durch', () => {
    expect(hiesigerWeg('/?prompt=abc-123')).toBe('/?prompt=abc-123')
    expect(hiesigerWeg('/characters')).toBe('/characters')
    expect(hiesigerWeg('/collections/7?von=suche')).toBe('/collections/7?von=suche')
  })

  it('laesst KEINE fremde Adresse durch', () => {
    // Der geradlinige Versuch.
    expect(hiesigerWeg('https://beispiel.test/phishing')).toBeNull()
    // Protokollrelativ — sieht aus wie ein Weg, fuehrt aber nach draussen.
    // DAS IST DER FALL, DEN MAN UEBERSIEHT: er beginnt mit einem Schraegstrich.
    expect(hiesigerWeg('//beispiel.test/phishing')).toBeNull()
    // Rueckwaerts geneigt — manche Browser lesen das wie zwei Schraegstriche.
    expect(hiesigerWeg('/\\beispiel.test')).toBeNull()
    expect(hiesigerWeg('\\\\beispiel.test')).toBeNull()
    // Ohne fuehrenden Schraegstrich ist es kein Weg in diesem Haus.
    expect(hiesigerWeg('beispiel.test')).toBeNull()
  })

  it('laesst keine Steuerzeichen durch', () => {
    // Ein Zeilenumbruch in einer Adresse kann in Kopfzeilen Unfug anrichten.
    expect(hiesigerWeg('/gut\nLocation: https://beispiel.test')).toBeNull()
    expect(hiesigerWeg('/gut\r\nX: 1')).toBeNull()
    expect(hiesigerWeg(`/gut${String.fromCharCode(0)}`)).toBeNull()
  })

  it('nimmt nichts Endloses und nichts Leeres', () => {
    expect(hiesigerWeg('/' + 'a'.repeat(600))).toBeNull()
    expect(hiesigerWeg('')).toBeNull()
    expect(hiesigerWeg(null)).toBeNull()
    expect(hiesigerWeg(undefined)).toBeNull()
  })
})

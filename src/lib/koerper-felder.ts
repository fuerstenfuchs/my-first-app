import type { KoerperAuswahl } from './referenzkette'

/* Die Felder des Körperbau-Baukastens als DATEN — herausgelöst aus dem
 * Formular-Bauteil (PROJ-92), damit die Seite „Personenbilder" dieselbe Liste
 * benutzt wie „Sheet erstellen" und die Referenzkette. Eine zweite, von Hand
 * gepflegte Liste derselben zwölf Regionen liefe irgendwann auseinander. */

/**
 * Der Wert für „nicht gesetzt".
 *
 * Ein leerer String geht bei Radix nicht: Er ist dort der Zurücksetz-Wert und
 * schließt die Liste, ohne etwas auszuwählen. Im `KoerperAuswahl`-Objekt landet
 * er nie — die Zuweisung unten löscht den Schlüssel stattdessen.
 */
export const KEINE_ANGABE = '__keine__'

/**
 * Ein Feld pro Schlüssel aus `KoerperAuswahl`, mit GENAU dessen erlaubten
 * Werten in `optionen` — nicht `wert: string`.
 *
 * Critic-Befund R18 vom 03.09.2026: Mit `wert: string` prüfte TypeScript die
 * Liste unten gar nicht gegen `KoerperAuswahl` nach — ein Tippfehler in einem
 * Optionswert (oder eine Option, die es in `MERKMAL_TEXT` in referenzkette.ts
 * nicht gibt) hätte anstandslos kompiliert. Erst zur Laufzeit wäre daraus eine
 * Zeile „- undefined" im Körper-Prompt geworden, der an gpt-image-2 geht —
 * ohne Fehler, ohne dass es auffiele. Diese Bauart macht genau das zu einem
 * Kompilierfehler.
 */
export type MerkmalFeld = {
  [K in keyof KoerperAuswahl]-?: {
    schluessel: K
    label: string
    optionen: { wert: NonNullable<KoerperAuswahl[K]>; text: string }[]
  }
}[keyof KoerperAuswahl]

/**
 * Alle zwölf werden immer gezeigt: Am Charakter-Datenmodell hängt keine
 * Geschlechtsangabe, aus der man Felder ableiten könnte. Ein geratenes
 * Ausblenden nähme Mark genau die Eingriffsmöglichkeit, für die es diesen
 * Abschnitt gibt.
 *
 * OBERSCHENKEL UND WADE SIND SEIT DEM 29.09.2026 EIGENE FELDER, nicht mehr Teil
 * von `bau`. Mark: „Die Beine an sich, der Aufbau sieht auch immer gleich aus.
 * Also die Waden, Oberschenkel, das sollte man getrennt vielleicht noch machen
 * können." Ein Körper kann schlank UND kräftige Waden haben, oder umgekehrt —
 * ein einziges „Körperbau"-Feld kann diese Kombination nicht abbilden.
 */
export const MERKMAL_FELDER: MerkmalFeld[] = [
  {
    schluessel: 'bau',
    label: 'Körperbau',
    optionen: [
      { wert: 'sehr_schlank',     text: 'Sehr schlank' },
      { wert: 'schlank',          text: 'Schlank' },
      { wert: 'durchschnittlich', text: 'Durchschnittlich' },
      { wert: 'kraeftig',         text: 'Kräftig' },
      { wert: 'sehr_kraeftig',    text: 'Sehr kräftig' },
      { wert: 'sportlich',        text: 'Sportlich' },
    ],
  },
  {
    schluessel: 'groesse',
    label: 'Größe',
    optionen: [
      { wert: 'sehr_klein',       text: 'Sehr klein' },
      { wert: 'klein',            text: 'Klein' },
      { wert: 'durchschnittlich', text: 'Durchschnittlich' },
      { wert: 'gross',            text: 'Groß' },
      { wert: 'sehr_gross',       text: 'Sehr groß' },
    ],
  },
  {
    schluessel: 'oberweite',
    label: 'Oberweite',
    optionen: [
      { wert: 'sehr_klein', text: 'Sehr klein' },
      { wert: 'klein',      text: 'Klein' },
      { wert: 'mittel',     text: 'Mittel' },
      { wert: 'gross',      text: 'Groß' },
      { wert: 'sehr_gross', text: 'Sehr groß' },
    ],
  },
  {
    schluessel: 'becken',
    label: 'Becken',
    optionen: [
      { wert: 'sehr_schmal',      text: 'Sehr schmal' },
      { wert: 'schmal',           text: 'Schmal' },
      { wert: 'durchschnittlich', text: 'Durchschnittlich' },
      { wert: 'ausladend',        text: 'Ausladend' },
      { wert: 'sehr_ausladend',   text: 'Sehr ausladend' },
    ],
  },
  {
    schluessel: 'beinlaenge',
    label: 'Beinlänge',
    optionen: [
      { wert: 'sehr_kurz',        text: 'Sehr kurz' },
      { wert: 'kurz',             text: 'Kurz' },
      { wert: 'durchschnittlich', text: 'Durchschnittlich' },
      { wert: 'lang',             text: 'Lang' },
      { wert: 'sehr_lang',        text: 'Sehr lang' },
    ],
  },
  {
    schluessel: 'oberschenkel',
    label: 'Oberschenkel',
    optionen: [
      { wert: 'sehr_duenn',       text: 'Sehr dünn' },
      { wert: 'duenn',            text: 'Dünn' },
      { wert: 'durchschnittlich', text: 'Durchschnittlich' },
      { wert: 'kraeftig',         text: 'Kräftig' },
      { wert: 'sehr_kraeftig',    text: 'Sehr kräftig' },
    ],
  },
  {
    schluessel: 'wade',
    label: 'Wade',
    optionen: [
      { wert: 'sehr_duenn',       text: 'Sehr dünn' },
      { wert: 'duenn',            text: 'Dünn' },
      { wert: 'durchschnittlich', text: 'Durchschnittlich' },
      { wert: 'kraeftig',         text: 'Kräftig' },
      { wert: 'sehr_kraeftig',    text: 'Sehr kräftig' },
    ],
  },
  {
    schluessel: 'gesaess',
    label: 'Gesäß',
    optionen: [
      { wert: 'sehr_flach',       text: 'Sehr flach' },
      { wert: 'flach',            text: 'Flach' },
      { wert: 'durchschnittlich', text: 'Durchschnittlich' },
      { wert: 'ausgepraegt',      text: 'Ausgeprägt' },
      { wert: 'sehr_ausgepraegt', text: 'Sehr ausgeprägt' },
    ],
  },
  {
    schluessel: 'bauch',
    label: 'Bauch',
    optionen: [
      { wert: 'sehr_flach',       text: 'Sehr flach' },
      { wert: 'flach',            text: 'Flach' },
      { wert: 'durchschnittlich', text: 'Durchschnittlich' },
      { wert: 'weich',            text: 'Weich' },
      { wert: 'sehr_weich',       text: 'Sehr weich' },
    ],
  },
  {
    schluessel: 'taille',
    label: 'Taille',
    optionen: [
      { wert: 'sehr_schmal',      text: 'Sehr schmal' },
      { wert: 'schmal',           text: 'Schmal' },
      { wert: 'durchschnittlich', text: 'Durchschnittlich' },
      { wert: 'gerade',           text: 'Gerade' },
      { wert: 'sehr_gerade',      text: 'Sehr gerade' },
    ],
  },
  {
    schluessel: 'schultern',
    label: 'Schultern',
    optionen: [
      { wert: 'sehr_schmal',      text: 'Sehr schmal' },
      { wert: 'schmal',           text: 'Schmal' },
      { wert: 'durchschnittlich', text: 'Durchschnittlich' },
      { wert: 'breit',            text: 'Breit' },
      { wert: 'sehr_breit',       text: 'Sehr breit' },
    ],
  },
  {
    schluessel: 'arme',
    label: 'Arme',
    optionen: [
      { wert: 'sehr_duenn',       text: 'Sehr dünn' },
      { wert: 'duenn',            text: 'Dünn' },
      { wert: 'durchschnittlich', text: 'Durchschnittlich' },
      { wert: 'kraeftig',         text: 'Kräftig' },
      { wert: 'sehr_kraeftig',    text: 'Sehr kräftig' },
    ],
  },
]

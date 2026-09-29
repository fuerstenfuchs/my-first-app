'use client'

import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { KoerperAuswahl } from '@/lib/referenzkette'

/**
 * Die Körpermerkmale, die Mark von Hand vorgeben kann.
 *
 * WARUM ALS EIGENES BAUTEIL (PROJ-86): Bis zum 07.09.2026 gab es sie nur im
 * Ketten-Dialog. Wer ein Körper-Sheet EINZELN erzeugte, konnte sie nicht
 * setzen — Mark: „Punkt zwei kannst Du noch einbauen, genau, damit man das auch
 * manuell machen könnte, falls man kein Referenzbild hat für den Körper."
 *
 * Genau dieser Fall ist der wichtigste: Zeigt keins der beiden Referenzbilder
 * wirklich einen Körper, sind diese Zeilen die einzige Quelle für den Körperbau.
 * Ohne sie erfindet das Modell ihn — und greift dabei jedes Mal zu etwas
 * Ähnlichem, was Marks ursprüngliche Beobachtung war: „dass der Körper
 * irgendwie immer gleich aussieht."
 */

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
type MerkmalFeld = {
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

export function KoerperMerkmale({
  auswahl, onAuswahl, hinweis,
}: {
  auswahl: KoerperAuswahl
  onAuswahl: (naechste: KoerperAuswahl) => void
  /** Ein Satz unter den Feldern. Ohne Angabe steht dort der Standardsatz. */
  hinweis?: string
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">Körpermerkmale</Label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {MERKMAL_FELDER.map(feld => (
          <div key={feld.schluessel} className="space-y-1">
            <span className="text-[13px] text-muted-foreground">{feld.label}</span>
            <Select
              value={auswahl[feld.schluessel] ?? KEINE_ANGABE}
              onValueChange={wert => {
                const neu = { ...auswahl }
                if (wert === KEINE_ANGABE) {
                  delete neu[feld.schluessel]
                } else {
                  // `feld.schluessel` ist hier weiterhin die Vereinigung aller
                  // zwölf Feldschlüssel; TypeScript verlangt für den
                  // Schreibzugriff deren Schnittmenge, die leer ist — das
                  // erzwingt diesen Umweg. Sicher ist er trotzdem: `wert` stammt
                  // aus `feld.optionen`, und die sind über den `MerkmalFeld`-Typ
                  // compile-geprüft genau die erlaubten Werte VON DIESEM
                  // `schluessel` — kein freier String kann hier ankommen.
                  ;(neu as Record<string, string>)[feld.schluessel] = wert
                }
                onAuswahl(neu)
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={KEINE_ANGABE} className="text-xs">
                  Keine Angabe
                </SelectItem>
                {feld.optionen.map(o => (
                  <SelectItem key={o.wert} value={o.wert} className="text-xs">
                    {o.text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {hinweis ?? 'Zusätzlich zu dem, was die Referenzbilder zeigen — wird nur beim Körper-Sheet angewendet.'}
      </p>
    </div>
  )
}

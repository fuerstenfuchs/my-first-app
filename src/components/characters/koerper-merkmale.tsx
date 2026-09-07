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
 * Alle fünf werden immer gezeigt: Am Charakter-Datenmodell hängt keine
 * Geschlechtsangabe, aus der man Felder ableiten könnte. Ein geratenes
 * Ausblenden nähme Mark genau die Eingriffsmöglichkeit, für die es diesen
 * Abschnitt gibt.
 */
export const MERKMAL_FELDER: MerkmalFeld[] = [
  {
    schluessel: 'bau',
    label: 'Körperbau',
    optionen: [
      { wert: 'schlank',          text: 'Schlank' },
      { wert: 'durchschnittlich', text: 'Durchschnittlich' },
      { wert: 'kraeftig',         text: 'Kräftig' },
      { wert: 'sportlich',        text: 'Sportlich' },
    ],
  },
  {
    schluessel: 'groesse',
    label: 'Größe',
    optionen: [
      { wert: 'klein',            text: 'Klein' },
      { wert: 'durchschnittlich', text: 'Durchschnittlich' },
      { wert: 'gross',            text: 'Groß' },
    ],
  },
  {
    schluessel: 'oberweite',
    label: 'Oberweite',
    optionen: [
      { wert: 'klein',  text: 'Klein' },
      { wert: 'mittel', text: 'Mittel' },
      { wert: 'gross',  text: 'Groß' },
    ],
  },
  {
    schluessel: 'becken',
    label: 'Becken',
    optionen: [
      { wert: 'schmal',           text: 'Schmal' },
      { wert: 'durchschnittlich', text: 'Durchschnittlich' },
      { wert: 'ausladend',        text: 'Ausladend' },
    ],
  },
  {
    schluessel: 'beinlaenge',
    label: 'Beinlänge',
    optionen: [
      { wert: 'kurz',             text: 'Kurz' },
      { wert: 'durchschnittlich', text: 'Durchschnittlich' },
      { wert: 'lang',             text: 'Lang' },
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
                  // fünf Feldschlüssel; TypeScript verlangt für den
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

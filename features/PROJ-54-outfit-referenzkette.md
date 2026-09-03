# PROJ-54: Outfit-Referenzkette

## Status: In Review
**Created:** 2026-09-03

## Warum

Mark am 03.09.2026: „Dann gehen wir mal weiter zu den Outfits. Da ist es ja
auch so, dass wir ein Referenzbild brauchen, also **nur mit der Kleidung ohne
einen Menschen** praktisch. Das sollte auch automatisiert ablaufen, genauso
wie bei den Charakteren."

Das Gegenstück zu PROJ-48, für Kleidung.

## Die vier Blätter

Mark hat sie auf Rückfrage einzeln gewählt (alle vier):

1. **Vorne freigestellt** — das Kleidungsstück von vorne, ohne Person
2. **Rückseite** — dasselbe von hinten
3. **Detailaufnahmen** — Stoff, Naht, Muster, Verschluss (2×2-Raster)
4. **Referenzsheet** — Vorne groß, Rückseite, Details auf einem Blatt

## Die Kette

```
Titelbild des Outfits
        │
        ▼
1. Vorne freigestellt      Referenz: das Titelbild
        │                  ── HALT: Mark sieht es an ──
        ├──────────────┬──────────────┐
        ▼              ▼              │
2. Rückseite      3. Detailaufnahmen  │
        └──────────────┴──────────────┤
                                      ▼
                            4. Referenzsheet
                        Referenz: alle drei davor
```

Der Halt sitzt nach dem ersten Blatt — dieselbe Begründung wie bei den
Charakteren: Ein misslungenes Vorne-Bild pflanzt sich sonst in alle drei
folgenden fort, denn alle bauen darauf auf.

## Die Variantennamen — und warum sie NICHT „Vorne" heißen

**Das Outfit-Formular legt bereits Varianten „Vorne", „Seite", „Hinten" und
„Detail" an** (`outfit-form.tsx`). Hieße das erste Kettenergebnis ebenfalls
„Vorne", würde ein dort von Hand hochgeladenes Foto die Kette glauben lassen,
der Schritt sei erledigt — genau der Fehler, der am selben Tag zweimal
auftrat (bei „Kopf" in PROJ-50 und beim Ausgangsfoto in PROJ-48).

Die Kette benutzt deshalb eigene, eindeutig andere Namen:

| Schritt | Variante | Formular-Slot (bleibt Marks eigener) |
|---|---|---|
| 1 | **Vorne freigestellt** | „Vorne" |
| 2 | **Rückseite** | „Hinten" |
| 3 | **Detailaufnahmen** | „Detail" |
| 4 | **Referenzsheet** | — |

## Die Prompts

Liegen fertig in `src/lib/outfit-kette-prompts.ts`. Zwei Regeln stehen in
allen vieren, beide aus Erfahrungen desselben Tages:

- **„NO PERSON", mehrfach und ausdrücklich.** Zeigt man einem Bildmodell
  Kleidung, malt es von sich aus jemanden hinein. Dazu die Ghost-Mannequin-
  Formulierung: getragene Form ohne Körper darin.
- **Anzahl der Felder, keine Wiederholung, Motiv füllt das Feld.** Der
  Kopf-Sheet-Fehler vom selben Tag entstand, weil der Prompt zwar sagte, WAS
  zu sehen sein soll, aber nicht WIE VIELE Felder es gibt und dass das Motiv
  sie ausfüllt. Ergebnis waren zehn Gesichter in zwei Reihen.

## Was aus PROJ-48 wiederverwendet wird

Die Kette der Charaktere hat die Mechanik bereits: warten auf den Auftrag,
Ergebnis ablegen, Wiederaufnehmen dort wo es stehenblieb, Prüfung auf eigenen
Speicher, Halt mit Ansehen/Verwerfen. Diese Muster werden übernommen — die
Regeln selbst gehören in ein eigenes, framework-freies Modul mit Tests, wie
`referenzkette.ts` es vormacht.

## Umsetzung (03.09.2026)

- `src/lib/outfit-kette.ts` — die Regeln, framework-frei; `istEigenerSpeicher`
  wird aus `referenzkette.ts` **re-exportiert statt kopiert** (dieselbe
  Schranke des Arbeiters, zwei Kopien liefen auseinander).
- `src/lib/outfit-kette.test.ts` — 23 Tests.
- `src/hooks/use-outfit-kette.ts` — Ausführung nach dem Muster von PROJ-48,
  mit Laufnummer statt Ja/Nein-Abbruchmerker.
- `src/components/outfits/outfit-kette-dialog.tsx` — Oberfläche in Orange.
- Knopf „Referenzkette" auf der Outfit-Seite neben „Sheet".

**Über den Auftrag hinaus, mit gutem Grund:** `PREDEFINED_SLOTS` stand privat
in `outfit-form.tsx`. Ein Kollisionstest hätte die vier Namen abschreiben
müssen — und eine abgeschriebene Liste wandert beim nächsten Slot nicht mit,
der Wächter wäre still falsch geworden. Die Liste heißt jetzt `FORMULAR_SLOTS`
und liegt in `outfit-kette.ts`; der Test hält **zwei echte Konstanten**
gegeneinander.

**Gegenproben:** (1) Kettenname `'Vorne freigestellt'` auf `'Vorne'` gesetzt →
3 Tests rot, darunter der Kollisionswächter. (2) `quellenFuer('rueckseite')`
auf ein Blatt gesetzt, das es zu dem Zeitpunkt noch nicht gibt → 2 Tests rot.
Beide zurückgedreht, danach 471/471 grün.

## Noch nicht im Betrieb gesehen

Die Kette wurde **nicht** mit echten Bildern gelaufen — das wären vier
kostenpflichtige Erzeugungen, und der Klick gehört Mark. Typprüfung, 471
Tests und der Build sagen, dass sie baut; sie sagen nicht, dass gpt-image-2
aus dem Titelbild tatsächlich ein personenfreies Blatt macht. Genau dafür
sitzt der Halt nach dem ersten Blatt.

## Bewusst offen (Stand vor der Prüfung)

- **Der Knopf hängt nicht an der Kategorie** — ein Komplett-Look bekommt die
  vier Blätter genauso wie ein einzelnes Kleidungsstück. Falls das für Schuhe
  unpassend wirkt, ist es eine Zeile.
- **„Warten aufgeben" lässt den Auftrag weiterlaufen**, wie beim Charakter-
  Dialog. `jobUnterwegsSchritt` aus PROJ-48 wurde bewusst NICHT übernommen:
  Die Outfit-Kette hat keine Merkmalsauswahl, es gäbe nichts zu schützen — und
  ein Zustandsfeld ohne Wirkung hält der nächste Leser für wichtig.

## Nach der unabhängigen Prüfung (Nacht zum 04.09.2026)

Elf gewichtige Befunde. **Die vier Prompt-Befunde wurden sofort behoben**,
weil sie die allerersten vier bezahlten Erzeugungen unbrauchbar gemacht
hätten — reine Textarbeit ohne Verhaltensrisiko:

1. **„One single garment" hätte jeden Komplett-Look zerstört.** 17 der 36
   Einträge sind komplette Looks aus mehreren Teilen; der Satz hätte das
   Modell aufgefordert, Teile wegzulassen oder zu verschmelzen. Jetzt steht
   ausdrücklich da, dass bei einem Komplett-Look ALLE Teile in ihrer
   getragenen Anordnung zu zeigen sind.
2. **Der Kleiderbügel fehlte in der Verbotsliste.** Bei freigestellter
   Kleidung ist er der häufigste ungebetene Gast — häufiger als ein Mensch.
   Jetzt verboten, samt Schneiderpuppe, Torso-Ständer und Garderobenstange.
3. **„NO PERSON" ist die schwächere Hälfte.** Verneinungen tragen bei
   Bildmodellen schlecht. Daneben steht jetzt die positive Beschreibung
   desselben Zustands: hohl, offene Ausschnitte, Hintergrund scheint hindurch,
   Innenfutter am Kragen sichtbar.
4. **Grundregeln und Detailblatt widersprachen sich.** „Ghost mannequin",
   „freier Hintergrund" und „nothing else in the frame" gelten für einen
   Stoff-Makro nicht — das Modell hätte zwischen zwei Anweisungen wählen
   müssen, und die wahrscheinlichere Auflösung wäre gewesen, im Detailfeld
   wieder das ganze Kleidungsstück zu zeigen. Die Regeln sind jetzt in einen
   Kern (gilt immer) und einen Einzelbild-Teil getrennt; das Detailblatt hebt
   den Einzelbild-Teil ausdrücklich auf.

Dazu aufgenommen: Rückseiten-Blatt sichert jetzt ab, dass Knopfleiste, Front-
Reißverschluss und Brusttaschen NICHT auf der Rückseite auftauchen (das
häufigste Fehlbild ist eine gespiegelte Vorderansicht), und beide Einzelbilder
fordern dieselbe Kameraachse und -höhe, damit sie nebeneinander bestehen.

**Die sieben Code-Befunde stehen in `features/OFFEN.md`** — sie brauchen
echte Änderungen und einen Prüflauf. Drei davon stehen wörtlich auch in
`use-referenzkette.ts` (PROJ-48): Die beiden Ketten-Hooks sind Kopien
voneinander und müssen zusammen repariert werden.

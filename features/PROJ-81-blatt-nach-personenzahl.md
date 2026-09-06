# PROJ-81 — Das Gruppenblatt richtet sich nach der Personenzahl

**Status:** In Review
**Erstellt:** 2026-09-06

## Was Mark gesehen hat

> „kann das Sheet bei zwei Personen noch mal anders gestalten wie bei drei oder
> vier Personen. Da kann man wirklich den Kopf größer machen. Da ist viel zu
> viel Platz verschenkt."

## Nachgerechnet — er hat recht, und man kann sagen warum

Ein Kopf wird so groß wie das **Kleinere** von beidem: die Höhe seiner Reihe,
oder die Blattbreite geteilt durch die Zahl der Personen. Auf einem Blatt von
1536 × 1024 mit einer Kopfreihe von 40 %:

| Personen | Reihenhöhe | Breite je Platz | Kopf wird | was begrenzt |
|---------:|-----------:|----------------:|----------:|--------------|
| 2 | 410 px | **768 px** | 410 px | die **Höhe** — 358 px je Platz liegen brach |
| 3 | 410 px | 512 px | 410 px | knapp ausgeglichen |
| 4 | 410 px | **384 px** | 384 px | die **Breite** |
| 5 | 410 px | **307 px** | 307 px | die Breite |

Bei zwei Personen ist die halbe Blattbreite ungenutzt. Genau das war zu sehen.

## Zwei Personen bekommen zwei Spalten

Statt zweier Reihen: **jede Person eine Blatthälfte**, und *innerhalb* dieser
Hälfte stehen Ganzkörper und Nahaufnahme nebeneinander.

```
┌───────────────────────┬───────────────────────┐
│  Ganzkörper │  Kopf   │  Ganzkörper │  Kopf   │
│   Person 1  │  gross  │   Person 2  │  gross  │
└───────────────────────┴───────────────────────┘
```

Die Nahaufnahme darf damit fast die volle Blatthöhe nutzen — rund **600 statt
410 Pixel** Kopfhöhe, und nichts liegt mehr brach.

Die Trennung ist ausdrücklich: *„Nothing crosses the middle, and neither person
appears in the other half."* Bei zwei Personen ersetzt die Blatthälfte den
Abstand, der im Reihenaufbau die beiden auseinanderhält.

## Ab drei bleibt es bei zwei Reihen

Dort füllt die Reihe die Breite von selbst, und eine Spalte je Person wäre zu
schmal — bei drei Personen blieben je Spalte 512 px für Ganzkörper *und*
Nahaufnahme, also rund 250 px pro Ansicht. Die Kopfreihe hat aber **45 statt
40 %** bekommen.

## In beiden Aufbauten: das Blatt ausnutzen

> FILL THE SHEET — every part of the sheet that is not a person is wasted, and
> the faces are the reason this sheet exists.

Das steht jetzt in beiden Fassungen, weil die Ränder auch bei drei und vier
Personen zu großzügig waren.

## Ein Fallstrick der eigenen Werkzeugkette, zweimal am selben Tag

Beim Schreiben über die Kommandozeile ging zweimal ein Backslash verloren:
einmal in `join('\n')` — daraus wurde ein echter Zeilenumbruch mitten im
Quelltext —, einmal in einem Apostroph (`half's`), was die Zeichenkette vorzeitig
beendete. Beide Male meldete der Übersetzer *Unterminated string literal*.

Am selben Tag war schon ein `\b` in einem Test zu einem echten
Backspace-Zeichen geworden (PROJ-79) — dort **ohne** Fehlermeldung, der Test
lief einfach ins Leere.

**Die Lehre, jetzt umgesetzt statt nur notiert:** Was nicht escaped werden
muss, kann auch nicht verlorengehen. Der Zeilenumbruch ist eine benannte
Konstante, die Apostrophe sind umformuliert (`about a third of the width of
that half`, `a gap about one shoulder wide`). Der Quelltext enthält an diesen
Stellen kein einziges Sonderzeichen mehr.

## Tests

21 in `gruppen-referenz.test.ts`. Die drei Tests, die den Reihenaufbau
festhielten, prüfen jetzt **beide** Aufbauten getrennt — samt der Zusicherung,
dass bei zwei Personen `TOP ROW` gerade **nicht** vorkommt und umgekehrt bei
drei kein `TWO EQUAL HALVES`.

## Nebenbei mit eingecheckt

`git add -A` hat eine ältere, noch nicht eingecheckte Änderung an `.gitignore`
mitgenommen (Ausschluss von `desktop.ini` aus Marks Windows-Symbolordner).
Sachlich richtig, aber sie gehört nicht zu diesem Feature.

## Dateien

`src/lib/gruppen-referenz.ts` — `gruppenPrompt` verzweigt in `zweiSpalten()`
und `zweiReihen()`; `src/lib/gruppen-referenz.test.ts`.

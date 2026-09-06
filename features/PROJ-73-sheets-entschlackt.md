# PROJ-73 — Sheets entschlackt, Cinematic wird Shooting-Sheet

**Status:** In Review
**Erstellt:** 2026-09-06

## Was Mark gesagt hat

> „mach lieber nicht so viele einzelne Bilder auf, nur ein Foto. Das ist
> wirklich zu überladen dann. Vierzehn Felder finde ich auch schon so viel.
> Also man soll die Location sehen."

> „statt dem Cinematic Sheet machen wir einen Shooting Sheet daraus … einfach
> den Hintergrund und dass ein Model davorstehen könnte."

## Gemessen, warum das nötig war

Vorher verlangten die Blätter 46 (Cinematic) und 42 (Gebäude) Bildfelder — bei
einem Hero, der 40–50 % der Fläche beansprucht. Für den Rest blieben rund 1,2 %
je Feld, auf einem 1536er Blatt etwa 140 × 140 Pixel. „Vergrößerte
Detailaufnahmen" gehen darauf nicht. Das Modell kürzt dann selbst — unsichtbar
als Fehler, nur als „das Blatt ist irgendwie unvollständig", und bei jedem
Durchlauf anders.

## Jetzt

| Sheet | Felder | Hero |
|-------|-------:|-----:|
| Location | 5 | 55 % |
| Shooting | 6 | 45 % |
| Gebäude | 14 | 25 % |

**Location:** Hero plus vier Ansichten — Blick zurück, links, rechts,
Übersicht. Die Detail- und Atmosphärenfelder sind ersatzlos weg; sie machten
aus dem Blatt ein Moodboard. Alle fünf mit gleicher Tageszeit und gleicher
Sonnenrichtung: ein Ort, ein Moment, fünf Positionen.

**Shooting (neu):** sechs leere Hintergründe — weit, mit Tiefe, Materialfläche,
Signaturstelle, Gegenlicht. Ausdrücklich ohne Person, ohne Silhouette, ohne
Schatten einer Person.

**Gebäude:** die acht Ansichten bleiben, denn sie sind der Zweck. Die 12
Detail-, 8 Material- und 5 Tageszeitfelder sind auf 3 + 0 + 2 gefaltet. Hero
von 45 % auf 25 % — sonst wären die restlichen dreizehn Felder Daumennägel,
also genau das, wovor der Prompt drei Absätze weiter oben selbst warnt.

## Zwei Runden Nachbesserung

**Critic fand einen Blocker in meinem eigenen Text.** Ich schreibe „THE PANELS
ARE EMPTY — THIS IS THE POINT" und beschreibe zwei Zeilen weiter ein Feld mit
„the subject behind the **person**". Inhaltszeilen wiegen beim Bildmodell
schwerer als eine Verbotsliste weiter unten. Dazu: „full-body portrait" ist
eine Gattung, in der jemand steht; die Faktenzeilen widersprachen der
Ein-Wort-Beschriftungsregel; ein Code-Kommentar zitierte den gelöschten
Cinematic-Text.

**Dann Marks eigener Einwand:** „Brennweite wird ja sowieso von mir vorgegeben,
auch die Tageszeit und dementsprechend auch das Licht." Raus: die drei
Faktenzeilen je Feld, die feste 35-mm-Angabe, die Streuung über verschiedene
Tageszeiten. Stattdessen einheitliches weiches Tageslicht — eine Platte, die
schon Golden Hour mitbringt, ist für nichts anderes mehr zu gebrauchen.

## Dateien

`src/components/locations/location-sheet-dialog.tsx` — alle drei Prompts,
`SheetType`, `SHEET_TYPES`, `getPrompt`.

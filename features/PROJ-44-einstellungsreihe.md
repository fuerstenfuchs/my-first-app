# PROJ-44: Einstellungsreihe — Kontinuität über mehrere Einstellungen

## Status: Planned
**Created:** 2026-09-03

## Warum

Mark baut heute jede Szene einzeln. Was fehlt, ist die **Sequenz**: mehrere
Einstellungen desselben Moments — gleicher Charakter, gleiche Location,
gleiches Licht, gleiches Outfit — bei denen sich nur Kamera und Bildausschnitt
ändern. Das ist genau die Arbeit, die er sonst acht Mal von Hand durchklickt,
obwohl alle Bausteine schon beieinander liegen.

Mark am 03.09.2026 auf den Vorschlag: „Machen wir auf jeden Fall."

## Was gebaut werden soll

Ein Knopf im Scene Builder, der aus einer fertigen Szene eine Reihe erzeugt.
Vorschlag für die Auflösungen, angelehnt an das, was im Schnitt gebraucht wird:

- Totale (establishing)
- Halbtotale
- Halbnah
- Nah
- Detail
- Schulterblick
- Gegenschuss

Auswählbar, nicht alle acht zwangsweise. Alle Bausteine bleiben gebunden, nur
Kameraeinstellung und Bildausschnitt variieren.

## Offene Fragen

- Erzeugt eine Reihe einen Auftrag mit N Durchläufen oder N Aufträge? Ein
  Auftrag wäre billiger zu verwalten, N Aufträge lassen sich einzeln
  wiederholen, wenn eine Einstellung misslingt.
- Bekommt die Reihe eine eigene Kennung, damit der Lichttisch sie
  zusammenhängend zeigen kann? Ohne die zerfällt sie dort sofort wieder.
- Referenzbilder: Bei gpt-image-2 richtet sich die Ausgabegröße nach der
  Vorlage (gemessen 01.09.2026). Eine Reihe mit wechselndem Format wäre damit
  nicht zuverlässig — das muss vorher geklärt werden.

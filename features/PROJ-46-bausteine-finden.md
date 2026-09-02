# PROJ-46: Bausteine finden statt scrollen

## Status: Planned
**Created:** 2026-09-03

## Warum

Das ist kein künftiges, sondern ein **heutiges** Problem. Mark am 03.09.2026:

> „Bausteine zu finden ist schon allein schwierig, wenn ich ein Bild vom
> Lichttisch in einen Prompt-Baustein übergeben will und da schon ewig
> scrollen muss, damit ich den wieder finde. Das wird bei anderen Dingen bald
> genauso sein, wenn es viele werden."

Die semantische Suche (PROJ-14) liegt über **Prompts**, nicht über Charakteren,
Outfits, Fashion, Locations, Posen oder Archetypen. Genau dort wächst der
Bestand aber am schnellsten — und ein Werkzeug, in dem man nichts mehr
wiederfindet, wird still unbrauchbar, ohne dass irgendetwas kaputtgeht.

## Was gebaut werden soll

**Zuerst und sofort:** ein Suchfeld im Übernehmen-Dialog. Das ist die Stelle,
an der es Mark heute konkret weh tut.

**Danach, breiter:**
- Suche in allen Baustein-Listen, nicht nur im Dialog.
- Zuletzt benutzt zuerst — bei einem Werkzeug für einen Menschen ist das
  meistens die richtige Sortierung.
- Später: dieselbe semantische Suche wie bei Prompts auch über Bausteine,
  damit „Frau mit kurzen weißen Haaren" den Charakter findet, ohne dass sein
  Name das enthält.

# PROJ-40: Seitenleiste neu geordnet

## Status: In Review
**Created:** 2026-09-01
**Anlass:** Mark: „Ich persönlich finde ja die Seitenleiste sehr überfrachtet."

## Der Befund — gemessen, nicht geschätzt

| | vorher |
|---|---|
| Gesamthöhe | **2008 px** |
| Sichtbar auf 1080p | ~950 px |
| Zu scrollen | 2,1 Bildschirmhöhen |
| Kachel-Knöpfe | 13 à 64 px = 832 px |
| Sammlungen | 17 à 56 px = **952 px** |
| Scene Builder | Platz 12 von 13 |

Zwei Dinge stachen heraus: Die siebzehn Sammlungen brauchten **mehr Platz als
das gesamte Menü darüber**. Und die Werkbank, an der täglich gearbeitet wird,
lag unter elf Bibliotheken.

## Gewählt: Variante B — Kachelraster

Mark hat aus drei maßstabsgetreuen Entwürfen gewählt. B behält die farbigen
Kacheln, an denen die Bibliotheken erkennbar sind — das war die Bedingung.

**Neue Ordnung:**
1. *Alle Prompts* — volle Breite
2. *Produktion* — Scene Builder und Warteschlange, große Kacheln, **ganz oben**
3. *Bausteine* — acht Kacheln zweispaltig, vier Reihen statt acht
4. *Sammlungen* — zugeklappt, mit Anzahl

| | nachher |
|---|---|
| Gesamthöhe | **574 px** |
| Gespart | 1434 px (71 %) |
| Passt auf einen Bildschirm | ja |

## Die vier Eingriffe

**Archetypen als Reiter** (`src/components/library-tabs.tsx`). Character-,
Outfit- und Location-Archetypen sind keine eigenen Menüpunkte mehr, sondern ein
Umschalter auf der jeweiligen Seite. Inhaltlich gehören sie dorthin — auch der
Scene Builder behandelt einen Archetyp als Alternative zum echten Asset. Spart
drei Einträge.

**Bausteine zweispaltig.** Acht Kacheln à 52 px in vier Reihen statt acht
Reihen à 64 px. Farbverläufe, Leuchtrand und Symbolfarben unverändert
übernommen.

**Sammlungen zugeklappt.** Kopfzeile mit Anzahl und Pfeil; die Wahl bleibt im
Browser gespeichert (`sidebar-collections-open`). Der größte Einzelposten.

**Tag-Leiste entfernt.** Sie stand hier *und* über der Prompt-Galerie —
dieselbe Funktion doppelt. In der Galerie sitzt sie am Inhalt.

## Nebenbei aufgeräumt

Die Navigation lag als dreizehnmal kopiertes JSX in der Datei, jede Kachel mit
vier eingebauten Farbwerten. Genau deshalb ist die Leiste unbemerkt auf 2008 px
gewachsen: Ein neuer Bereich hieß „vierzehn Zeilen kopieren und anpassen".

Jetzt Daten in `src/lib/sidebar-nav.ts` und eine Stelle, die daraus Kacheln
baut. Ein neuer Bereich ist ein Eintrag im Array.

## Offen

- In der laufenden App abgenommen ist nichts davon — Typen, Tests und Build
  sind sauber, aber die Leiste hat noch niemand gesehen. Das braucht Marks
  Zugang.
- Die Zusammenfassung von Outfits und Fashion Assets zu zwei getrennten Kacheln
  blieb erhalten. Falls Fashion Assets für Mark zu den Outfits gehören, ließe
  sich eine weitere Kachel sparen.

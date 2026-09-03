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

## Nachgebessert nach dem ersten Blick (01.09.2026)

Mark hat die fertige Leiste angesehen. Zwei Punkte:

**Statistiken standen bei den Bausteinen — falsch einsortiert.** Sie sind eine
Auswertung, kein Material. Sie standen dort nur, damit acht Kacheln ein sauberes
Raster ergeben: ein Grund aus der Gestaltung, keiner aus der Sache. Die graue
Kachel zwischen sieben farbigen hat es sichtbar gemacht — sie sah aus wie
ausgegraut. Jetzt in der Fusszeile bei Einstellungen und Abmelden.

Damit bleiben sieben Bausteine. Die letzte Kachel laeuft ueber beide Spalten,
statt eine halb leere Reihe zu hinterlassen.

**Das Logo war nach dem Umbau der groesste Block.** Quadratisch angelegt und in
voller Breite dargestellt wurde es 205px hoch — 40 Prozent der verkuerzten
Leiste, mehr als Scene Builder und Warteschlange zusammen. Jetzt auf 96px
begrenzt.

Die Datei war ausserdem **1795 kB** gross fuer ein Logo, das mit 256px angezeigt
wird. Auf 512px Breite verkleinert: **240 kB**. Das laedt bei jedem Seitenaufruf
mit.

**Endstand: 724px** statt 2237px mit Logo — passt mit 226px Luft auf einen
1080p-Bildschirm.

## Zweite Nachbesserung (01.09.2026)

**Die Kachel „Alle Prompts" lief rechts ueber den Rand.** Mark hat es am
abgeschnittenen Farbrand gesehen. Ursache: Sie stand als einzige nicht in einer
. Die Group bringt  mit — die Kachel war dadurch 16px breiter
als Scene Builder und Warteschlange und ragte ueber die Leiste hinaus. Jetzt in
derselben Struktur; alle drei Bloecke haben 16px Innenabstand.

**Logo wieder groesser.** 96px waren zu klein. Jetzt 192px, also praktisch die
urspruengliche Groesse. Die Hoehe des Logos war nicht das Problem, der
ueberstehende Rand war es.

## Offen

- In der laufenden App abgenommen ist nichts davon — Typen, Tests und Build
  sind sauber, aber die Leiste hat noch niemand gesehen. Das braucht Marks
  Zugang.
- Die Zusammenfassung von Outfits und Fashion Assets zu zwei getrennten Kacheln
  blieb erhalten. Falls Fashion Assets für Mark zu den Outfits gehören, ließe
  sich eine weitere Kachel sparen.

> **Nachtrag 03.09.2026:** Die hier beschriebenen Archetyp-Eintraege gibt es seit PROJ-52 nicht mehr; uebrig sind Charaktere, Outfits und Locations.

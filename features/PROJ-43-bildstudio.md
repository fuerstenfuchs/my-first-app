# PROJ-43: Bildstudio

## Status: In Progress
**Created:** 2026-09-02

Konzept mit Mockups:
https://claude.ai/code/artifact/feccc689-9c7d-457c-8c57-e123e50fbb9a

## Warum

Die Warteschlange zeigt **Aufträge** — Status, Versuchszähler, Fehlertext,
Arbeiter-Ampel. Das ist ein Maschinenraum, und als solcher richtig. Was fehlt,
ist der Raum davor: einer, der **Bilder** zeigt.

Marks Ausgangspunkt: Ein fertiges Bild einer Person in die Charakterbibliothek
zu bringen kostet sieben Handgriffe über drei Bildschirme — herunterladen, zur
Bibliothek wechseln, Eintrag suchen, Variante wählen, hochladen, beschriften.
Dazu geht heute gar nicht: ein Bild einfach so erzeugen, ohne den Scene Builder.

## Phasen

| | | Stand |
|---|---|---|
| **A** | „Übernehmen nach …" auf jeder Ergebniskachel | **fertig** |
| B | Rubrik Bildstudio mit Lichttisch | offen |
| C | Freie Erzeugung mit Speichern in den Trésor | offen |
| D | Werkbank: Zuschneiden und sieben Regler | offen |

Marks Änderung an der Reihenfolge: Gemini als viertes Vergrößerungsverfahren
zuerst (erledigt, PROJ-42), dann A bis D.

## Phase A — „Übernehmen nach …"

Dritter Knopf auf jeder Ergebniskachel in `/queue`. Zwei Entscheidungen, dann
liegt das Bild in der Bibliothek: welche Art, welcher Eintrag.

**Auswahl über Bilder, nicht über Namen.** Dieselbe Lehre wie beim
Referenz-Auswahldialog — Mark kennt die Namen seiner Outfits nicht, er erkennt
sie am Bild. Das Suchfeld ist die Abkürzung bei vielen Einträgen, nicht die
Voraussetzung.

### Die zwei Entscheidungen, die zählen

**Kopieren statt verweisen.** Es gäbe `addImageUrl()` in allen fünf Hooks — es
hängt einem Baustein eine Bildadresse an, ohne ein Byte zu bewegen, und
`generated-images` ist öffentlich lesbar. Der Verweis würde funktionieren, bis
Mark den Auftrag löscht: `use-image-jobs.ts` löscht dann dessen Dateien mit, und
das Bild im Charakter stürbe still mit — ein kaputtes Kästchen ohne
Fehlermeldung, vielleicht erst Wochen später bemerkt. Der Preis des Kopierens
ist Speicherplatz, der Gewinn ist, dass nichts unbemerkt kaputtgeht.

**Das Titelbild wird nicht angefasst** — auch dann nicht, wenn der Baustein noch
keines hat. Mark am 02.09.2026: „Da habe ich mühsam schon eigene Titelbilder
erstellt, sodass die möglichst alle gleich aussehen." Ein übernommenes Bild ist
immer nur ein weiteres Bild.

### Wie es gebaut ist

`src/lib/bausteine.ts` ist eine Tabelle, keine fünf Funktionen. Nachgemessen:
Alle fünf Bildtabellen haben exakt dieselben Spalten
(`id, variant_id, user_id, url, storage_path, sort_order, created_at`). Im
Projekt steht der Ablauf „hochladen → Adresse holen → Zeile einfügen" trotzdem
acht- bis zehnmal da, jedes Mal leicht anders. Ein sechster Baustein ist hier
ein Eintrag, keine Kopie.

Der Ablagepfad ist für alle fünf einheitlich
(`{user}/{parent}/{variant}/{marke}.{endung}`), obwohl die vorhandenen Wege sich
unterscheiden. Gefahrlos, weil in allen fünf Hooks über die Spalte
`storage_path` gelöscht wird und nicht über einen zusammengebauten Pfad —
nachgemessen. Und die Speicherregel verlangt nur, dass der erste Ordner die
Nutzerkennung ist.

Scheitert das Eintragen der Zeile, wird die bereits hochgeladene Datei wieder
weggeräumt. Sonst läge sie im Eimer, ohne dass jemand wüsste, wozu sie gehört.

## Offen

- Archetypen (Charakter-, Outfit-, Location-Archetypen) und Prompt-Medien sind
  noch keine Ziele. Sie haben keine Varianten, brauchen also einen zweiten Weg
  in derselben Tabelle.
- Einen Baustein direkt aus dem Dialog neu anlegen geht noch nicht — bisher nur
  in vorhandene übernehmen.

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
| **B** | Rubrik Bildstudio mit Lichttisch | **fertig** |
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

### Neun Ziele, drei Bauarten (nachgereicht auf Marks Wunsch)

Prompts und die drei Archetypen-Bibliotheken sind dazugekommen. Sie sind anders
gebaut als die fünf Bibliotheken, und diese Unterschiede stehen jetzt als
Felder in der Tabelle statt als `if` im Ablauf:

| | Bibliotheken | Archetypen | Prompts |
|---|---|---|---|
| Bild hängt an | `variant_id` | `archetype_id` | `prompt_id` |
| Varianten | ja | **nein** | **nein** |
| `storage_path` | ja | ja | **nein** |
| Pflichtfeld | — | — | **`type` ('image')** |
| Namensspalte | `name` | `name` | **`title`** |

Die Namensspalte war der stillste Fallstrick: `prompts` heißt die Spalte
`title`. Eine Abfrage auf `name` hätte einen Fehler geliefert, keine leere
Liste — der Alias `name:title` macht daraus für die Oberfläche wieder einen
einheitlichen Namen.

Und „keine Varianten" heißt hier ausdrücklich NICHT „geht nicht": Der Warnsatz
„hat noch keine Variante" erscheint nur bei Bausteinen, die überhaupt welche
haben.

## Phase B — der Lichttisch

Eigene Rubrik `/bildstudio`, in der Seitenleiste VOR der Warteschlange. Alle
Bilder aus allen Aufträgen als ein Raster, neueste zuerst. Ein Auftrag mit vier
Durchläufen ist hier vier Kacheln, kein Eintrag mit vier Bildern darin — genau
das ist der Unterschied zur Warteschlange.

Vier Filter: **Alle · Heute · Vergrößert · Noch nicht abgelegt.**

### „Noch nicht abgelegt" brauchte eine eigene Tabelle

Der Filter ließ sich nicht ableiten. Beim Übernehmen wird das Bild **kopiert**;
die Kopie im Baustein hat einen eigenen Pfad in einem eigenen Eimer und
keinerlei Verweis zurück. Die Frage „was habe ich schon abgelegt?" wäre nur
durch Bildvergleich zu beantworten.

Deshalb `bild_uebernahmen` (`docs/proj-43-bild-uebernahmen.sql`) — eine reine
Notiz: Wird eine Zeile gelöscht, geht kein Bild verloren, das Bild steht dann
nur wieder als „noch nicht abgelegt" da. Gemerkt wird der **Speicherpfad**, nicht
die Adresse: Die trägt einen Cache-Brecher (`?v=`), der sich mit jedem Versuch
ändert.

Abgelegte Bilder tragen eine grüne Marke links oben.

### Die Kachel steht nur einmal da

`src/components/ergebnis-kachel.tsx` — Bild, Vergrößern-Menü, Übernehmen,
Herunterladen. Die Warteschlange benutzt jetzt dieselbe Komponente.

Als Kopie wären die beiden genau dort auseinandergedriftet, wo es weh tut: bei
den Preisangaben und beim Vergrößerungsmenü. Denselben Fehler hat Critic in
diesem Projekt schon einmal gefunden — Menü und Bestätigung nannten
verschiedene Preise.

Beim Zusammenführen fiel ein Unterschied auf, der sonst still geblieben wäre:
Der erste Entwurf der Kachel nahm beim Dateinamen `scene_meta.name ?? prompt`,
die Warteschlange bisher `?? null`. Das hätte jedem Download hundert Zeichen
Prompt in den Namen geschrieben. Jetzt wieder wie vorher.

## Offen

- Einen Baustein direkt aus dem Dialog neu anlegen geht noch nicht — bisher nur
  in vorhandene übernehmen.
- Sammlungen, Kamera/Licht und Look & Grading sind keine Ziele. Sie haben nur
  ein Titelbild und keine Bilderliste — dorthin zu übernehmen hieße, das
  Titelbild zu überschreiben, und genau das soll nicht passieren.

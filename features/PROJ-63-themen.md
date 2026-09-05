# PROJ-63: Themen statt Endlosraster

## Status: In Review
**Created:** 2026-09-05

## Warum

Mark am 05.09.2026:

> „Wenn man draufgeht, sind ja alle Prompts untereinander. Da ist Scrollen
> angesagt und es werden wahrscheinlich noch sehr viel mehr werden. Klar kann
> man oben ein bisschen filtern. Man hat auch irgendwo Sammlungen. Aber
> irgendwie findet man da trotzdem nichts."

**Erst gemessen, dann gestaltet.** In der Datenbank standen:

| | |
|---|---|
| 80 Prompts, 75 mit Bild | 94 % |
| **51 ohne jedes Schlagwort** | 64 % |
| 3 Favoriten, 1 Bewertung | von 80 |
| 30 in einer Sammlung | 50 lagen nirgends |
| 59 aus einem einzigen Monat | die Zeitachse trägt nicht |
| **kein `tool`, keine `category`** | standen nur im PRD, nie gebaut |

Daraus folgt das ganze Feature: **Jede Ordnung, die Pflege verlangt, ist hier
schon einmal gescheitert.** Und der naheliegende Ausweg — nach einem festen
Feld gruppieren, wie Lightroom oder Eagle es tun — war unmöglich, weil es kein
Feld mit wenigen festen Werten gibt.

Was lückenlos da ist: das Bild (94 %), gute Titel („Frau im Regen", „Feuer und
Eis") und `last_used_at` (47 von 80). Darauf baut alles.

**Die Ordnung, die Mark nicht pflegt, macht die Maschine einmal.**

## Was Scout beigetragen hat — und was daran nicht stimmte

Recherche zu Lightroom, Eagle, Apple Fotos, Notion und Prompt-Verwaltungen.
Zwei Befunde sind eingeflossen:

- **Die Kacheln nicht verkleinern, um mehr unterzubringen.** Das ist der
  naheliegendste und schlechteste Weg zu „weniger Scrollen" — und Mark hatte
  vorher gesagt, dass ihm die Kacheln *wegen* der großen Bilder gefallen.
- **Kein Vergrößern beim bloßen Überfahren.** Bei dicht stehenden Kacheln löst
  man dabei ständig den Nachbarn aus; auf dem Handy gibt es kein Überfahren.

Scouts **stärkste** Empfehlung — „nach Werkzeug gruppieren" — wurde verworfen:
Das Feld gibt es nicht. Er hatte selbst dazugeschrieben, dass er das nicht
geprüft hat. Ein Befund eines Agenten wird an der Datei nachgemessen, bevor
danach gehandelt wird.

## Was gebaut wurde

**Datenbank** (`supabase/migrations/20260905_themen.sql`): Tabelle `themen` mit
Name, Beschreibung, `titelbild_prompt_id`, `beleg_prompt_ids[]` und Sortierung,
dazu `prompts.thema_id`. RLS wie überall: `auth.uid() = user_id`.

**Einsortierung** (`worker/src/themen-vorschlagen.mts`): liest alle Prompts,
lässt sie von einer Text-KI über Marks Proxy in Themen ordnen und **zeigt das
Ergebnis nur an**. Erst mit `--speichern` wird geschrieben, und nur wenn noch
keine Themen da sind. Ergebnis: **9 Themen, 80 von 80 Prompts zugeordnet**.

**Oberfläche** (`components/prompts/themen-uebersicht.tsx`): zwei Regale, die
sich von selbst füllen („Zuletzt benutzt", „Neu dazugekommen"), darunter die
Themen als **Vitrine** — großes Titelbild, drei Belege als Streifen, Name und
Anzahl. Aus vier vorgelegten Formen hat Mark die Vitrine gewählt.

**Umbenennen und Zusammenlegen** sind eingebaut: Der Vorschlag der KI ist nicht
das letzte Wort.

## Die vier Bilder einer Karte stehen fest

Mark hat die entscheidende Frage gestellt:

> „Wer oder was entscheidet, welche Bilder da zu sehen sind? […] Wenn die immer
> gleich blieben, also nicht dass auch die Neuesten immer dann angezeigt werden,
> sondern wirklich feste, die für diese Rubrik auch wirklich stehen."

Er hat damit einen Fehler verhindert. **Ein Titelbild, das sich ändert, ist kein
Titelbild** — man müsste die Karte bei jedem Besuch neu lesen. Also:

- Die KI wählt beim Anlegen vier Bilder, an denen man das Thema erkennt.
- **Danach ändern sie sich nie von selbst.** Neue Prompts wandern ins Thema,
  aber nicht auf die Karte.
- Mark kann jedes der vier tauschen.
- Einzige Ausnahme: Wird das Titelbild gelöscht, rückt ein Beleg nach — sonst
  stünde dort eine Lücke.

## Zwei Fehler im ersten Durchgang, beide behoben

**Ein Titelbild ohne Bild.** Die KI wählte „Drohnenflug" — einen von fünf
Prompts ohne Bild. Jetzt sieht sie im Auftrag, welche Prompts ein Bild haben —
und ein Nachlauf tauscht es trotzdem, falls sie es wieder übersieht. *Eine
Regel, die ein Modell befolgen SOLL, ist keine Zusicherung.*

**Ein Prompt blieb unzugeordnet.** Übriggebliebene wandern jetzt automatisch
nach „Sonstiges".

## Warum `lt` nicht an der Seitenwurzel steht

Die Tischplatte aus dem Lichttisch liegt nur unter dem **rollenden Bereich**,
nicht an der Wurzel der Seite. `.lt > *` setzt `position: relative` auf jedes
direkte Kind — an der Wurzel hätte das die Detailspalte aus ihrer festen Lage
geholt. Genau diese Falle hatte Critic bei PROJ-62 benannt.

## Geprüft

- `npx tsc --noEmit` — keine neuen Fehler.
- `npx vitest run` — 601 Tests grün.
- `npm run build` — erfolgreich.
- In der Datenbank nachgezählt: 9 Themen, 80 Prompts, keiner ohne Thema.
- Bildschirmfoto der gebauten Übersicht (mit Platzhalterbildern, weil die
  Vorschau ohne Anmeldung keine echten Daten sieht).

## Offen

- Der **Lichtkasten mit Filmstreifen** (Bild groß, Pfeiltasten) ist noch nicht
  gebaut. Heute öffnet ein Klick die vorhandene Detailspalte.
- Die Namen der Themen weichen leicht von der Fassung ab, die Mark im Vorschlag
  gesehen hat — das Modell antwortet nicht zweimal gleich. Er kann sie
  umbenennen; genau dafür ist die Funktion da.

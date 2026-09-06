# PROJ-82 — Dritter Blattaufbau: Köpfe oben, Körper darunter

**Status:** In Review (Versuch)
**Erstellt:** 2026-09-06

## Marks Vorschlag

> „Wie wäre es, wenn wir die Aufteilung so machen würden, also großer Kopf
> links und rechts … darunter den richtigen Körper ohne Kopf, wie wir es auch
> schon beim Referenzblatt beim Charakter haben. Dann hat man auch nur einmal
> den Kopf. Könnten wir das vielleicht mal probieren, oder ist das schlecht?"

Und ausdrücklich: *„Wir halten das mal so bei, dass wir es immer wieder abrufen
können, also nicht verwerfen oder löschen."*

## Nicht schlecht — aber der Gewinn ist ein anderer als vermutet

**Zur Kopfgröße, nachgerechnet auf 1536 × 1024:**

| Personen | bisher | mit dem neuen Aufbau | |
|---:|---:|---:|---|
| 2 | ~450 px | ~400 px | der **Spalten-Aufbau bleibt besser** |
| 3 | ~400 px | **~530 px** | hier gewinnt der neue |

Bei zwei Personen darf die Nahaufnahme im Spalten-Aufbau fast die ganze
Blatthöhe nutzen; in einer oberen Hälfte kann sie das nicht. Ab drei dagegen
darf die Körperreihe niedriger sein, weil sie keinen Kopf mehr tragen muss —
die Kopfreihe bekommt 60 statt 45 Prozent.

**Der eigentliche Gewinn ist ein anderer:** Das Gesicht steht nur **einmal** auf
dem Blatt. In den anderen Aufbauten kommt es zweimal vor — klein im Ganzkörper,
groß in der Nahaufnahme — und das Modell kann die beiden leicht verschieden
malen. Ein Referenzblatt mit zwei Fassungen desselben Gesichts ist schwächer
als eines mit einer.

## Eine Korrektur an Marks Formulierung

Er sagte „der Körper **ohne Kopf**". Genau so darf es **nicht** im Prompt
stehen.

„Eine Person ohne Kopf" ist für ein Bildmodell eine **anatomische** Aussage,
und die Ergebnisse reichen von „malt den Kopf trotzdem" bis zu etwas, das
niemand sehen will. Gemeint ist ein **Bildausschnitt**: Der Rahmen beginnt
unterhalb des Kinns. Das ist eine Kameraanweisung, die jedes Modell versteht —
und genau das, was echte Reference Sheets tun.

Im Prompt steht deshalb ausdrücklich:

> THE BOTTOM ROW IS CROPPED, NOT HEADLESS … Do not draw a person without a
> head, do not show a cut or a stump — crop the picture, nothing else.

Ein eigener Test nagelt genau diese Zeilen fest.

## Der bisherige Aufbau bleibt

Der Dialog bietet beide zur Wahl, „Nach Personenzahl" ist die Vorgabe. Der
gewählte Aufbau wird am Auftrag festgehalten (`scene_meta.aufbau`) — sonst
rätselt man beim Vergleich zweier Blätter, welches welches war.

Ein Test hält fest, dass der bisherige Aufbau durch diese Änderung **nicht**
berührt wird.

## Im Browser nachgesehen

Auswahl vorhanden, beide Möglichkeiten mit Erklärung, die erste vorbelegt.
Dabei fiel ein Widerspruch auf, den kein Test findet: Der Einleitungstext
beschrieb noch **einen** Aufbau, obwohl direkt darunter zwei zur Wahl standen.
Umformuliert.

## Dateien

| Datei | Was |
|-------|-----|
| `src/lib/gruppen-referenz.ts` | `Aufbau`, `AUFBAUTEN`, `kopfUndKoerper()` |
| `src/lib/gruppen-referenz.test.ts` | 28 Tests, davon 7 für diesen Aufbau |
| `src/components/characters/gruppen-referenz-dialog.tsx` | Auswahl, Einleitung |

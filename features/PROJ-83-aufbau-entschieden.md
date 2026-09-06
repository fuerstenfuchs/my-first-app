# PROJ-83 — Entschieden: zwei Spalten bei zweien, Marks Aufbau ab dreien

**Status:** In Review
**Erstellt:** 2026-09-06

## Marks Urteil, an echten Blättern gefällt

> „Also bei zwei Personen ist dein Vorschlag der Bessere. Den lassen wir so.
> Ab drei Personen nehmen wir mein Vorschlag."

Beide Aufbauten wurden erzeugt und nebeneinander gehalten. Das ist die Art
Entscheidung, die man nicht rechnen kann — die Rechnung sagte vorher nur, dass
es eng wird; das Blatt zeigte, wie eng.

## Was die Blätter gezeigt haben

**Spalten-Aufbau, zwei Personen:** trägt. Ganzkörper links, großes Gesicht
rechts, beide Hälften voll ausgenutzt, Kleidung sauber zugeordnet.

**Marks Aufbau, zwei Personen:** scheitert — und zwar deutlicher, als die
Rechnung vermuten ließ:

* Die Körper in der unteren Reihe sind **winzig** und schweben in einer
  halbleeren Zeile.
* Zwischen den beiden klafft eine **breite leere Mitte**; die Reihe hat die
  Blattbreite nicht gefüllt.
* Die **Köpfe sind trotz der Anschnitt-Anweisung noch dran** — das Modell hat
  die Figuren geschrumpft statt sie anzuschneiden.

Bei drei Personen fällt der Grund weg: Dort ist die Reihe von selbst voll.

## Die Regel

| Personen | Aufbau |
|---:|---|
| 2 | zwei Blatthälften — je Ganzkörper und Kopf nebeneinander |
| ab 3 | Köpfe oben, Körper darunter (Marks Aufbau) |

Alle drei Aufbauten bleiben einzeln wählbar, auch der erste. Mark: *„nicht
verwerfen oder löschen."* Wer vergleichen will, braucht sie alle.

## Aus dem Fehlbild gelernt

Neu im Prompt, und es steht dort wegen genau dieses Bildes:

> EACH BODY FILLS ITS OWN HEIGHT. In the bottom row the shoulders start at the
> very top of that row and the feet reach its bottom edge. Do not shrink the
> figures and do not leave empty space above them — a small figure floating in
> a large empty row is the one thing this row must not become.

Der letzte Halbsatz beschreibt wörtlich, was auf dem Fehlblatt zu sehen war.
Ein eigener Test hält die Zeilen fest, damit sie beim nächsten Umbau nicht
stillschweigend verschwinden.

## Am Dreier-Blatt geprüft — und ein Teil der Vorhersage war falsch

Mark: *„Hat doch ganz gut funktioniert mit den drei. Hab auch schon ein Bild
damit erstellt, also perfekt."*

Was gehalten hat: große, klar lesbare Gesichter in der oberen Reihe; die
Körperreihe füllt ihre Höhe (die neue Anweisung wirkt); jede Person in ihrer
eigenen Kleidung, nichts vertauscht.

**Was NICHT gehalten hat: der Anschnitt.** Die Körper in der unteren Reihe
tragen ihre Köpfe weiterhin, nur klein. „Cropped, not headless" wird also
zuverlässig ignoriert — bei zwei Personen wie bei dreien.

Das ist bewusst so belassen. Das Blatt erfüllt seinen Zweck, weil die großen
Gesichter oben stehen; der kleine Kopf unten schadet nicht, er kostet nur etwas
Platz. Härter darauf zu drücken hieße, gegen eine Neigung des Modells
anzuschreiben, für einen Gewinn, den niemand sieht.

**Für den nächsten, der hier arbeitet:** Wenn die Körperreihe größer werden
soll, ist der Weg nicht eine schärfere Anschnitt-Formulierung, sondern ein
größerer Anteil für die untere Reihe — der Kopf dort ist dann eben mit drauf.

## Tests

30 in `gruppen-referenz.test.ts`, darunter je einer für die neue Vorgabe bei
zwei und bei drei Personen, einer für die Fülle-Anweisung und einer, der
festhält, dass der erste Aufbau weiter abrufbar ist.

## Dateien

`src/lib/gruppen-referenz.ts`, `src/lib/gruppen-referenz.test.ts`

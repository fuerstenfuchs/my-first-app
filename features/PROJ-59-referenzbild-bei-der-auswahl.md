# PROJ-59: Das Referenzbild gleich bei der Auswahl wählen

## Status: In Review
**Created:** 2026-09-04

## Warum

Mark am 04.09.2026, nach drei Anläufen an derselben Leiste:

> „Wenn ich zum Beispiel bei Charakter auf einen Charakter drücke, dann geht
> das auf. Also nicht oben in dem Bausteinekasten, sondern wenn ich auf einen
> Charakter gehe oder ein Outfit oder egal was. Und es gibt mehrere Fotos, was
> ja fast immer der Fall ist. Dann geht groß alles auf. Ich wähl ja ein Foto,
> und das geht wieder zu und es wird übernommen, fertig."

Vorher waren es **zwei Arbeitsgänge**: erst den Charakter aus der linken Spalte
wählen, dann in einer schmalen Leiste am Baustein das Referenzbild suchen. Die
Leiste war der eigentliche Ärger — an einem Tag dreimal nachgebessert
(vorausgewählt, größer, nicht mehr zugeschnitten) und immer noch eng, weil die
Bausteinkarte nun einmal rund 250 Pixel breit ist.

**Das ist NICHT der Vorschlag, den Mark verworfen hat.** Im Entwurf
„Studio-Konsole" sollte sich die Auswahl **am Steckplatz** öffnen, also oben im
Bausteinekasten. Sein Einwand damals, und er war richtig: „dann leidet die
Übersichtlichkeit, wenn ich was auswählen muss. Also wär dann alles zu klein
dargestellt, die Fotos." Dieser Dialog öffnet sich **an der Stelle der
Auswahl** und nimmt das ganze Fenster — genau der Platz, der am Steckplatz
fehlte.

## Was gebaut wurde

Ein Klick auf einen Charakter, ein Outfit oder eine Location in der linken
Spalte wählt wie bisher den Baustein. Hat er **zwei oder mehr** Referenzbilder,
geht danach ein großes Fenster auf: alle Bilder nebeneinander, vollständig
sichtbar, mit ihrem Variantennamen. Ein Klick wählt und schließt.

Verdrahtet in `setSlot` — der einen Stelle, durch die jede Bausteinauswahl
läuft. Damit gilt es für alle drei Bausteine mit Referenzbildern, ohne dass es
dreimal dasteht.

### Drei Entscheidungen mit Begründung

**Erst laden, dann öffnen.** Nicht sofort mit einem Ladekringel aufmachen: Bei
einem Baustein mit nur einem Bild ginge das Fenster auf und sofort wieder zu.
Ein Fenster, das aufblitzt, ist schlimmer als eines, das eine halbe Sekunde
später kommt.

**Ab zwei Bildern.** Bei einem gibt es nichts zu entscheiden, und
`standardReferenz` hat es ohnehin schon gesetzt, falls es ein Referenzsheet
ist.

**Die Leiste am Baustein bleibt.** Sie ist nach den heutigen Änderungen
brauchbar (Referenzsheet vorn und vorgewählt, 96px hoch, vollständige Bilder)
und der einzige Weg, das Bild später zu wechseln, ohne den Baustein neu zu
wählen. Der Dialog nimmt ihr nur die Hauptlast ab.

## Was an einem Tag davor lag

Derselbe Ärger, in vier Schritten — jeder für sich richtig, keiner allein
genug:

1. **Referenzsheet vorausgewählt und vorne einsortiert.** Marks Bitte: „dass
   immer das Referenzsheet als Bild genommen wird als Erstes".
2. **Von 32 auf 88 Pixel, mit Namen darunter.** „Größer" allein hätte nicht
   gereicht: Man wusste nicht, WELCHES das Referenzsheet ist, solange man es am
   Bildinhalt erraten musste. Der Name stand längst im `label`.
3. **Rollbalken zurück.** Mein eigener Fehler: Die Leiste trug `scrollbar-hide`
   — eine Klasse, die in diesem Projekt nie definiert wurde. Sie tat nichts,
   und Mark hatte einen normalen Rollbalken. Beim Beheben des abgeschnittenen
   Rands habe ich ihm genau den weggenommen.
4. **`object-contain` statt `object-cover`.** Der eigentliche Kern: „dass man
   die Bilder immer nur halb sieht, gerade wenn links und rechts etwas ist auf
   dem Bild". Ein Referenzsheet ist breit; in ein Quadrat geschnitten bleibt
   der mittlere Streifen übrig — genau das, was am wenigsten aussagt.

## Geprüft

597 Tests grün, `tsc` sauber bis auf die zwei bekannten Altlasten, Build
übersetzt.

**Im Browser nicht nachgemessen** — der Scene Builder liegt hinter der
Anmeldung. Was Mark beim ersten Versuch prüfen sollte: dass das Fenster bei
einem Baustein mit nur einem Bild **nicht** aufgeht.

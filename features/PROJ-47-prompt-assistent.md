# PROJ-47: Prompt-Assistent im Bildstudio

## Status: In Progress
**Created:** 2026-09-03

## Warum

Mark am 03.09.2026, wörtlich:

> „Oft habe ich zwar eine Idee von irgendwas, kann das aber nicht genau
> ausdrücken und dann frage ich einfach, wie ich jetzt auch dich hier frage im
> Chat, nach einem Prompt zum Beispiel für irgendwas und der wird mir dann
> ausgegeben. Im besten Fall erscheint der Prompt dann direkt im
> Erzeugen-Fenster."

Das ist die Lücke zwischen Einfall und Auftrag. Der Trésor verwaltet fertige
Prompts, der Scene Builder setzt sie aus Bausteinen zusammen — aber für „ich
hätte gerne irgendwas mit einem alten Fischer im Nebel" gibt es bisher keinen
Weg außer: Fenster wechseln, woanders fragen, zurückkopieren.

Möglich wird es erst jetzt: Seit PROJ-43 läuft der Proxy, und darin stecken
starke Textmodelle aus Marks vorhandenen Abos.

## Wo

Im Bildstudio, in der linken Spalte **unter** dem Erzeugen-Block — also unter
Prompt, Modell, Format und Anzahl. Auf derselben Seite, damit das Ergebnis
direkt ins Prompt-Feld darüber wandern kann, ohne Umweg über die
Zwischenablage. Mark: „Ist er dann auf derselben Seite, wäre er kein Problem."

## Was es können muss

- Freie Frage in Alltagssprache, Antwort ist ein fertiger Bildprompt.
- **Nachfassen**: „kürzer", „mehr Nebel", „ohne Personen". Ein einzelner Schuss
  reicht nicht — genau das Nachschärfen ist der Grund, warum Mark sonst in
  einen Chat wechselt.
- Ein Knopf, der den Prompt in das Erzeugen-Feld darüber setzt.
- Modellwahl. Mark: „Da kann man natürlich auch verschiedene Modelle nehmen."
- Der Assistent kennt den Zusammenhang: **welches Bildmodell** eingestellt ist
  (ein Prompt für gpt-image-2 sieht anders aus als einer für Gemini), welches
  **Format**, und ob **Referenzbilder** anliegen. Ohne das schriebe er Prompts
  für ein Werkzeug, das gar nicht benutzt wird.

## Was es bewusst NICHT tut

**Kein Rückfall auf einen bezahlten Dienst.** Bei den Analysen gab es einen
bestehenden bezahlten Weg, auf den zurückgefallen wird. Hier gibt es keinen —
und ein neues Feature, das ungefragt Geld ausgibt, wäre die falsche
Voreinstellung. Ist der Proxy aus, sagt das Feld das und verweist auf die
Einstellungen.

## Offene Fragen

- Soll der Assistent die Bausteine kennen (Charaktere, Locations)? Dann könnte
  er „nimm Esther" verstehen. Reizvoll, aber es macht aus einem kleinen Feld
  ein zweites Scene-Builder-Fenster — erst nach dem ersten Gebrauch entscheiden.
- Soll ein erzeugter Prompt direkt im Trésor speicherbar sein? Der Knopf dafür
  existiert im Erzeugen-Block bereits, greift also automatisch.

## Umsetzung (03.09.2026)

**Dateien**
- `src/lib/proxy-text.ts` — Proxy-Anbindung, Modelle, Anweisung (vorab gebaut).
- `src/components/prompt-assistent.tsx` — NEU. Das Gesprächsfeld.
- `src/components/freie-erzeugung.tsx` — Einbau unter dem Erzeugen-Block.

**Entscheidungen**
- Zugeklappt (`Collapsible`), Vorgabe: zu. Die Spalte ist ab 240px schmal, und
  zu viel verbrauchte Höhe war dort schon einmal ein berechtigter Einwand.
- Der ganze Verlauf geht bei jeder Runde an `promptSchreiben` — sonst wüsste das
  Modell beim Zuruf „kürzer" nicht, was es kürzen soll.
- Der Zusammenhang steht sichtbar über der Modellwahl („Schreibt für GPT
  Image 2 · Landscape (16:9) · 2 Referenzen"). Er verändert das Ergebnis, also
  soll man ihn sehen, ohne ihn zu suchen.
- „In das Prompt-Feld" setzt den Text und rollt zum Feld hinauf. Ohne den Sprung
  sähe es aus, als sei nichts passiert — der Assistent sitzt ja UNTER dem Feld.
- Kein Rückfall auf einen bezahlten Dienst, wie in der Spezifikation verlangt:
  Ist der Proxy aus, erscheint die Meldung aus `ProxyAus` unverändert plus ein
  Verweis auf `/einstellungen`.

**Geprüft**
- `npx tsc --noEmit` — nur die zwei bekannten Altfehler.
- `npm run build` und `npm test` (309 Tests) laufen durch.
- Im Browser bei 240px Spaltenbreite: zugeklappt eine Zeile, aufgeklappt bricht
  nichts aus der Spalte aus. Enter schickt ab. Der Proxy-aus-Weg wurde
  ausgelöst und zeigt Meldung, Verweis und den erhaltenen Verlauf.

**Nicht geprüft**
- Der Erfolgsweg mit laufendem Proxy (auf diesem Rechner nicht erreichbar):
  echte Antwort, Nachfassen über mehrere Runden, Abbrechen, Kopieren.
- Der Einbau im echten Bildstudio steht hinter der Anmeldung; geprüft wurde die
  Komponente einzeln.

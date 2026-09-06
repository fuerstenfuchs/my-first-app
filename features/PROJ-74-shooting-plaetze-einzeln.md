# PROJ-74 — Shooting-Plätze als Einzelbilder, Blatt ohne Schrift

**Status:** In Review
**Erstellt:** 2026-09-06

## Marks Einwand, der das ausgelöst hat

> „Außerdem, woher soll die KI dann wissen, welches von diesen Bildern genommen
> wird? wird dann nur das ganze Bild als Referenz hinzugefügt."

Er hat damit einen Konstruktionsfehler getroffen, den ich selbst gebaut hatte.

Ein Blatt mit sechs Feldern geht später als **ein** Bild in den Auftrag. Das
Modell sieht sechs Hintergründe und weiß nicht, welcher gemeint ist. Beim
Charakter-Sheet ist das harmlos: Dort zeigen alle Felder **dieselbe** Person aus
verschiedenen Winkeln, sie verstärken sich gegenseitig. Beim Shooting-Sheet
sind sie **Alternativen**, und gewollt ist genau eine.

Ein Zwischenschritt mit großen Nummern 1–6 in den Ecken ist wieder verworfen
worden — Mark wollte das Blatt ohne Schrift, und Nummern hätten das Modell
ohnehin nicht gehindert, die anderen fünf mitzulesen.

## Was jetzt gebaut ist

**Das Blatt bleibt als Übersicht — ein Menü der Plätze.** Ohne jede Schrift:
keine Nummern, keine Beschriftungen, keine Überschriften.

**Und vier Einzelbilder daneben:** Weit, Mit Tiefe, Fläche, Gegenlicht. Je ein
vollformatiges, leeres Foto in voller Auflösung statt als Sechstel. Das ist
das, was als Referenz wirklich taugt.

Marks Zahl war vier („sagen wir, vier weitere Bilder"). Sachlich passt sie: Es
sind die vier Arten von Hintergrund, die sich fotografisch wirklich
unterscheiden. Ein fünfter wäre eine Variante, keine neue Möglichkeit.

## Der Unterschied zum Location-Sheet steht jetzt im Prompt

Mark: „sollten dann schon Shooting Locations sein, wo man sieht, aha, da kann
das Model oder könnte jemand stehen? Im Gegensatz zum normalen Referenzsheet,
da sieht man ja nur die Location von verschiedenen Perspektiven."

Ein Location-Sheet beantwortet „wie sieht es hier aus". Dieses beantwortet „wo
könnte jemand stehen". Also: Kamera auf Augenhöhe, Standplatz im Vordergrund
mit Raum drumherum, Hintergrund mit genug Trennschärfe dahinter, dass eine
Person sich davon abheben würde.

## Vier Aufträge, nicht ein Auftrag mit vier Durchläufen

Dieselbe Bauart wie bei der Einstellungsreihe (PROJ-44): `anlegen()` nimmt
EINEN Prompt und erzeugt ihn `variants`-mal. Jeder Platz braucht aber einen
anderen Prompt — „mit Tiefe" und „Fläche" unterscheiden sich genau im
Textbaustein. Vier Durchläufe eines Auftrags gäben viermal denselben Platz.

Nebeneffekt, ohnehin gewollt: Ein misslungener Platz lässt sich einzeln
wiederholen, ohne die anderen drei noch einmal zu bezahlen.

Die Sperre gegen Doppelklick liegt im `useRef`, nicht im State — `setLaeuft`
wirkt erst beim nächsten Rendern, zwei schnelle Klicks reihten sonst acht
bezahlte Aufträge ein statt vier.

Alle vier tragen dieselbe `reihe_id` in `scene_meta`. Der Lichttisch zeigt sie
noch nicht gruppiert; ohne die Kennung wäre das später gar nicht möglich.

## Warum die Platten neutral bleiben müssen

Drei Dinge entscheiden, ob eine Platte brauchbar ist, und alle drei gehen
lautlos verloren, wenn sie aus dem Prompt fallen:

* **leer** — eine erfundene Figur müsste Mark erst wieder wegräumen
* **ein Foto, kein Blatt** — ein Raster hätte genau das Problem, das die
  Platten gerade lösen
* **neutrales Licht** — eine Golden-Hour-Platte ist für nichts anderes zu haben

20 Tests decken genau diese drei ab, zwei Mutationen gegengeprüft
(Personenverbot abgeschwächt, Blatt-Verbot entfernt — beide fangen).

## Was das NICHT tut

Die Einzelbilder gibt es nur beim Shooting-Sheet. Beim Location- und
Gebäude-Sheet wären sie sinnlos: Dort sind die Felder **Ansichten** desselben
Gegenstands, die sich gegenseitig erklären.

## Dateien

| Datei | Was |
|-------|-----|
| `src/lib/shooting-spots.ts` | neu — vier Plätze, `spotPrompt` |
| `src/lib/shooting-spots.test.ts` | neu — 20 Tests, 2 Mutationen |
| `src/components/locations/shooting-spots-button.tsx` | neu — vier Aufträge |
| `src/components/locations/location-sheet-dialog.tsx` | Blatt ohne Schrift, Knopf eingehängt |

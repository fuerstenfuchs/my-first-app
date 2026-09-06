# PROJ-75 — Die Shooting-Kette

**Status:** In Review
**Erstellt:** 2026-09-06

## Marks Idee

> „Das Bild mit den verschiedenen Locations drauf, das könnte man ja für eine
> weitere Kette nutzen. Also zum Beispiel sage ich, Charakter X hat ein
> Shooting an diesem Strand. Dann nimmt man das als Referenzbild und es kommen
> vier Bilder raus an diesem Strand fotografiert, aber an diesen verschiedenen
> Orten eben … dass ein Shooting praktisch zum nächsten Spot weitergeht, dort
> noch mal ein Foto macht und so weiter. Also ein ganzes Shooting simulieren."

Und, auf die Frage nach dem Einstieg: *„werden mir beide Wege recht."* Also
beide gebaut.

## Die alte Kette lebt wieder — mit der richtigen Achse

PROJ-44 baute genau diesen Motor: N Aufträge aus einer Szene, gemeinsame
`reihe_id` in `scene_meta`, Sperre gegen Doppelklick. 311 Zeilen mit Tests. Und
wurde zurückgestellt mit dem Vermerk **„Achse falsch, Motor bleibt"**.

Die Achse war die Einstellungsgröße — Totale, Halbnah, Nah. Das ist Filmschnitt
und liegt neben dem, was Mark tut. **Seine Achse ist der Ort**, und die trägt:
gleicher Mensch, gleiches Licht, gleicher Tag, vier Plätze. Das *ist* ein
Shooting.

Die alte Achse ist dabei nicht verworfen, sondern **eingebaut**.

## Paarung von Platz und Einstellungsgröße

Vier gleichwertige Bilder sehen aus wie vier Versuche. Mit wechselnder
Einstellungsgröße sieht die Serie aus wie geschnitten — und die Größe folgt
nicht dem Zufall, sondern dem Platz:

| Platz | Größe | warum |
|-------|-------|-------|
| Weit | Wide Shot | die Weite IST das Motiv |
| Mit Tiefe | Environmental | die Fluchtlinie braucht Umgebung |
| Fläche | Portrait | eine Materialfläche trägt nur nah |
| Gegenlicht | Full Body | Kontur braucht die ganze Figur |

## Marks drei weitere Gedanken, alle gebaut

**Der Weg dazwischen.** Ein fünftes Bild zwischen Platz 2 und 3 — unterwegs,
mid-stride, halb abgewandt, über die Schulter blickend. Unposiert. Das ist der
Unterschied zwischen Katalog und Reportage. Abwählbar.

**Eine Haltung je Platz.** Ohne das steht dieselbe Pose viermal an vier Orten.
Die Haltungen sind bewusst schlicht — sie sollen die Person bewegen, nicht die
Szene übernehmen, die im Scene Builder schon steht.

**Outfitwechsel.** Ab dem Platz **nach** dem Übergang; der Übergang ist der Weg
dorthin und trägt noch das erste. Wichtig: **Die Referenzbilder wechseln mit.**
Wer den Wechsel nur in den Prompttext schreibt und weiter das alte
Kleidungsstück anhängt, hat zwei gegenläufige Anweisungen im selben Auftrag —
und das Bild gewinnt gegen den Text.

## Kontinuität steht in JEDEM einzelnen Prompt

Das ist der Punkt, an dem so etwas still scheitert. Die fünf Aufträge laufen
getrennt; das Modell sieht sie **nie nebeneinander**. „Bild 3 von 5, dieselbe
Person, derselbe Tag, dasselbe Licht" muss deshalb in jedem Prompt stehen —
nicht einmal irgendwo.

## Beide Einstiege, ein Bauteil

* **Scene Builder** — dort liegen Licht, Wetter, Kamera und Stil ohnehin. Der
  Block erscheint nur, wenn Ort *und* Charakter gesetzt sind.
* **Location → „Shooting hier"** — der Ort steht schon, es fehlt nur, wer
  fotografiert wird. Bewusst ohne Licht-, Wetter- und Kamerafelder: Wer die
  braucht, nimmt den Scene Builder. Ein kurzer Weg mit zwanzig Feldern wäre
  keiner mehr.

Beide benutzen `ShootingKetteButton`. Zwei Kopien wären beim nächsten Umbau
auseinandergelaufen.

## Tests

12 Stück in `shooting-kette.test.ts`. **Drei Mutationen gegengeprüft** —
Outfitwechsel ausgehebelt, Kontinuitätsblock entfernt, zwei gleiche
Einstellungsgrößen. Alle drei fangen.

Beim ersten Versuch griff eine Mutation **nicht**: Mein `sed` traf die Zeile
wegen falscher Einrückung nicht, und der Lauf meldete brav „12 passed". Eine
Gegenprobe, die nichts verändert, beweist nichts — das fällt nur auf, wenn man
sie selbst nachmisst.

## Im Browser geprüft

Beide Einstiege auf der Produktionsadresse geöffnet, angemeldet. Dabei ein
Grammatikfehler gefunden, den kein Test findet: „Dafür fehlt noch **einen**
Charakter" — Akkusativ statt Nominativ, und bei zweien fehl**en** sie.

## Dateien

| Datei | Was |
|-------|-----|
| `src/lib/shooting-kette.ts` | neu — Paarung, Haltungen, Übergang, Kontinuität |
| `src/lib/shooting-kette.test.ts` | neu — 12 Tests, 3 Mutationen |
| `src/components/shooting-kette-button.tsx` | neu — für beide Wege |
| `src/components/locations/shooting-hier-dialog.tsx` | neu — der kurze Weg |
| `src/app/(app)/scene-builder/page.tsx` | Block unter dem Auftragsknopf |
| `src/app/(app)/locations/page.tsx` | Knopf „Shooting" neben „Sheet" |

# PROJ-60: Seitenleiste in Glas auf warmem Stein

## Status: In Review
**Created:** 2026-09-05

## Warum

Mark am 05.09.2026:

> „Heute möchte ich, dass du dir Gedanken machst um die linke Seitenleiste, und
> zwar nur vom Designtechnischen her. […] Was ich möchte, ist ein schönes
> Liquid Glass Design, vor allem die Buttons, und ein schönes Hintergrundbild
> für die Seitenleiste. Es kann natürlich auch nicht zu bunt werden, wie es
> bisher ist. Aber das sollte in einem schönen, edlen Design sein."

Nachgemessen, bevor gestaltet wurde: Die Leiste hatte **acht verschiedene
Neonfarben auf 256 Pixel Breite** — jede Kachel bekam über `kachelStil()` ihren
eigenen Farbverlauf als Rand plus farbigen Schein: Violett, Orange, Türkis,
Purpur, Blau, Magenta. Genau das meinte er mit „zu bunt".

Die eigentliche Entscheidung war deshalb **nicht das Glas, sondern die Farbe**:
Es gibt jetzt EINEN Akzent — Marks Orange —, und der markiert ausschließlich,
wo man gerade ist. Unterschieden werden die Kacheln vom Symbol, nicht von der
Farbe. Das ist der Weg von „bunt" zu „edel"; das Glas ist die Zugabe.

## Wie entschieden wurde

Drei Richtungen als **echte Bilder** über Marks CLIProxyAPI (`gpt-image-2`,
Qualität `high`) erzeugt, je zwei Varianten: kühles Studio, warmer Stein,
Nachtatelier. Mark: „Ich möchte das so haben wie auf dem Mockup mit dem
braunen, warmen Stein. Sieht sehr gut aus."

Danach zwei Nachfragen von ihm, beide als **anfassbare HTML-Muster** beantwortet
statt als Bild — Lesbarkeit und Bewegung kann ein erzeugtes Bild nicht zeigen:

| Frage | Vorgelegt | Marks Wahl |
|---|---|---|
| Schriftart | 6 Schriften, je eine komplette Leiste | **Urbanist** |
| Hover | 5 Effekte, Ruhe und Zeiger nebeneinander | **warme Kante** + **Schein folgt dem Zeiger** |
| 21st.dev 3D-Button | wörtlich nachgebaut vs. in Glas übersetzt | **„Dieselbe Idee, in Glas übersetzt"** |

Zum 3D-Button: Der Quelltext auf 21st.dev ist gesperrt; der Effekt ist reines
CSS und wurde aus der Vorschau nachgebaut — Neigung über `perspective/rotate`,
Sockel über gestapelte `box-shadow`-Ebenen. Wörtlich übernommen wäre es Plastik
gewesen: dick, undurchsichtig, und geneigt hätte es mit sieben Nachbarn
gekämpft. Übernommen wurde deshalb nur die **Tiefe**: Das Glas steht auf einem
warmen Sockel und sinkt beim Drücken hinein.

## Was gebaut wurde

**`src/components/sidebar-glas.css` (neu)** — das gesamte Aussehen an einer
Stelle:

- `.leiste-stein` trägt den Steingrund, eine Körnung und einen Sockelverlauf.
- `.glas-kachel` ist das Material: `backdrop-filter: blur(14px) saturate(150%)`,
  helle obere Lichtkante, gestapelter Sockelschatten.
- `:hover` → warme Kante, warmes Symbol, Lichtschein unter dem Zeiger.
- `:active` → die Kachel sinkt 4px ein, der Sockel klappt zusammen.
- `[data-aktiv='ja']` → orange Füllung **und** Balken links.

**`src/components/app-sidebar.tsx`** — alle zehn Kacheln nutzen `.glas-kachel`,
`data-aktiv` und `onPointerMove={scheinFolgen}` (setzt `--mx`/`--my`).

**`src/lib/sidebar-nav.ts`** — `kachelStil` entfernt; an ihrer Stelle steht ein
Kommentar, der erklärt warum. `farben` bleibt am Eintrag: der Wert wird für das
Symbol gebraucht, und wer die Leiste je wieder bunter will, findet die
ursprünglichen Werte dort statt in der Versionsgeschichte. Kurznamen auf ein
Wort gekürzt („Kamera", „Look") — Mark: „Ein Wort reicht immer."

**`src/app/layout.tsx`** — Urbanist als `--font-leiste`, **nur für die Leiste**.
Der Auftrag lautete ausdrücklich „nur die linke Seitenleiste".

**`public/leiste-grund.jpg`** — 384×1400, aus dem gewählten Mockup-Bild.

## Drei Stellen, an denen es sonst falsch geworden wäre

**1. Der Stein muss auf das INNERE Element.**
`<Sidebar className="…">` reicht die Klasse an den äußeren Rahmen weiter; die
sichtbare Fläche ist das innere `[data-sidebar="sidebar"]` und trägt
`bg-sidebar` — eine deckende Farbe, die den Stein übermalt hätte. Nachgemessen
in `src/components/ui/sidebar.tsx:259-262`, nicht angenommen. Die
shadcn-Vorlage selbst bleibt unangetastet.

**2. Auf dem Handy führt ein zweiter Weg hin.**
Am Telefon ist die Leiste kein Panel, sondern eine Schublade (`Sheet`) — und
`className` erreicht sie NICHT (`sidebar.tsx:201-217`: die Klasse geht an
`Sheet`, die sichtbare Fläche ist `SheetContent` mit fest eingebauten Klassen).
Ohne die zweite Anschrift `[data-sidebar='sidebar'][data-mobile='true']` wäre
die Handy-Leiste flach schwarz geblieben, während die Kacheln schon aus Glas
sind — Glas ohne etwas dahinter. Im Browser nachgemessen: Steinbild geladen,
Urbanist aktiv, zehn Glaskacheln vorhanden.

**3. Der Grund musste aufgehellt werden — und das war eine Messung.**
Im Mockup lag der hellste Teil des Steins ganz oben und war frei; in der echten
Leiste sitzt dort die Logokarte und deckt ihn ab. Der sichtbare Rest kam auf
einen Mittelwert von **13/14/11** — also schwarz, und nicht einmal warm (Grün
über Rot). Nach +55 % Helligkeit und +35 % Sättigung sind es **32/27/20**, Rot
über Grün über Blau. Am gerenderten Bildschirmfoto gegengeprüft: oben 78/65/52.
Wer das Bild neu erzeugt, muss diesen Schritt wiederholen.

## Körnung ist Voraussetzung, nicht Zierde

`backdrop-filter` zeigt nur, was hinter dem Element **variiert**. Über einer
112px breiten Kachel ändert sich ein glatter Verlauf um zwei bis vier Grauwerte
— weichgezeichnet ergibt das eine gleichmäßige Fläche, und das Glas
verschwindet. Der Stein bringt Korn mit, verliert es aber beim Skalieren von
384 auf 256 Pixel. Die Körnungsebene bringt es zurück; ohne sie wäre der ganze
Effekt unsichtbar gewesen.

## Die aktive Kachel braucht zwei Merkmale, nicht eins

Mark hat „warme Kante" als Hover gewählt — und der aktive Zustand war bis dahin
ebenfalls nur eine orange Kante. Beim Darüberfahren hätte man dann nicht mehr
gesehen, wo man ist. Ich habe ihn darauf hingewiesen, er wollte den Effekt
trotzdem. Also gestalterisch gelöst statt durch Weglassen:

- **Hover** = orange KANTE (plus warmes Symbol, plus Lichtschein).
- **Aktiv** = orange FÜLLUNG **und** Balken links.

Zwei Merkmale schlagen eines, und der Balken bleibt sichtbar, während der
Zeiger auf einer anderen Kachel steht.

## Geprüft

- `npx tsc --noEmit` — keine neuen Fehler (zwei alte in `use-stats.test.ts` und
  `tests/proj-4-sammlungen.spec.ts` bestanden vorher schon, andere Dateien).
- `npx vitest run` — 601 Tests, 38 Dateien, alle grün.
- `npm run build` — erfolgreich.
- Bildschirmfotos aus der echten App (nicht aus dem Mockup): Ruhe, Hover und
  aktive Kachel, gemessen statt geschätzt.
- Handy-Schublade: Hintergrundbild, Schriftart und Kachelzahl im Browser
  ausgelesen.

## Was Critic gefunden hat — und was daraus wurde

Critic hat die Umgestaltung nach dem ersten Ausliefern geprüft. Zwei Funde
waren echte Fehler, die Mark sonst getroffen hätten:

**Die Leiste wäre auf dem Handy unbedienbar gewesen.** Die zweite Anschrift für
die Schublade brachte `position: relative` mit — und die Schublade ist bereits
`fixed` (`ui/sheet.tsx:34`). Zwei Merkmale wiegen schwerer als eines, also hätte
`relative` gewonnen: Die dunkle Überblendung hätte sich über den Bildschirm
gelegt, die Leiste selbst wäre ans Seitenende gerutscht und hinter der
Überblendung nicht mehr erreichbar gewesen. Im Browser nachgestellt und
gemessen: mit der alten Zeile `relative`, ohne sie `fixed`. `position` steht
jetzt nur noch am festen Panel, das es wirklich braucht.

**Auf der aktiven Kachel sank nichts ein.** `:active` und `[data-aktiv='ja']`
wiegen gleich viel; bei Gleichstand gewinnt die spätere Regel, und das war die
aktive. Auf der Kachel, auf der man gerade steht — also der, die man am
häufigsten anklickt —, rutschte die Kachel 4px nach unten, während der Sockel
in voller Höhe stehen blieb: Sie löste sich vom Sockel ab, statt hineinzusinken.
Genau der Effekt, den Mark aus dem 21st.dev-Knopf ausgesucht hat.

Weiter nachgezogen:

| Fund | Was geändert wurde |
|---|---|
| Der äußere Rahmen malte den Stein ein zweites Mal, unsichtbar unter dem inneren Panel | `.leiste-stein` aus der Steinregel entfernt |
| Sammlungen und Fußzeile hatten weiter **grüne** Hover- und Fokusfarben auf warmem Stein | `--sidebar-accent` und `--sidebar-ring` nur innerhalb der Leiste auf warme Werte gesetzt |
| Kein gestalteter Zustand für die Tastatur | `:focus-visible` bekommt dieselbe warme Kante wie der Zeiger |
| `pointermove` rechnete beim Wischen auf dem Handy mit, obwohl es dort nichts zu sehen gibt | nur Maus, und nicht bei abgeschalteter Bewegung |
| Bei jeder Zeigerbewegung wurde die Kachel neu vermessen | einmal beim Betreten, neu nur nach einem Rollvorgang |
| Der Sockel der oberen Kachelreihe verschwand unter der unteren | Abstand im Raster von 6px auf 10px |
| Der Kommentar behauptete, `farben` werde noch gebraucht | richtiggestellt: wird nirgends gelesen, bleibt als Archiv |

Nicht geändert, mit Begründung:

- **Kurznamen „Kamera" und „Look"** verstecken, dass Mimik und Grading darunter
  liegen. Marks ausdrückliche Ansage: „Ein Wort reicht immer."
- **`backdrop-filter` auf zehn Kacheln** könnte auf schwacher Hardware kosten.
  Das `isolation: isolate` am Panel begrenzt den Aufwand bereits auf den Stein
  statt auf die ganze Seite. Ohne Messung auf Marks Gerät wäre eine Änderung
  Raten — wenn es ruckelt, ist sein Auge das Instrument, nicht meine Schätzung.
- **`theme-color` ist noch Grün** (`layout.tsx:24`). Das rahmt auf dem Handy die
  ganze App ein, nicht die Leiste — außerhalb dieses Auftrags.

## Nicht angefasst

Funktion, Reihenfolge, Ziele der Kacheln, Sammlungen, Fußzeile, die
shadcn-Vorlage `ui/sidebar.tsx`. Der Auftrag war ausdrücklich nur das Aussehen.

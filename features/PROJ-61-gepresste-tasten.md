# PROJ-61: Gepresste Tasten im Scene Builder

## Status: In Review
**Created:** 2026-09-05

## Warum

Mark am 05.09.2026, nachdem ihm die neue Seitenleiste gefallen hat:

> „Denkst Du, wir können die Buttons im Scene Builder auch ähnlich schön machen?
> Muss jetzt nicht das Gleiche sein, aber sie mir doch noch sehr generisch aus
> und einfach. Vielleicht weißt Du es noch nicht, aber ich steh auf abgerundete
> Kästen und Buttons."

Nachgemessen, woran „generisch" lag: **3 Pixel Rundung**, ein Haarstrich als
Rand, sonst nichts. Das sind die Zutaten eines Formularfelds, nicht die eines
Knopfes. Sein Eindruck war messbar richtig.

Zweiter Befund, den er nicht kannte: Die Seite **mischte bereits** vollrunde und
fast eckige Knöpfe — die Filter in der linken Spalte
(`components/baustein-filter.tsx:95`) sind seit jeher `rounded-full`, die Chips
der Kartenspalte waren `rounded-[3px]`. Die Rundung beseitigt also einen
bestehenden Bruch, statt einen neuen zu schaffen.

## Wie entschieden wurde

Vier Spalten als anfassbares HTML vorgelegt — „Jetzt" plus drei Richtungen,
jeweils mit Ruhe-, Zeiger- und Gewählt-Zustand. Marks Wahl:
**A · Gepresstes Papier.** Dieselbe Wahl hatte Critic unabhängig empfohlen.

Verworfen:
- **B · Emaille-Marke** — die sichere Wahl, aber sie verbrauchte Orange für den
  Mauszeiger (siehe unten) und hatte im Ruhezustand eine schwächere Kontur als
  der Bestand.
- **C · Weiche Taste** — konturlos, nur aus Licht und Schatten. Gemessen: Die
  Kante hebt sich 1,3-fach vom Papier ab, gefordert sind 3-fach. Nicht
  reparierbar, ohne aufzugeben, was sie ausmacht — mit Kontur ist es B.

## Was gebaut wurde

`.sb-taste` in `papier.css` trägt die ganze Gestalt; `page.tsx` schaltet nur
noch `data-an` und `data-gedaempft`. Vollrund, Lichtkante oben, zweistufiger
Sockel, sinkt beim Drücken 2px ein.

Mitgerundet, damit nicht die Hälfte rund und die andere eckig ist:

| Was | vorher | jetzt |
|---|---|---|
| `.sb-mod` — die Karten | 3 px | 14 px |
| `.sb-strip` — der Bausteinbogen | eckig | 14 px |
| `.sb-plate` — das Typenschild | eckig | rechts 9 px, links scharf |
| `Fold`, `AssetThumb` | eckig | 12 px |
| Reiter oben links | 4 px | vollrund |
| leeres Feld, gestrichelte Kästchen, Vorschaubilder | eckig / 4 px | 10–14 px |
| Presets, Leeren, Kopieren, Zur Warteschlange | 6 px | vollrund, mit Sockel |

Das Typenschild bleibt **links** scharf: Dort steht die 5px-Farbkante, und die
ist das Kennzeichen der Karte — gerundet verliert sie die Schärfe, die sie als
Registerreiter lesbar macht.

## Drei Dinge, die aus der Prüfung kamen

**1. Der Gewählt-Zustand war zu hell — und das war kein Geschmack.**
Der Entwurf hatte `#e8761f → #c8560c`. Weiße Schrift darauf kommt am hellsten
Punkt auf **2,98:1**; gefordert sind 4,5:1. Das ist genau die blasse Schrift,
wegen der Mark diese Seite überhaupt neu bekommen hat — nur in Weiß statt in
Grau und deshalb schwerer als „blass" zu erkennen. Jetzt `#bc5208 → #8d3e04`,
hellster Punkt **4,83:1**. Der Unterschied ist eine halbe Helligkeitsstufe, kein
anderer Farbcharakter.

**2. Der Zeiger bleibt neutral, Orange gehört dem Gewählt-Zustand.**
Ein oranger Rand beim bloßen Darüberfahren hieße in dieser App etwas anderes:
Die Reiter oben markieren ihren gewählten Zustand mit genau diesen zwei
Merkmalen. Neutral ist zudem kräftiger — `--sb-ink3` bringt **5,69:1** gegen den
Kartengrund, ein oranger Rand nur 3,56:1. Derselbe Konflikt wie in der
Seitenleiste, dort schon einmal gelöst.

**3. Die Ruhekontur war unter der Schwelle — schon vorher.**
`--sb-rule` (#cec6b2) hebt sich nur **1,67-fach** vom Kartengrund ab; für ein
Bedienelement verlangt WCAG 1.4.11 das Dreifache. Die Taste bekommt deshalb eine
eigene Kontur. `--sb-rule` selbst bleibt: Es trägt die feinen Linien des Bogens,
und die sollen fein bleiben.

Beim ersten Einbau stand dort `#a49879` mit der Angabe „3,1:1" — **die Zahl war
falsch**, siehe unten.

## Bricht das die Druckgrafik? Nein — es macht sie erst sichtbar

In `papier.css` steht, dass sich scharfe Druckgrafik (oberhalb der Doppellinie:
Passkreuze, Randnummern, Perforation) und weiche aufgelegte Karten (unterhalb)
nicht mischen dürfen. Die Tasten leben **unterhalb**. Bisher war auch die weiche
Seite hart — die Doppellinie trennte nichts. Jetzt tut sie es.

## Nicht über `.sb-taste` gesteuert: die shadcn-Knöpfe

Erst versucht, dann verworfen: shadcn bringt eigene Klassen mit demselben
Gewicht mit (`rounded-md`, `bg-primary`). Wer beides mischt, überlässt das
Ergebnis der Ladereihenfolge der Stilblätter — dieselbe Falle wie in der
Seitenleiste, wo `.leiste-stein` gegen `fixed` stand. Die vier Knöpfe in den
Kopfzeilen sind deshalb rein über Tailwind gestaltet, direkt an der Stelle.

## Zweite Prüfung: drei Nachbesserungen

**1. Meine eigene Kontrastzahl war falsch — und stand als Beleg im Quelltext.**
`#a49879` bringt gegen den Kartengrund **2,81:1**, nicht die dokumentierten
3,1:1; gegen die eigene Füllung der Taste sind es 2,54 und auf der gedämpften
Karte 2,51. Die Schwelle wurde also an keiner der drei angrenzenden Flächen
erreicht. Ich hatte eine Schätzung aus der ersten Prüfung ungeprüft übernommen
und als gemessenen Wert weitergeschrieben — der nächste, der die Farbe anfasst,
hätte ihr geglaubt. Jetzt `#948668`: **3,52 / 3,18 / 3,14**, an allen drei
Flächen über der Schwelle. Selbst nachgerechnet, nicht übernommen.

**2. Ein Zustand, den niemand entworfen hatte.**
`ChipGroup` reicht `gedaempft` an jede Taste der Gruppe durch, auch an die
ausgewählte — und genau eine Gruppe setzt es: der Grundton in der Karte
„Studio-Hintergrund", in der sehr wohl etwas gewählt sein kann. Gedämpft gewann
Fläche, Schrift und Schatten, gewählt nur Randfarbe und Fettschrift: blassbeige
Fläche, graue Fettschrift, dunkeloranger Rand. Der Gewählt-Zustand wäre
ausgerechnet in der einen Gruppe verschwunden, in der er auftritt. Jetzt eine
eigene Regel für die Kombination: Das Orange bleibt, nur der Sockel fällt weg —
dieselbe Sprache wie `.sb-mod-dim`. Im Browser nachgestellt und ausgelesen.

**3. Zwei Flächen wurden beim Befüllen wieder eckig.**
Der Baustein-Steckplatz und das Prompt-Feld waren im leeren Zustand gerundet, im
gefüllten nicht — der Zustandswechsel las sich als Formwechsel. Beide gerundet,
dazu die letzten eckigen Reste: `Marke` (der rechteckige Zwilling der Taste),
vier Vorschaubilder, zwei gestrichelte Kästen im Warteschlangen-Feld, die drei
Auswahlfelder darüber und die Chips im Preset-Dialog.

Außerdem: `prefers-reduced-motion` galt nur für `.sb-taste` — die vier großen
Knöpfe sprangen weiter. Und die Tastatur hatte auf der **gewählten** Taste keine
Fokusanzeige mehr, weil `:focus-visible` sich die Regel mit dem Mauszeiger
teilte und vom Gewählt-Zustand überschrieben wurde; sie hat jetzt einen eigenen
`outline`-Ring, der von keiner Zustandsregel angefasst wird.

**Zwei Kommentare habe ich richtiggestellt**, weil sie etwas behaupteten, das
nicht trägt: die Begründung für das halb-scharfe Typenschild („Registerreiter" —
das Schild sitzt 14px innen und berührt keine Kante) und die Notwendigkeit eines
doppelten `:active`-Selektors.

**Offen, weil es Marks Entscheidung ist:** „Presets" und „Leeren" stehen als
vollrunde Sockelknöpfe zwischen zwei Passkreuzen — also **oberhalb** der
Doppellinie, auf der Seite der scharfen Druckgrafik. Nach der Hausregel gehören
sie dort nicht hin. Mark hat runde Knöpfe verlangt; die Regel ist unsere, nicht
seine.

## Geprüft

- `npx tsc --noEmit` — keine neuen Fehler.
- `npx vitest run` — 601 Tests, alle grün.
- `npm run build` — erfolgreich.
- Bildschirmfoto der echten Seite, oben und unten, nicht des Entwurfs. Dabei
  aufgefallen und nachgezogen: der Innenabstand der Tasten musste von 14 auf
  12 Pixel, weil eine Pille bei gleichem Abstand breiter ist als ein Rechteck
  und die Wetterzeile eine Zeile mehr umbrach.

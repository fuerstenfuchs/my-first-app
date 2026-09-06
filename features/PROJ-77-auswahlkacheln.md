# PROJ-77 — Auswahlkacheln waren auf 56 Pixel gequetscht

**Status:** In Review
**Erstellt:** 2026-09-06

## Was Mark gesagt hat

> „wenn ich hier über das Ganze das Outfit auswählen soll, da seh ich fast
> nicht, was das für ein Outfit sein soll anhand der Bilder. Schau's dir selber
> mal an."

## Warum ich es zuerst nicht geglaubt habe

Der Code sagte das Richtige: `aspect-[3/4]` für die Kachel, darunter Name und
Kategorie. Marks Bildschirmfoto zeigte breite Streifen ohne jede Schrift. Das
passte nicht zusammen, und die naheliegende Erklärung — sein Browser habe eine
alte Fassung — wäre falsch gewesen.

Auch die erste Messung führte in die Irre: Ein Testkasten mit denselben Klassen,
frei im Dokument, wurde brav 200 × 267 Pixel. Die Klasse funktionierte also.

## Was wirklich los war

Erst die Messung mit der **ganzen Dialogstruktur** zeigte es:

```
Kachel:  141 × 188 px   — korrekt
Knopf:    56 px hoch    — der Rahmen darum
```

Der Knopf trägt `overflow-hidden`. Vom 188 Pixel hohen Bild blieb also ein
56 Pixel hoher Querstreifen übrig, und der Name darunter war ganz abgeschnitten.
Genau das zeigt Marks Bild.

**Der Grund liegt im Zusammenspiel von Flex und Grid, nicht in einer der beiden
Zeilen für sich.** Das Raster ist Flex-Kind mit `flex-1` und hat damit eine
FESTE Höhe. Bei fester Höhe verteilt der Browser die freie Höhe auf die
Zeilen — bei 42 Einträgen in neun Zeilen sind das 56 Pixel je Zeile, und das
`aspect-[3/4]` der Kachel wird überstimmt.

## Gegengeprüft, statt die erste Idee zu nehmen

Im Browser, mit der echten Dialogstruktur:

| Ansatz | Knopfhöhe | Ergebnis |
|--------|----------:|----------|
| wie es war | 56 px | beschnitten |
| `align-content: start` | 56 px | **hilft nicht** |
| `grid-auto-rows: max-content` | 215 px | behoben, Raster rollt |

`align-content: start` war die naheliegende Antwort und die falsche. Ohne die
Messung wäre sie eingebaut worden, und Mark hätte dieselbe Ansicht wiederbekommen.

## Zwei weitere Gründe, warum man nichts erkannte

**`object-cover` schnitt die Mitte heraus.** Viele Outfit-Titelbilder sind
Zwei-in-einem-Aufnahmen — vorne und hinten nebeneinander. Ein Mittelschnitt
zeigt davon genau die **Lücke zwischen den beiden Kleidungsstücken**. Jetzt
`object-contain`: lieber Rand als das falsche Drittel.

**Fünf Spalten waren zu viele.** Bei 768 Pixel Dialogbreite sind fünf Spalten
141 Pixel breit, vier sind 176. Beim Wiedererkennen eines Kleidungsstücks zählt
jeder Pixel.

## Nachgemessen an der ausgelieferten Seite

| | vorher | jetzt |
|---|---:|---:|
| Knopfhöhe | 56 px | **266 px** |
| Kachel | 141 × 188, beschnitten | **176 × 235, vollständig** |
| Spalten | 5 | 4 |
| Bild | beschnitten | vollständig |
| Raster rollt | nein | **ja** |

## Wo es sonst noch stehen könnte

Gesucht nach demselben Muster (`grid` als Flex-Kind mit `flex-1`) im ganzen
Projekt: **nur diese eine Stelle.** Der zweite Raster im selben Dialog hängt in
einem gewöhnlichen Rollbereich und ist unbetroffen.

## Dateien

`src/components/prompts/asset-picker-dialog.tsx` — `auto-rows-max`, vier
Spalten, `object-contain`.

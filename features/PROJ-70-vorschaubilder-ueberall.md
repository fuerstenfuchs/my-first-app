# PROJ-70 — Vorschaubilder auf allen Seiten

**Status:** In Review
**Erstellt:** 2026-09-05

## Was Mark gesagt hat

> „viele laden immer noch sehr langsam."

Nach PROJ-68, zu dem ich ihm geschrieben hatte, ab sofort ziehe *jedes* Raster
Daumennägel. Das war falsch.

## Was wirklich der Fall war

PROJ-68 hatte **fünf** Bauteile umgestellt. Nachgezählt: 93 `<img>`-Stellen in
50 Dateien. Die übrigen 46 Dateien luden weiter die Originale — Locations,
Outfits, Look & Grading, Posen, Visual Assets, der Scene Builder und sämtliche
Dialoge.

Die Vorschaubilder lagen also vollständig im Speicher (1170 Stück, aus 1861 MB
wurden 29,7 MB), und fast keine Seite fragte danach.

## Gemessen

Je zwölf Kacheln, beide Seiten auf demselben Weg gemessen:

| Eimer | Originale | Vorschau |
|-------|----------:|---------:|
| `outfit-images`   | 35,0 s | 1,0 s |
| `location-images` | 40,0 s | 1,5 s |
| `visual-assets`   | 42,9 s | 0,7 s |

## Der Umbau

46 Dateien, mechanisch: `<img …>` → `<Vorschaubild …>`. Damit das gefahrlos
geht, wurde `Vorschaubild` **vorher** zu einem echten Eins-zu-eins-Ersatz
gemacht.

### Warum es jetzt alle Attribute durchreicht

Die erste Fassung nahm nur eine Handvoll Eigenschaften an (`src`, `alt`,
`className`, `loading`, `onClick`, `onFehler`). Beim ersten Umbau ging dadurch
still ein `onClick` verloren — die Lupe im Raster tat nichts mehr, und an der
Aufrufstelle war nichts zu sehen, weil ein nicht angenommenes Prop einfach
verschwindet.

Ein Umbau über 46 Dateien mit dieser Bauart wäre eine Wette darauf gewesen,
dass nirgends ein Attribut steht, an das ich gerade nicht denke. Deshalb:
`Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'>` plus Durchreichen.
Alles, was ein `<img>` annimmt, nimmt es auch an.

### Zwei Ergänzungen

* **Quellenwechsel von außen.** Zeigt dieselbe Kachel ein anderes Bild, muss
  der innere Zustand mitgehen — sonst bliebe das alte Bild stehen. Der
  Vergleichsschlüssel ist die *gewünschte* Adresse, nicht die gerade geladene.
* **`gross`.** Lädt bewusst das Original. Für alles, wo Mark ein Bild wirklich
  beurteilt — die Vorschau ist 480px breit und auf einem großen Bildschirm
  sichtbar weich.

## Was ausgenommen bleibt

* **Die Lupe** (`image-lightbox.tsx`) — sie zeigt das Bild in voller Größe. Dort
  *muss* das Original her; das ist der Ort, an dem die Dateigröße ihren Zweck
  hat.
* **Die beiden Logos** (Seitenleiste, Anmeldung) — die kommen aus dem eigenen
  Ordner, nicht aus dem Speicher.
* **Die Werkbank** liest ihre Pixel per `fetch` in ein `ImageBitmap`, nicht über
  ein Bildelement. Der Bearbeitungspfad war nie betroffen und ist es auch
  jetzt nicht. (Geprüft, nicht angenommen — eine 480px-Vorlage im Bildeditor
  wäre ein echter Schaden gewesen.)

Formularvorschauen mit `blob:`-Adressen laufen unverändert durch:
`vorschauAdresse` gibt für alles, was keine öffentliche Speicheradresse ist,
`null` zurück, und dann wird die Adresse benutzt, wie sie ist.

## Nachgeprüft im Browser

Auf der Produktionsadresse, angemeldet, Seite `/outfits`:
**25 Bildanfragen, alle auf `vorschau/…`, alle HTTP 200, kein einziges
Original.** Bilder rendern scharf.

Beim Prüfen selbst noch ein Fallstrick: Zwei Bildschirmfotos zeigten leere
Kacheln und sahen aus wie ein Rückschritt. Sie waren mitten im Laden
aufgenommen — der Netzwerkmitschnitt und ein zweiter Blick zeigten die Bilder
vollständig. **Ein Standbild allein ist hier kein Beweis.**

## Dateien

| Datei | Was |
|-------|-----|
| `src/components/vorschaubild.tsx` | Eins-zu-eins-Ersatz für `<img>`, Quellenwechsel, `gross` |
| 46 weitere `.tsx` | `<img>` → `<Vorschaubild>` |

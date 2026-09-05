# PROJ-67: Alle übrigen Seiten auf dem beleuchteten Tisch

## Status: In Review
**Created:** 2026-09-05

## Warum

Mark am 05.09.2026: „Ja, alle anderen jetzt als Nächstes."

Acht Seiten in einem Zug: Outfits, Locations, Posen, Kamera-Assets,
Look & Grading, Sammlungen, Statistiken, Einstellungen.

**Warum in einem Zug und nicht acht Mal einzeln:** Die fünf Bausteinseiten sind
Zeile für Zeile gleich gebaut — dieselbe Kopfzeile, dasselbe Suchfeld, dieselbe
Kachel. Achtmal dieselbe Frage zu stellen hätte Mark achtmal dieselbe Antwort
gekostet.

## Was gebaut wurde

Auf jeder Seite dasselbe:

- `lichttisch.css` importiert — **ohne das tut keine der Klassen etwas**
- der beleuchtete Tisch an der Wurzel
- beide Kopfzeilen als `lt-kopf`, Titel größer
- Suchfelder und Symbolknöpfe als `lt-feld`, von 32 auf 36–40px
- die Kacheln als `lt-platte` statt `bg-card/60`

## Vier Kennfarben sind verschwunden — 153 Stellen

Jede Bausteinseite hatte ihre eigene Farbe:

| Seite | vorher | jetzt |
|---|---|---|
| Charaktere | Violett | Orange |
| Locations | Türkis | Orange |
| Posen | Purpur | Orange |
| Kamera-Assets | Himmelblau | Orange |
| Look & Grading | Magenta | Orange |

Zusammen mit den Bauteilen waren das **153 Klassen in 13 Dateien**. Das ist
genau die Buntheit, die Mark in der Seitenleiste beanstandet hat — sie war nur
auf sechs Seiten verteilt, wo sie niemandem am Stück auffiel.

Ersetzt wurde nach Bedeutung: heller Ton für Text, voller für Flächen und
Kanten, Hauptknöpfe auf `bg-primary` mit dunkler Schrift.

## Eine Kleinigkeit, die am Bild auffiel

Der Titel der schmalen Kategoriespalte passte bei 20px nicht mehr — aus
„Look & Grading" wurde „Look & Gra…". Dort stehen jetzt 17px. Das sieht man
nicht am Quelltext, nur am gerenderten Bild.

## Geprüft

- `npx tsc --noEmit` — keine neuen Fehler.
- `npx vitest run` — 601 Tests grün.
- `npm run build` — erfolgreich.
- Bildschirmfotos von vier der acht Seiten; Look & Grading mit echten Daten
  (12 Stile), die übrigen im Leerzustand, weil die Vorschau ohne Anmeldung
  keine eigenen Daten sieht.

## Offen

Die Detailspalten mit ausgewählten Einträgen habe ich nur bei Look & Grading
mit echten Daten gesehen. Formulare, Dialoge und Referenzketten haben ihre
Farben mitbekommen, ihre Formen stammen aber noch aus dem alten Bild.

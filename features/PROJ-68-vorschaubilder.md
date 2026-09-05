# PROJ-68: Vorschaubilder statt Originale

## Status: In Review
**Created:** 2026-09-05

## Warum

Mark am 05.09.2026:

> „Mir ist nur aufgefallen, dass alle Bilder immer sehr lange brauchen zu
> laden. Werden da immer die Originalbilder geladen, und wenn ja, kann man das
> irgendwie ändern?"

**Ja, wurden sie.** Im Speicher nachgemessen:

| Typ | Anzahl | Gesamt | über 2 MB | über 10 MB |
|---|---|---|---|---|
| PNG | 661 | **1709 MB** | 428 | 10 |
| JPEG | 521 | 151 MB | 12 | 1 |

Das größte PNG ist **38 MB** und brauchte im Test **35 Sekunden**. In einem
Raster mit achtzig Kacheln à 132 Pixel lud der Browser damit Hunderte Megabyte,
um Daumennägel zu zeigen.

Der Unterschied zwischen den beiden Zeilen ist der ganze Befund: **PNG.**
gpt-image-2 liefert PNG, und der Arbeiter legt es unverändert ab. Dasselbe Bild
als JPEG wäre rund ein Zehntel so groß.

## Zwei Wege, die ausgeschlossen wurden — mit Grund

**Supabases eigener Bilddienst** (`/render/image/...`) beantwortet die Anfrage
auf diesem Tarif mit **HTTP 403**. Nachgemessen, nicht vermutet.

**Vercels Bilddienst** rechnet nach verarbeiteten Quellbildern ab. Bei rund
1200 Dateien wäre das eine laufende Kostenfrage — und laufende Kosten
entscheidet Mark, nicht ich.

## Was gebaut wurde

**`worker/src/vorschaubilder.mts`** legt neben jedes Bild eine 480px breite
Vorschau unter `vorschau/<pfad>.jpg`. Der Arbeiter hat `sharp` ohnehin an Bord
und läuft auf Marks PC — das kostet nichts außer etwas Speicherplatz.

- **Es wird nichts überschrieben.** Die Vorschau liegt neben dem Original.
- **Der Lauf ist wiederholbar:** Was schon eine Vorschau hat, wird übersprungen.
  Ein Abbruch ist harmlos.
- **`.rotate()` ohne Argument** wendet die EXIF-Drehung an — sonst läge ein
  Handyfoto in der Vorschau auf der Seite.

**`src/components/vorschaubild.tsx`** benutzt sie in allen Rastern — und fällt
auf das Original zurück, wenn es sie noch nicht gibt.

**Der Rückfall ist keine Zierde:** Die Vorschauen entstehen in einem Lauf über
den ganzen Speicher, und zwischen einem neuen Bild und seiner Vorschau liegt
Zeit. Ein Raster mit Löchern wäre schlimmer als eines, das langsam lädt.

Zweistufig: erst die Vorschau, dann das Original, und **erst dann** meldet das
Bauteil einen Fehler nach oben — sonst zeichnete die Prompt-Kachel ihren
Ersatzverlauf schon, wenn nur die Vorschau fehlt.

## Zwei Dinge, die ich beim Umbau abgeschnitten hatte

Beim Ersetzen der `<img>`-Elemente sind mir zwei Eigenschaften verloren
gegangen, die keine Zeile Fehlermeldung erzeugen:

- Der **Klick auf das Bild einer Prompt-Kachel**, der den Lichtkasten öffnet.
- Der **Ersatzverlauf**, wenn ein Bild gar nicht lädt.

Beides wieder da. Es ist die Sorte Verlust, die nur auffällt, wenn man das
Bauteil danach wirklich benutzt — beim Bauen sieht man sie nicht.

## Geprüft

- `npx vitest run` — 605 Tests grün, darunter vier neue für die
  Adressumrechnung.
- **Gegenprobe:** Die Umrechnung absichtlich kaputt gemacht (den
  Zwischenspeicher-Brecher in den Dateinamen gezogen) — der zuständige Test
  wurde rot, danach wieder grün. Ein Test, der nicht rot werden kann, prüft
  nichts.
- `npm run build` — erfolgreich.
- Der erste Lauf über den kleinsten Eimer: 33 Vorschauen, aus 2,6 MB wurden
  0,7 MB.

## Offen — und es ist die größere Zahl

Die Vorschauen lösen die **Ladezeit**. Sie lösen nicht, dass **1709 MB PNG**
im Speicher liegen, wo 150 MB reichen würden. Zwei Schritte wären möglich:

1. **Neue Bilder als JPEG ablegen** statt PNG (Änderung im Arbeiter). Wirkt ab
   dem nächsten Bild, ändert nichts Bestehendes.
2. **Die 661 vorhandenen PNG umwandeln.** Das schreibt Originale um und braucht
   Marks ausdrückliche Zustimmung — auch weil ein PNG verlustfrei ist und ein
   JPEG nicht.

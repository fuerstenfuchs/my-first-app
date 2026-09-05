# PROJ-69 — Neue Ergebnisbilder als JPEG ablegen

**Status:** In Review
**Erstellt:** 2026-09-05

## Was Mark gesagt hat

> „Wir lassen die PNGs drin und nehmen aber ab jetzt JPEGs."

Zwei Anweisungen in einem Satz, und die erste ist die wichtigere:
**Bestehendes wird nicht angefasst.** Kein Umschreiben, kein Nachziehen, keine
Wanderung durch den Speicher. Nur was ab jetzt neu entsteht, entsteht als JPEG.

## Warum

Am 05.09.2026 im Speicher nachgemessen — nicht geschätzt:

| Format | Anzahl | zusammen |
|--------|-------:|---------:|
| PNG    |    661 |  1709 MB |
| JPEG   |    521 |   151 MB |

428 der PNG waren über 2 MB, zehn über 10 MB, das größte 38 MB — dieses eine
Bild brauchte 35 Sekunden zum Laden. Dasselbe Motiv wiegt als JPEG rund ein
Zehntel.

Gegenprobe an fünf echten Bildern aus `generated-images`, durch die neue
Funktion geschickt:

```
1,33 MB → 0,23 MB    1,68 → 0,23    2,00 → 0,31    2,02 → 0,31    3,08 → 0,73
zusammen 10,1 MB → 1,8 MB, Faktor 5,6, je Bild 200–390 ms
```

(Erste Messung ergab Faktor 7,4. Das war mit halbierter Farbauflösung — siehe
„Volle Farbauflösung" weiter unten. Die vollen Farben kosten rund 29 % mehr
Datei und sind es hier wert.)

Das ergänzt PROJ-68 (Vorschaubilder), ersetzt es aber nicht: Die Vorschau macht
das **Raster** schnell, das JPEG macht das **Original** klein — also den
Bildschirm, auf dem Mark ein einzelnes Bild groß ansieht, und den Speicher.

## Wie

Eine Funktion, `alsJpeg` in `worker/src/jpeg.ts`, und eine einzige Stelle, an
der sie hängt: `ergebnisAblegen` in `worker/src/supabase.ts`. Dort läuft alles
durch, was der Arbeiter ablegt — Erzeugung und Vergrößerung, beide Aufrufer in
`worker/src/abarbeiten.ts`.

### Volle Farbauflösung (4:4:4)

`sharp` halbiert die Farbauflösung standardmäßig — `jpegChromaSubsampling:
'4:2:0'`, nachgemessen in `node_modules/sharp/dist/constructor.mjs:339`. Es
gibt **keine** güteabhängige Umschaltung; die Typdatei behauptet eine ab
Güte 90, im Code steht sie nicht. Wer sich auf den Kommentar verlässt, prüft
am falschen Kanal nach.

Bei Haut und Himmel fällt das nicht auf. Bei gesättigtem Feindetail schon:
Lippenkante, Wimpern, dünne farbige Linien, Schrift. Genau solche Bilder gehen
hier als Referenz wieder hinein — deshalb `chromaSubsampling: '4:4:4'`. Der
Aufschlag ist ein knappes Drittel, der Verlust wäre dauerhaft.

**Güte 92, nicht 80.** Das sind Bilder, aus denen Mark weiterarbeitet:
Referenzen für neue Erzeugungen, Vorlagen für Vergrößerungen. Bei 92 ist der
Unterschied zum Original mit bloßem Auge nicht zu finden, die Datei aber immer
noch fünf- bis siebenmal kleiner. Wer hier heruntergeht, spart Bytes genau an
der Stelle, an der Mark sie am wenigsten sparen will.

### Fünf Fälle, in denen NICHT umgewandelt wird

1. **Das Bild benutzt Transparenz.** Der wichtigste Fall. JPEG kann keine
   Transparenz — ein freigestelltes Bild bekäme beim Umwandeln einen schwarzen
   Kasten, und zwar *lautlos*: Die Datei wäre gültig, kleiner, und niemand
   merkt es, bis Mark das Bild benutzen will.

   Entschieden wird deshalb nicht am Dateityp, sondern am INHALT.
   `sharp.stats().isOpaque` sagt, ob der Alphakanal überhaupt benutzt wird.
   Das ist nicht dasselbe wie „hat einen Alphakanal": gpt-image-2 liefert PNG
   oft mit Alphakanal, in dem alles deckend ist. Eine Prüfung auf „hat
   Alphakanal?" würde diese Bilder unnötig als PNG liegen lassen — es ist der
   Normalfall, nicht die Ausnahme.

2. **Es ist schon JPEG.** Nochmal durch die Presse zu schicken kostet Güte und
   bringt nichts.

3. **Das JPEG wäre größer.** Kommt bei Grafiken mit wenigen Farben vor — da
   ist PNG im Vorteil. Ein Tausch, der die Datei größer macht, ist ein
   schlechtes Geschäft.

4. **`sharp` wirft.** Dann wird das Original abgelegt. Ein Bild, das der
   Arbeiter schon erzeugt und bezahlt hat, darf nicht an der Umwandlung
   scheitern — **aber nicht still.** Der Fehler geht auf `console.error` und
   in das Protokoll des Auftrags.

   Das ist der teure Fall: Fällt `sharp` aus (fehlendes natives Paket nach
   einem Node-Update, Speichergrenze bei einem 8192er-Bild), geht ab sofort
   *jedes* Bild wieder als PNG hoch. Würde das Protokoll dazu schweigen, sähe
   PROJ-69 erledigt aus, während es nichts tut — und das einzige Symptom wäre,
   dass der Speicher Wochen später wieder wächst.

   Deshalb wird „wurde umgewandelt?" **nicht aus der Dateigröße geraten**,
   sondern von `alsJpeg` als eigenes Feld zurückgegeben. Aus der Größe wäre der
   Ausfall nicht vom Normalfall zu unterscheiden: in allen vier Fällen ist die
   Datei danach exakt so groß wie vorher.

5. **Es ist ein bewegtes Bild** (GIF/WebP mit mehreren Seiten). Ohne diese
   Prüfung nähme `sharp` stillschweigend nur die erste Seite. Bei den Modellen
   hier praktisch ausgeschlossen — eine Zeile schließt es trotzdem.

### Was daran noch geändert wurde

`ergebnisAblegen` gab vorher nur den Pfad zurück. Die Aufrufer protokollierten
danach `daten.byteLength` — also die Größe, die der Erzeuger geliefert hat.
Nach der Umwandlung wäre diese Zahl falsch geworden: Das Protokoll hätte
„3000 kB" gemeldet, wo 300 kB im Speicher liegen. Die Funktion gibt jetzt
`{ pfad, groesse, hinweis, umgewandelt }` zurück, und beide Aufrufer melden die
**abgelegte** Größe plus einen Satz, was passiert ist — auch dann, wenn nichts
umgewandelt wurde. Der Satz sagt dann, warum nicht.

`rotate()` ohne Argument wendet die EXIF-Drehung an und entfernt sie danach.
Ohne das läge ein gedrehtes Bild nach dem Umwandeln quer.

## Tests

`worker/src/jpeg.test.ts`, fünf Stück: der Regelfall, echte Transparenz,
deckender Alphakanal, schon-JPEG, kaputte Daten.

**Zwei Mutationen gegengeprüft**, damit die Tests nicht nur grün sind:
Transparenzprüfung ausgehebelt → der Transparenztest fällt. JPEG-Erkennung
ausgehebelt → der Doppelumwandlungs-Test fällt.

Jeder Test nagelt zusätzlich den ZWEIG fest, nicht nur das Ergebnis
(`assert.match(grund, …)`). Vier Wege führen zu „unverändert durchgereicht" —
die Zusicherung muss sagen, welcher es war, sonst deckt ein Test den anderen
Fall mit ab.

Nachgemessen zu diesem Punkt: Das Transparenz-Prüfbild ist als PNG 474 Byte, als
JPEG 361 Byte. Das JPEG ist also **kleiner** — der Größen-Rückfall greift nicht
und kann die Transparenzprüfung nicht verdecken. Sie ist wirklich tragend.

### Das Prüfbild war die eigentliche Arbeit

Beide Extreme sind falsch, und beide sind mir beim Bauen untergekommen:

* ein **gleichmäßiges Muster** presst PNG auf 8 kB; das JPEG war mit 176 kB
  größer, und `alsJpeg` behielt zu Recht das PNG — der Test fiel, obwohl die
  Regel stimmte.
* **reines Zufallsrauschen** kann umgekehrt auch JPEG nicht pressen: 158 kB
  gegen 34 kB PNG, dieselbe Ausnahme greift wieder.

Ein Foto liegt dazwischen: örtlich glatt, über die Fläche vielfältig. Das
Prüfbild ist deshalb weichgezeichnetes Rauschen. Wer hier ein bequemes
Testbild nimmt, prüft die Ausnahme statt der Regel.

## Was das NICHT tut

* **Bestehende Bilder bleiben, wie sie sind.** Ausdrücklich so gewollt.
* **Neue JPEGs haben zunächst keine Vorschau** (PROJ-68). Das Bauteil
  `Vorschaubild` fällt dann auf das Original zurück — und das Original ist
  jetzt ein 200-kB-JPEG statt eines 3-MB-PNG, der Rückfall also weit weniger
  schmerzhaft als vorher. `worker/src/vorschaubilder.mts` holt sie beim
  nächsten Lauf nach; der Lauf ist wiederholbar und überspringt, was schon da
  ist.
* **Zwei einmalige Werkzeuge bleiben unverändert** — `bilder-nachholen.mts` und
  `hintergruende-einstellen.mts` laden weiter hoch, wie sie es taten. Das sind
  Handwerkzeuge, keine laufende Erzeugung.

### Die Werkbank musste mit

Der Arbeiter ist nicht der einzige, der in `generated-images` schreibt. Die
Werkbank im Bildstudio (`src/lib/bild-werk.ts`, `src/hooks/use-bild-bearbeiten.ts`)
legt jeden Zuschnitt und jede Fassung als Leinwand-**PNG** ab — bei einem
21-Megapixel-Bild mehrere Megabyte, und das täglich. Wäre nur der Arbeiter
umgestellt, wäre Marks Satz nur zur Hälfte eingelöst und der Speicher würde
weiter wachsen, ohne dass jemand versteht, warum.

Dieselbe Regel, im Browser: Der Rohpuffer aus WebGL liegt ohnehin schon vor,
ein Durchgang über den Alphakanal sagt, ob das Bild deckend ist. Deckend →
JPEG 0,92. Durchsichtige Stellen → PNG. Ein Vier-Ecken-Warp lässt genau solche
Ecken stehen, und die würden sonst schwarz. Endung und Content-Type folgen dem
Blob, nicht einer Annahme.

## Dateien

| Datei | Was |
|-------|-----|
| `worker/src/jpeg.ts` | neu — `alsJpeg` mit den vier Ausnahmen |
| `worker/src/jpeg.test.ts` | neu — fünf Tests, zwei Mutationen gegengeprüft |
| `worker/src/supabase.ts` | `ergebnisAblegen` wandelt um, gibt `{pfad, groesse, hinweis}` |
| `worker/src/abarbeiten.ts` | beide Aufrufer melden die abgelegte Größe |
| `worker/src/einmal.ts` | druckt die echten Pfade statt `.png` nachzubauen |
| `src/lib/bild-werk.ts` | Werkbank exportiert JPEG, wenn das Bild deckend ist |
| `src/hooks/use-bild-bearbeiten.ts` | Endung und Typ folgen dem Blob |

## Was Critic gefunden hat

Vier Befunde, drei davon zutreffend und gebaut: der stille Fehlerpfad
(BLOCKER), die halbierte Farbauflösung, die tote Adresse in `einmal.ts` und der
zweite Schreibweg in der Werkbank.

Ein Befund war **sachlich falsch**: Critic vermutete, der Größen-Rückfall
verdecke die Transparenzprüfung, konnte es aber nicht messen und bat darum,
nachzumessen. Gemessen sind es 474 Byte PNG gegen 361 Byte JPEG — der Rückfall
greift nicht, und der Mutationstest hatte den Transparenztest vorher schon
fallen sehen. Die Zusicherung wurde trotzdem geschärft, weil der Nebenpunkt
stimmte: Ein Test soll den Zweig nennen, nicht nur das Ergebnis.

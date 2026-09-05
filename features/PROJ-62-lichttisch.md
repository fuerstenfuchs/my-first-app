# PROJ-62: Der Lichttisch

## Status: In Review
**Created:** 2026-09-05

## Warum

Mark am 05.09.2026:

> „Kümmern wir uns mal um den Lichttisch. Da geht grafisch bestimmt auch noch
> viel mehr. […] Oben, wo man auswählen kann, welche Bilder angezeigt werden.
> So kleine Schrift im Allgemeinen gar nicht so gut. […] Man sieht das Fenster
> ja auch gar nicht, das Prompt-Fenster, das soll sich deutlich abheben. Auch
> das andere Prompt-Fenster darunter vom Prompt-Assistenten."

Alle vier Punkte waren **messbar**, nicht Geschmack:

| Was er sagte | Was gemessen wurde |
|---|---|
| Filterzeile oben | 11px, fünf lose Wörter ohne Form |
| Schrift zu klein | **39 Stellen** unter 13px |
| „Man sieht das Fenster gar nicht" | Rahmen hebt sich **1,23-fach** vom Grund ab; WCAG 1.4.11 verlangt 3-fach |
| Das zweite Fenster ebenso | Der Assistent ist zugeklappt — das Feld existiert im Seitenaufbau gar nicht |

Die schlimmsten Kleinschriften waren nicht die naheliegenden:
- Der **Preis** einer kostenpflichtigen KI-Vergrößerung stand in 10px.
- Der **einzige** Hinweis auf Ziehen und Strg+V stand in 9px bei 3,78:1.
- Die Bildunterschrift (10px, abgeschnitten) trägt das `✎`-Zeichen, dessen
  Zweck ausdrücklich ist, das Löschen der falschen Fassung zu verhindern.

## Wie entschieden wurde

Zuerst fünf Richtungen als anfassbares HTML. Critic prüfte sie und fand drei
Dinge, die den Bogen wertlos gemacht hätten: eine Richtung mit weißer Schrift
auf hellem Orange (2,38:1), Filter mit der falschen Beschriftung („Offen" statt
„Noch nicht abgelegt", dadurch alle Zeilen 50 % zu schmal) und zwei Richtungen,
die den Zieh-Hinweis stillschweigend gelöscht hatten — Inhaltsverlust, als
Gestaltung getarnt. Dazu die größte Lücke: **die Bildfläche fehlte in allen
fünf**, obwohl sie der eigentliche Lichttisch ist.

Korrigiert, auf drei gekürzt, neu vorgelegt. Dann schickte Mark **einen eigenen
Entwurf**: eine dunkle Platte, über die schräges Licht fällt, mit
halbdurchsichtigen Scheiben darauf. Den habe ich als anfassbares Muster
nachgebaut (mit Hover, Klappe, Zuständen); er hat ihn abgenommen und nur das
Licht abgemindert — aus drei Stufen die mittlere.

## Was gebaut wurde

**`bildstudio/lichttisch.css` (neu)** trägt die ganze Gestalt:

- **Die Platte** mit dem schrägen Licht. Es liegt **unter** allem und scheint
  durch die halbdurchsichtigen Flächen hindurch — deshalb wirken Fenster und
  Knöpfe wie Glas auf einer beleuchteten Fläche und nicht wie Kästen vor einem
  Hintergrundbild. Die Stärke hängt an **fünf Werten an einer Stelle**.
- **`.lt-platte`** steht über der Fläche (Lichtkante oben),
  **`.lt-fenster`** versinkt darin (Schatten nach innen).
  Zwei entgegengesetzte Stufen um dieselbe Kontur — das liest das Auge als
  Fenster. Ein einzelner Rahmen kann das auf Schwarz nicht leisten, und genau
  daran ist der alte Zustand gescheitert.
- **`.lt-filter`**, **`.lt-feld`**, **`.lt-wahl`**, **`.lt-haupt`**,
  **`.lt-kachel`** — alle mit Zeigerzustand, alle mit `:focus-visible`.
- **Die Schriftgrößen von außen angehoben**, wie im Scene Builder: eine Regel
  statt 39 Einzeländerungen.

**Größen:** Titel 14 → 20px, Filter 11 → 14,5px, alles übrige auf 13–16px.
Zwei Ausnahmen mit Grund: die Marke „abgelegt" sitzt **auf** dem Bild und bleibt
klein (`.lt-mini`); Menüs hängen im Portal am `<body>`, also außerhalb von `.lt`,
und tragen deshalb `lt-menue`.

**Die Bildkacheln** sind mitgezogen. Sie hatten denselben unsichtbaren Rahmen
wie das Prompt-Fenster, nur noch schwächer. Wer das Fenster löst und die Kacheln
nicht, verschiebt den Befund nur — und die Kacheln **sind** der Lichttisch.

## Das Orange ist dunkler als in Marks Entwurf

Sein Bild hatte weiße Schrift auf hellem Orange. Nachgerechnet: auf `#e8721b`
kommt Weiß auf **3,06:1**, auf `#f97316` sogar nur auf 2,4 — gefordert sind 4,5.

**Ich habe ihm dazu zuerst etwas Falsches geschrieben:** dass meine Fassung
bereits darüber liege. Der hellste Punkt meines eigenen Verlaufs lag ebenfalls
bei 3,06. Der Verlauf liegt jetzt vollständig im sicheren Bereich (`#c2540b` =
4,60 bis `#a03c07` = 6,44). Wer ihn aufhellt, muss gegen den **hellsten** Punkt
rechnen, nicht gegen den Mittelwert.

## Ein Messfehler von mir, der im Quelltext steht

Ein Bildschirmfoto bei „420px" zeigte die Arbeiter-Ampel rechts aus dem Bild
laufend. Das war kein Fehler der Seite: Der kopflose Browser rendert nicht
schmaler als 500px — das Bild war in Wahrheit 500 breit und nur beschnitten. Im
echten Browser bei 375px steht nichts über, nachgemessen. Der Umbruch-Kasten,
den ich daraufhin gebaut hatte, bleibt trotzdem: Bei „Arbeiter zuletzt vor 14
Minuten" wird der Text länger, und dann trägt er.

## Nachtrag noch am selben Tag: das Licht war weg

Mark, nachdem er die ausgelieferte Fassung gesehen hatte:

> „Da wurde noch was vergessen mit der schwarzen Fläche."
> „Oh, was ich noch sehe, der Lichteffekt ist ja gar nicht da. Das Schräglicht."

Beides war **derselbe Fehler**, und er steckte in einer Eigenschaft von
CSS-Verläufen, die man leicht übersieht:

Die Haltepunkte der vier Strahlen sind **Prozentwerte**. Sie beziehen sich auf
die Länge der Verlaufslinie — und die wächst mit dem Element. Auf dem Muster,
das Mark abgenommen hat, war die Fläche 886px breit: vier klare Bänder. In der
echten App ist sie 1500px und mehr. Dieselben vier Bänder wurden über die ganze
Breite gezogen, jedes fast doppelt so breit — und dadurch so flach, dass große
Bereiche einfach dunkel aussahen. Genau die „schwarze Fläche".

Behoben mit `background-size: 940px 100%` und `repeat-x`: Das Muster behält die
Größe, die er gewählt hat, unabhängig von der Fensterbreite. Die Kacheln stoßen
an durchsichtigen Rändern aneinander, deshalb gibt es keine Naht.

**Gemessen statt geschätzt:** Auf einem waagerechten Schnitt bei y=700 lagen die
Helligkeitswerte vorher zwischen 29 und 38 — praktisch flach. Danach zwischen 29
und 60.

**Die Lehre für das nächste Mal:** Ein Muster, das an einem Entwurf fester Breite
abgenommen wurde, muss beim Einbau eine feste Größe bekommen. Sonst gilt die
Abnahme für eine Breite, die es in der App nie gibt.

## Was die Prüfung der gebauten Fassung ergab

Ein Blocker und vier schwere Funde, alle behoben:

**1. Der Ziehzustand war unsichtbar — lautlos.**
`ueberzogen && 'border-primary bg-primary/10'` stand als Tailwind-Klassen am
Element. Die wiegen genau so viel wie `.lt-ablage`, und dieses Stilblatt wird
später geladen — die Kurzformen `border` und `background` gewannen. Beim Ziehen
eines Bildes änderte sich also **nichts am Bild**, obwohl der Zustand im
Seitenaufbau stand. Der einzige Rückmeldeweg für „hier darf abgeworfen werden"
war tot. Steht jetzt als `[data-ueber='ja']` dort, wo die Gestalt steht — und
die gestrichelte Kontur ist von dem Knopf auf die Abwurffläche zurückgewandert,
wo sie hingehört.

**2. Marks Orange kommt zurück — mit dunkler Schrift.**
Ich hatte sein Orange abgedunkelt, damit *weiße* Schrift 4,5:1 schafft. Das ging
im Ruhezustand auf (4,60) — aber beim Zeigen hebt `brightness(1.07)` den
hellsten Punkt auf **4,09**, der Knopf fiel also genau dann durch, wenn man ihn
anfasst. Und der Preis war hoch: aus seinem Orange war Rostbraun geworden.
Mit **dunkler Schrift auf seinem eigenen Orange** sind es 5,05 bis 7,75 und nach
dem Aufhellen immer noch 6,91. Sein Bild bleibt, der Wert stimmt in jedem
Zustand. Den Tausch hatte ich beim ersten Mal schlicht nicht gesehen.

**3. Drei Fokuszustände fehlten oder waren zu schwach.**
Der aktive Filter verlor seinen Tastaturfokus an die später stehende
Aktiv-Regel (übrig blieb ein Pixel Versatz — und „Alle" ist der erste Tabstopp
der Seite). Der Fokusring der Bildkacheln wurde vom eigenen `overflow-hidden`
weggeschnitten, die Hauptaktion jeder Kachel hatte also gar keine Markierung.
Und der Ring des Prompt-Fensters war mit 1,19:1 **schwächer als der, den er
ersetzt hatte**.

**4. Kanten und Beschriftungen waren gegen die dunkle Platte gewählt.**
Unter einem Lichtstreifen kam die Hinweiszeile auf 3,67:1 und die
Bildunterschrift auf 3,74:1 — beide unter der Schwelle, und ausgerechnet dort,
wo das Licht am schönsten ist. Der Grund ist ein Verlauf: Es gibt keinen einen
Hintergrundwert. Die vier Werte sind jetzt gegen die **hellste** Stelle gewählt.

**5. Die Kachel wird von zwei Seiten benutzt.**
`ergebnis-kachel.tsx` trägt seit dem Umbau `lt-kachel`; das Stilblatt hing aber
nur am Lichttisch. In der Warteschlange war die Kachel dadurch ohne Rahmen,
Rundung und Schatten — und je nachdem, ob man von dort herkam oder frisch lud,
verschieden. Das Stilblatt ist jetzt auch dort eingebunden. Die Zeile „Nicht
angefasst: die Warteschlange" in der ersten Fassung dieser Spezifikation war
falsch.

**6. Die größte Bewegung der Seite war von `prefers-reduced-motion` nicht
erfasst:** Jedes Bild im Raster wächst beim Überfahren — bei dreißig sichtbaren
Kacheln mehr Bewegung als alles andere zusammen.

## Der Assistent steht jetzt offen — und sein Feld war noch schwarz

Mark am 05.09.2026, nach der Rückfrage:

> „Du kannst die Fläche schon gerne offen stehen lassen, den Prompt-Assistent.
> Man muss ja nach unten scrollen beziehungsweise passt das schon. Aber die
> Fläche ist immer noch schwarz, da wo man den Prompttext eingibt vom
> Prompt-Assistent. Hast Du die nicht geändert?"

**Nein, hatte ich nicht.** Ich hatte beim Umbau die Antwortblöcke des
Assistenten auf `.lt-fenster` gestellt und sein **eigenes Eingabefeld**
übersehen. Es behielt `bg-background` — fast Schwarz — mitten auf der
beleuchteten Platte. Das war der Rest der schwarzen Fläche, und er hat ihn
genauer gesehen als ich.

Damit ist der vierte seiner ursprünglichen Sätze wirklich beantwortet: Der
Assistent steht offen (`useState(true)`), sein Feld ist dasselbe Fenster wie
oben im Erzeugen-Block, und die beiden Knöpfe darunter sprechen dieselbe
Sprache wie der Rest. Sein früherer Einwand, die Spalte verbrauche zu viel
Höhe, ist von ihm selbst aufgehoben — die Klappe bleibt trotzdem.

## Geprüft

- `npx tsc --noEmit` — keine neuen Fehler.
- `npx vitest run` — 601 Tests, alle grün.
- `npm run build` — erfolgreich.
- Bildschirmfoto der echten Seite, breit und schmal.
- Im Browser gemessen: bei 375px Fensterbreite steht **kein** Element über.

## Nicht angefasst

Funktion, Reihenfolge, Filterlogik, die Warteschlange, die Werkbank. Der Auftrag
war das Aussehen.

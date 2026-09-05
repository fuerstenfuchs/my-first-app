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

## Geprüft

- `npx tsc --noEmit` — keine neuen Fehler.
- `npx vitest run` — 601 Tests, alle grün.
- `npm run build` — erfolgreich.
- Bildschirmfoto der echten Seite, breit und schmal.
- Im Browser gemessen: bei 375px Fensterbreite steht **kein** Element über.

## Nicht angefasst

Funktion, Reihenfolge, Filterlogik, die Warteschlange, die Werkbank. Der Auftrag
war das Aussehen.

# PROJ-58: Bescheid sagen, wenn ein Bild fertig ist

## Status: In Review
**Created:** 2026-09-04

## Warum

Mark am 04.09.2026:

> „Auf der Webseite, wenn ich Bilder generieren lasse, bekomme ich leider
> nirgendwo eine Meldung, dass das Bild fertig ist. Kann man das irgendwie
> ändern oder auffällig machen, dass irgendwas mich darauf aufmerksam macht,
> dass das Bild fertig ist?"

An der Datei nachgemessen — es gab **nichts**, was ihn hätte benachrichtigen
können:

- Die Seiten, auf denen er Bilder **startet**, rufen `useImageJobs(false)` und
  fragen den Stand gar nicht ab: Scene Builder (`queue-button.tsx`,
  `reihe-button.tsx`), freie Erzeugung, Prompt→Bild.
- Nur `/queue` und `/bildstudio` fragen alle fünf Sekunden nach — und auch die
  **melden nichts**, wenn ein Auftrag fertig wird. Sie zeichnen bloß neu.

Ein Bild braucht ein bis drei Minuten. In der Zeit ist Mark woanders, und wenn
er zurückkommt, weiß er nicht, ob etwas passiert ist. Genau wie beim stummen
Arbeiter (PROJ-57): **Fertig sieht aus wie noch nicht fertig.**

## Was gebaut wurde

### Die Entscheidung: `src/lib/fertig-melden.ts`

Reine Logik, ohne React, mit 17 Tests.

**Der springende Punkt ist das Wort „geworden".** Gemeldet wird nur ein
ÜBERGANG — ein Auftrag, den wir vorher unterwegs gesehen haben und der jetzt
fertig ist. Wer beim Seitenaufruf einfach alle fertigen Aufträge meldet,
überschüttet Mark bei jedem Laden mit Meldungen über Bilder von gestern; nach
zweimal schaut er nicht mehr hin, und dann ist das Feature schlechter als
keines. Ein Auftrag, den wir zum ersten Mal sehen, ist die **Grundlinie**, kein
Ereignis.

Fehlschläge werden mitgemeldet und nicht verschwiegen — dort wartet man am
längsten vergeblich.

### Der Wächter: `src/hooks/use-fertig-wache.ts`, im Layout

**Er hängt im Layout, nicht auf einer Seite.** Ein Wächter auf `/queue` hätte
nur dem geholfen, der ohnehin schon hinschaut — also genau dem, der ihn nicht
braucht. Abgesichert durch einen Verdrahtungs-Wächter in `layout.test.ts`,
demselben Muster, das schon Quick Capture schützt: Gegenprobe gemacht, der
Aufruf auskommentiert, Test wird rot.

Vier Wege, absichtlich gestaffelt:

| Weg | Wann | Erlaubnis nötig |
|---|---|---|
| **Reiter-Titel** `(2) Bilder fertig · Prompt Trésor` | immer, aber nur während Mark woanders ist | nein |
| **Einblendung** mit Vorschaubild, 12 Sekunden, Knopf „Ansehen" | immer | nein |
| **Betriebssystem-Meldung** | nach Freischaltung | ja, einmalig |
| **Kurzer Ton** | nach Freischaltung | nein |

Die ersten beiden sind immer an, weil sie niemanden stören. Die anderen beiden
schaltet Mark in den Einstellungen frei.

### Drei Entscheidungen mit Begründung

**Der Reiter-Titel zählt nur hoch, wenn der Reiter im Hintergrund ist.** Wer
gerade hinschaut, braucht keinen Zähler, der sofort wieder verschwindet. Beim
Zurückkehren wird er zurückgesetzt.

**Der Ton wird erzeugt, nicht abgespielt.** Zwei Sinustöne über die WebAudio-
Schnittstelle statt einer Tondatei: Eine Datei wäre ein weiteres Stück im
Auslieferpaket, das erst geladen werden muss, bevor es klingeln kann —
ausgerechnet dann, wenn die Verbindung schlecht ist.

**Die Erlaubnis wird am Schalter erfragt, nicht im Wächter.** Browser lehnen
die Frage ab, wenn sie nicht aus einer Benutzerhandlung kommt. Deshalb steht
`meldungErlaubnisHolen()` am Schalter in den Einstellungen. Wird sie
verweigert, sagt die Karte auch, dass das nur noch in den Website-Einstellungen
des Browsers rückgängig zu machen ist.

**Ein Netzaussetzer setzt den Stand nicht zurück.** Sonst gälte beim nächsten
Durchgang alles wieder als „erstmals gesehen", und die Grundlinie begänne von
vorn — mit einer Flut von Meldungen als Folge.

### Geprüft

558 Tests grün (vorher 539), `tsc` sauber bis auf die zwei bekannten
Altlasten, Build übersetzt. Gegenprobe am Verdrahtungs-Wächter gemacht.

**Im Browser nicht nachgemessen** — die App liegt hinter der Anmeldung. Was
Mark beim ersten Versuch prüfen sollte: dass beim Öffnen der Seite **keine**
Meldung über alte Bilder kommt. Das ist die Stelle, an der so etwas
üblicherweise schiefgeht.

## Nicht gebaut

- **Kein Push aufs Handy.** Das bräuchte einen Service Worker mit
  Push-Anmeldung und einen Dienst, der die Nachricht zustellt — ein eigenes
  Vorhaben. Die Betriebssystem-Meldung erreicht den Rechner, an dem Mark
  ohnehin sitzt.
- **Keine Realtime-Verbindung.** Der Wächter fragt alle fünf Sekunden nach,
  wie `useImageJobs` es schon tut. Eine dauerhafte Verbindung wäre sparsamer,
  aber sie brächte einen zweiten Fehlerfall (Verbindung bricht ab, niemand
  merkt es) in ein Feature, dessen ganzer Zweck das Melden ist.

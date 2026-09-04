# PROJ-57: Stillstand des Arbeiters sichtbar machen

## Status: In Review
**Created:** 2026-09-04

## Warum

Am 04.09.2026 um 17:40 fror der Arbeiter ein. Er hielt einen Auftrag fest,
meldete sich nicht mehr, und zwei später eingereihte Aufträge blieben liegen.
Aufgefallen ist es **fast zwei Stunden später**, und auch nur, weil Mark von
sich aus fragte: „Kannst Du bitte mal schauen, ob der Proxy läuft? und die
Arbeiter auch arbeiten."

Nachgemessen: letztes Lebenszeichen **17:40:02** — die Sekunde, in der er den
Auftrag holte. Er schreibt sonst alle 20 Sekunden eines. 2,95 Sekunden
Rechenzeit in 406 Minuten Laufzeit: Der Prozess lebte, wartete aber auf etwas,
das nie kam.

**Die Anzeige dafür gab es längst.** Seit PROJ-41 steht im Kopf der
Warteschlange eine Ampel, und sie zeigte an diesem Abend das Richtige:
„Arbeiter zuletzt vor 2 Stunden", in Gelb. Sie hat trotzdem nichts bewirkt.
Drei Gründe:

1. **Zu leise.** Ein 10px-Abzeichen im Kopf, neben der Überschrift. Wer auf
   die Auftragsliste schaut, sieht es nicht.
2. **Sie sagte das Falsche.** Der Hinweistext lautete „Starte den Arbeiter auf
   dem PC" — der Arbeiter *lief* aber. Wer liest, er solle starten, was schon
   läuft, hält die Meldung für falsch und übergeht sie. Ein hängender Arbeiter
   ist etwas anderes als ein ausgeschalteter.
3. **Sie verknüpfte nichts.** Ein stummer Arbeiter ohne Aufträge ist ein
   ausgeschalteter PC, also belanglos. Derselbe stumme Arbeiter, während drei
   Aufträge warten, ist Stillstand. **Beides sah gleich aus.**

Das ist derselbe Fehlermodus wie beim Auftragsmappen-Wächter im FUCHS FILM
STUDIO, und aus demselben Grund teuer: **Stillstand sieht aus wie Geduld.**

## Was gebaut wurde

`src/lib/arbeiter-lage.ts` — keine Ampel, sondern eine Lagebeurteilung. Sie
bekommt den Arbeiterzustand **und** die Warteschlange und entscheidet daraus,
wie laut zu sein ist:

| Lage | Wann | Wie |
|---|---|---|
| **Der Arbeiter hängt** | stumm, hält aber einen Auftrag auf „in Arbeit" | Alarm, rot |
| **Der Arbeiter ist stumm** | stumm, Aufträge warten | Alarm, rot |
| **Der Arbeiter läuft nicht** | noch nie gemeldet, Aufträge warten | Alarm, rot |
| **Arbeiter ist aus** | stumm, aber nichts wartet | Hinweis, gelb |
| **Auftrag dauert ungewöhnlich lange** | meldet sich, aber ein Auftrag läuft > 20 Min | Hinweis, gelb |
| still | alles andere, **und bei unbekanntem Zustand** | nichts |

Der erste Fall ist der vom 04.09.2026, und er nennt jetzt den Grund statt
einer falschen Anweisung: „Ein Auftrag steht auf ‚in Arbeit', aber der
Arbeiter meldet sich seit 1 Std 52 Min nicht. Er läuft vielleicht noch, kommt
aber nicht weiter — beenden und neu starten."

In der Warteschlange steht das als **Kasten über der Auftragsliste**, nicht
als Abzeichen im Kopf. Das Abzeichen bleibt, wird bei Alarm aber rot und
pulsiert.

### Zwei Entscheidungen mit Begründung

**Bei `unbekannt` wird geschwiegen.** Ein Netzaussetzer beim Lesen des Status
ist keine Nachricht über den Arbeiter. Wer bei jedem Aussetzer Alarm schlägt,
bekommt einen Alarm, den man wegklickt.

**Die 20-Minuten-Schwelle für Langläufer ist begründet, nicht geraten:** Die
Zeitgrenze je Bild ist `REQUEST_TIMEOUT_MS` = 300 Sekunden, dazu kommen
Ablegen und bis zu drei Anläufe. Fünf Minuten sind völlig normal und dürfen
nicht warnen.

**Die Dauer des laufenden Auftrags rechnet der Browser**, anders als
`sekunden_her`, das die Datenbank rechnet. Das ist Absicht: Dort entscheidet
eine 60-Sekunden-Grenze, und die PC-Uhr wich am 01.09.2026 um 34 Sekunden ab —
genug, um „läuft" in „weg" zu drehen. Hier geht es um 20 Minuten; eine halbe
Minute Abweichung spielt keine Rolle.

### Geprüft

12 neue Tests, 539 insgesamt grün (vorher 527). Gegenprobe: den Hänger-Fall
ausgebaut → genau die zwei Tests rot, die ihn prüfen; danach wieder grün.

**Im Browser nicht nachgemessen** — die Warteschlange liegt hinter der
Anmeldung. Der Zustand steht aber gerade wirklich an: drei Aufträge warten,
der Arbeiter ist stumm. Der Kasten ist also beim nächsten Öffnen sofort zu
sehen.

## Nicht behoben

**Warum der Arbeiter überhaupt einfriert, ist offen.** Ein HTTP 429 allein
erklärt es nicht: Der Proxy-Aufruf hat 300 Sekunden Zeitgrenze, und die
Fehlerbehandlung in `worker/src/index.ts:53-84` hätte den Auftrag danach
zurückgestellt. Beides ist nicht passiert. Es gibt also einen Weg, auf dem der
Arbeiter hängt, ohne dass eine der eingebauten Fristen greift. Steht in
`features/OFFEN.md`.

Dieses Feature macht den Stillstand **sichtbar**, es verhindert ihn nicht.

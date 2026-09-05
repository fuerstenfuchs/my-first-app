# PROJ-65: Die Warteschlange auf dem beleuchteten Tisch

## Status: In Review
**Created:** 2026-09-05

## Warum

Mark am 05.09.2026:

> „Als Nächstes können wir noch die Warteschlange in unserem neuen Design
> machen, also mit dem Blau und Licht und so weiter."

Kein neuer Entwurf nötig — die Sprache steht seit PROJ-62 fest. Hier wird sie
angewandt.

**Vorher gemessen:** 18 Stellen unter 13px, darunter die Arbeiter-Ampel (10px),
die Uhrzeit und die Auftragsdaten (11px) und der Prompt selbst (12px). Die
Auftragskarten waren `rounded-lg` mit `border-border/60` — dieselbe kaum
sichtbare Kante wie überall vor dem Umbau.

## Was gebaut wurde

- **Die ganze Seite steht auf dem beleuchteten Tisch** (`lt` an der Wurzel).
- **Kopfzeile** als `lt-kopf`, Titel von 14 auf 20px, die Arbeiter-Ampel als
  Pille mit 13px statt eines 10px-Abzeichens.
- **Auftragskarten** als `lt-platte` — Lichtkante oben, Schatten darunter.
  Bewusst **nicht** `lt-kachel`: Die Karte ist kein Knopf, sie hebt sich beim
  Zeigen nicht an, sie klappt nur auf.
- **Alle Schriftgrößen** ziehen automatisch nach: Die Regel in `lichttisch.css`
  hebt 9–12px auf 13px. Dafür musste sie um `text-[12px]` erweitert werden —
  die Warteschlange war die erste Seite, die diese Größe benutzt.
- **Knöpfe** in Marks Orange mit dunkler Schrift und Sockel.

## `lt` steht hier an der Wurzel — und das ist geprüft

Auf der Prompt-Seite hat genau dieser Griff den rollenden Bereich zerlegt, weil
dessen `absolute` verloren ging. Hier ist **kein direktes Kind positioniert**,
deshalb ist es gefahrlos. Seit dem Fehler von heute Mittag greift die Regel
ohnehin nur noch bei Elementen ohne eigene Positionierung — aber nachgesehen
wurde trotzdem.

## Geprüft

- `npx tsc --noEmit` — keine neuen Fehler.
- `npx vitest run` — 601 Tests grün.
- `npm run build` — erfolgreich.
- Bildschirmfoto der echten Seite (Leerzustand, weil die Vorschau ohne
  Anmeldung keine Aufträge sieht).

## Offen

Die Auftragskarten mit echten Daten habe ich nicht gesehen — die Vorschau ohne
Anmeldung zeigt nur den Leerzustand. Wenn an einer Karte etwas klemmt, ist es
dort.

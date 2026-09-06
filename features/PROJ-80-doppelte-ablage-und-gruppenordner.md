# PROJ-80 — Doppelte Ablage behoben, Gruppen als eigener Abschnitt

**Status:** In Review
**Erstellt:** 2026-09-06

## Der Fehler

> „Das Gruppenbild wurde aber irgendwie zweimal abgelegt."

Nachgemessen in der Datenbank, nicht am Bildschirm geraten:

```
Auftrag:  1  ·  Ergebnispfade: 1  ·  abgelegt: true
Bilder im Ordner „Gruppenbild": 2
  15:00:06.183   …1788706812557-y5h3ly.jpg
  15:00:09.178   …1788706814466-fgh8nq.jpg
```

**Ein Auftrag, ein Ergebnis, zwei Bilder — drei Sekunden auseinander.**

## Warum — meine eigene Sperre, genau andersherum

Der Wächter legt ab und schreibt **erst danach** die Marke `abgelegt`. Ein
zweiter Durchgang, der seine Auftragszeilen **vor** dieser Marke geholt hat,
sieht den Auftrag weiter als offen.

In genau diesem Fenster ist die Sperre im Arbeitsspeicher der einzige Schutz.
Und die hob ich **nach dem Erfolg** wieder auf:

```ts
// vorher — falsch
for (const a of erledigt) laufend.current.delete(a.jobId)
```

Damit fiel der Schutz in dem Moment, in dem er gebraucht wurde. Schlimmer: Der
Kommentar daneben begründete es auch noch — „nur die erfolgreichen freigeben".
Ein Satz, der plausibel klingt und das Gegenteil des Richtigen sagt.

**Richtig ist:** Was abgelegt *ist*, bleibt für die Sitzung gesperrt — die
Marke in der Datenbank übernimmt danach. Was **nicht** durchkam, wird
freigegeben und beim nächsten Takt erneut versucht.

Die Regel steht jetzt als geprüftes Stück `freizugeben()` in
`ablage-auftrag.ts` statt nur im Hook. **Eine Mutation, die den Originalfehler
wieder einbaut, wird von drei Tests gefangen.**

## Die Mitursache — der Takt lief viel zu schnell

`createClient()` liefert bei jedem Aufruf ein neues Objekt. Es stand direkt im
Rumpf beider Wächter, war also bei jedem Rendern neu. Damit war auch die
Ablagefunktion neu, damit `pruefen`, und dessen Effekt baute sich bei jedem
Rendern ab und wieder auf — **mit einem sofortigen `pruefen()` je Mal.**

Aus einem Takt von fünf Sekunden wurde ein Takt von „jedes Rendern". Das
Zeitfenster aus dem Abschnitt oben wurde dadurch nicht gelegentlich getroffen,
sondern ständig. Beide Wächter halten den Client jetzt über `useMemo` stabil.

Zwei Fehler, die einzeln kaum aufgefallen wären und zusammen zuverlässig
doppelt ablegen.

## Gruppen stehen für sich

> „Sollte man nicht doch einen Ordner machen, nur mit Gruppenbildern, bei den
> Charakteren."

Gebaut, aber **getrennt angezeigt, nicht getrennt gespeichert**: ein eigener
Abschnitt mit Überschrift „Gruppen" unten in der Liste, durch eine Linie
abgesetzt.

Eine Gruppe bleibt damit ein gewöhnlicher Charakter und taucht weiter überall
auf, wo man einen wählen kann — Scene Builder, Shooting-Kette, Referenzrolle.
Ein eigener Datenbereich hätte dieselbe Ansicht gebracht und an jeder
Auswahlstelle Nacharbeit gekostet.

Die Listenzeile ist dafür in eine Funktion ausgelagert und wird von beiden
Abschnitten benutzt — zwei Kopien wären beim nächsten Umbau auseinander
gelaufen.

## Was das erste Blatt gezeigt hat

Die Kopfreihe aus PROJ-79 trägt: Die Gesichter sind groß genug, um als
Identitätsreferenz zu dienen, jede Person trägt ihr eigenes Kleidungsstück,
kein Vertauschen. Damit ist die Grundlage für eine Gruppen-Shooting-Kette
belegt.

## Offen

Das doppelte Bild liegt noch in Marks Ordner. Löschen ist ein Eingriff in seine
Daten — es wartet auf sein Wort.

## Dateien

| Datei | Was |
|-------|-----|
| `src/lib/ablage-auftrag.ts` | `freizugeben()` — die Regel, geprüft |
| `src/lib/ablage-auftrag.test.ts` | 15 Tests, Mutation des Originalfehlers |
| `src/hooks/use-ablage-wache.ts` | Sperre richtig herum, Client stabil |
| `src/hooks/use-fertig-wache.ts` | Client stabil |
| `src/app/(app)/characters/page.tsx` | Abschnitt „Gruppen", Zeile ausgelagert |

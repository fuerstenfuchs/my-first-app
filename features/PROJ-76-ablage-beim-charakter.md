# PROJ-76 — Fertige Bilder landen von selbst beim Charakter

**Status:** In Review
**Erstellt:** 2026-09-06

## Was Mark gesagt hat

> „Was jetzt natürlich noch gut ist, weil ich ja dann immer mehrere Bilder von
> jemandem habe, dass diese auch direkt bei dem Charakter landen im Ordner
> Sonstiges. Ich musste jetzt alle Bilder einzeln dorthin verschieben. Ist
> natürlich, wenn man wirklich mal mehrere hat, nicht so hilfreich."

Fünf Bilder je Shooting, jedes von Hand in denselben Ordner geschoben — genau
die Arbeit, die eine Kette einsparen soll und die sie stattdessen erzeugt hat.

Er nannte selbst beide Wege: *„Wenn man weiß, wo der Charakter herkommt, dann
kann man es ja da auch wieder reinverschieben. Oder man kann vorher wirklich
den Ordner einmalig angeben."* Beide sind gebaut — der Charakter kommt aus der
Szene, der Ordner steht eine Zeile darunter.

## Die Ablage steht im Auftrag, nicht im Bild

Wer beim Erzeugen weiß, wohin es soll, schreibt es in `scene_meta`. Der Wächter
liest es später aus. So braucht niemand zu raten, woher ein Bild kam, und die
Zuordnung überlebt jeden Neustart.

## Warum ein neuer Ordner mit dem Namen des Ortes — und nicht „Sonstiges"

Mark hat „Sonstiges" genannt. Vorbelegt ist trotzdem ein **neuer Ordner mit dem
Namen des Ortes**, und zwar aus einem Grund, nicht aus Eigensinn: Fünf Bilder
aus einem Shooting gehören zusammen. In „Sonstiges" liegen sie nach dem dritten
Shooting zu fünfzehnt ohne erkennbare Grenze — die Sortierarbeit wäre nur
verschoben, nicht erspart. „Hamburger Speicherstadt" sagt beim Hinsehen, was
drin ist.

„Sonstiges" steht in derselben Liste, ebenso jeder andere vorhandene Ordner und
„Nicht ablegen — nur in der Warteschlange".

**Der Ordner entsteht erst beim Erzeugen.** Wäre er beim Öffnen des Wählers
entstanden, bliebe bei jedem Blick auf den Knopf ein leerer Ordner am Charakter
zurück — auch wenn Mark es sich anders überlegt.

## Warum im Browser und nicht im Arbeiter

Das Kopieren in einen Charakterordner ist mehr als eine Datei zu verschieben:
Größenprüfung, Ablagepfad, Datenbankzeile, Sortierung. Das steht alles in
`useBildUebernehmen` und ist dort geprüft. Der Arbeiter kennt weder Charaktere
noch Varianten; ihm das beizubringen hieße, dieselbe Logik ein zweites Mal zu
schreiben — und beim nächsten Umbau liefe eine der beiden Fassungen der anderen
hinterher.

**Der Preis, ehrlich:** Es geschieht nur, solange die App offen ist. Wer den
Rechner zuklappt, während das Shooting läuft, findet die Bilder beim nächsten
Öffnen — sie werden dann nachgeholt.

## Der Fehler, der hier beinahe eingebaut worden wäre

Naheliegend wäre gewesen, an den fertigen Meldewächter (PROJ-58) anzuknüpfen:
Er läuft ohnehin, alle fünf Sekunden, und weiß, was gerade fertig geworden ist.

Aber `neuFertige` arbeitet mit einer **Grundlinie** — es liefert nur, was sich
seit dem letzten Blick geändert hat. Nach einem Neuladen der Seite gilt alles
Vorhandene als „schon gesehen". Für eine Meldung ist das richtig (niemand will
beim Öffnen zwanzig alte Hinweise). Fürs Ablegen wäre es fatal: **Wer das
Fenster schließt, während das letzte Bild läuft, fände es danach nie im
Ordner.**

Deshalb liest `zuAblegen` über **alle** geholten Aufträge, und das Merkmal ist
die Marke `abgelegt` am Auftrag selbst — nicht die Erinnerung des Wächters.

Zwei weitere Fallen, beide im Code begründet:

* **Die Marke erst, wenn alle Bilder eines Auftrags durch sind.** Wer sie nach
  dem ersten setzt, verliert die übrigen still.
* **Was gerade läuft, darf nicht noch einmal anfangen.** Der Wächter schaut
  alle fünf Sekunden; ein Kopiervorgang über fünf Bilder dauert länger. Ohne
  Sperre begänne der nächste Takt dieselbe Ablage — doppelte Bilder im Ordner.

## Tests

12 in `ablage-auftrag.test.ts`. **Drei Mutationen gegengeprüft:**
Doppelablage-Schutz entfernt, Szene beim Markieren überschrieben, unfertige
Aufträge abgelegt. Alle drei fangen.

Besonders geprüft: dass `abgelegtMarke` die übrige Szene **behält**. Wer dort
ersetzt statt mischt, löscht Licht, Kamera und die Kettenkennung — und
Lichttisch wie Warteschlange lesen daraus.

## Im Browser geprüft

Location → „Shooting" → Charakter gewählt: Die Zeile „Fertige Bilder ablegen
bei Günther Siegle" erscheint, vorbelegt mit „Neuer Ordner: Hamburger
Speicherstadt", darunter alle acht vorhandenen Ordner und „Nicht ablegen".
Nichts erzeugt — fünf bezahlte Bilder sind Marks Entscheidung.

## Dateien

| Datei | Was |
|-------|-----|
| `src/lib/ablage-auftrag.ts` | neu — was abzulegen ist, und die Marke |
| `src/lib/ablage-auftrag.test.ts` | neu — 12 Tests, 3 Mutationen |
| `src/hooks/use-ablage-wache.ts` | neu — legt ab, im Takt des Meldewächters |
| `src/components/ablage-waehler.tsx` | neu — die Ordnerzeile |
| `src/components/shooting-kette-button.tsx` | Ziel wandert in den Auftrag |
| `src/hooks/use-fertig-wache.ts` | holt `scene_meta` mit, ruft die Ablage |

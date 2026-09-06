# PROJ-79 — Kopfreihe im Gruppenblatt, Gruppe als eigener Charakter

**Status:** In Review
**Erstellt:** 2026-09-06

## Was Mark am ersten Ergebnis gesehen hat

> „erreicht das dann auch wegen der Kopfgröße, damit man überhaupt so was dann
> machen kann? Finde schon ziemlich klein der Kopf, also Referenz."

Er hat recht, und es lässt sich ausrechnen.

Die Ausgabe ist **1536 × 1024**. Steht eine Person auf rund 85 % der Bildhöhe
und ist ein erwachsener Körper sieben bis acht Kopfhöhen lang, dann ist ihr
Kopf etwa **115 Pixel** hoch. Für ein Blatt, aus dem später ein *Gesicht*
übernommen werden soll, ist das zu wenig — die Kleidung und die Proportionen
trägt es, die Identität kaum.

## Zwei Reihen statt einer

| Reihe | Anteil | wofür |
|-------|-------:|-------|
| oben | ~55 % | Ganzkörper nebeneinander — Kleidung, echte Größenverhältnisse |
| unten | ~40 % | Kopf und Schultern, groß — die Identität |

Bei 40 % Blatthöhe wird ein Kopf dort rund **dreimal so groß** wie in der
oberen Reihe.

**Die Bindung steht ausdrücklich im Prompt:** *„The face below position 1 is
PERSON 1 … Same person, same order, in both rows."* Ohne sie könnte das Modell
die Köpfe vertauschen — und ein Blatt, das falsch zuordnet, wäre schlimmer als
gar keines, weil man ihm glaubt.

## Die Gruppe wird ein Charakter

> „Sollen wir bei Charakter noch einen eigenen anlegen, der dann Gruppe heißt
> oder so?"

Ja — aber als **gewöhnlicher Charakter**, nicht als eigener Bereich.

Der Grund ist nicht Bequemlichkeit. Ein Charakter taucht überall auf, wo man
einen wählen kann: Scene Builder, Shooting-Kette, Referenzrolle,
Bild-übernehmen. Ein eigener Bereich „Gruppen" müsste an jeder dieser Stellen
nachgebaut werden — und beim nächsten Umbau hätte man zwei Sorten Person, von
denen eine die Hälfte nicht kann.

Das Schlagwort **`gruppe`** macht sie wiederfindbar, ohne sie zu trennen. Der
Name ist die Mitgliederliste (`Günther Siegle + Harald Bock`).

**Angelegt wird beim Beauftragen, nicht nach dem Ergebnis** — der Wächter muss
beim Ablegen wissen, wohin. Der Eintrag steht also schon in der Liste, während
das Blatt noch läuft, und bekommt sein Titelbild, sobald es fertig ist.

Dafür trägt das Ablageziel jetzt ein neues Feld, **`alsTitelbild`**: Ein
frischer Eintrag ohne Bild wäre sonst ein leerer Kasten in der Charakterliste,
und das Titelbild müsste von Hand nachgezogen werden — genau die Handarbeit,
die PROJ-76 abgeschafft hat.

## Ein Fallstrick der eigenen Werkzeugkette

In einem Test war aus `\b` beim Schreiben über die Kommandozeile ein **echtes
Backspace-Zeichen (0x08)** geworden. Die Zusicherung lief damit gegen
`/[BS]two[BS]/` und traf nie — der Test war grün-fähig und wertlos.

Aufgefallen ist es nur, weil er *fehlschlug*: `expected 0 to be greater than or
equal to 3`, obwohl das Wort dreimal im Text steht. Byteweise nachgemessen
(`cat -A`), ersetzt, und alle drei beteiligten Dateien auf Steuerzeichen
geprüft — keine mehr.

**Die Lehre:** Regex-Escapes gehören nicht durch einen Heredoc. Die Zusicherung
heißt jetzt `t.split('two').length - 1` und braucht kein einziges Sonderzeichen.

## Was ich nicht prüfen konnte

Das Anlegen der Gruppe habe ich **nicht** im Browser ausgeführt — es würde
einen echten Eintrag in Marks Datenbank hinterlassen. Geprüft sind Typen, Build
und 668 Tests; der Weg vom Knopf bis zum angelegten Charakter zeigt sich beim
ersten echten Versuch.

Auch die Commit-Nachricht hat einen Streifschuss abbekommen: Zwei in Backticks
gesetzte Wörter (`gruppe`, `alsTitelbild`) hat die Shell als Befehle ausgeführt
statt sie zu schreiben. Sie fehlen dort; hier stehen sie vollständig.

## Dateien

| Datei | Was |
|-------|-----|
| `src/lib/gruppen-referenz.ts` | zwei Reihen, Kopfreihe an dieselbe Ordnung gebunden |
| `src/lib/gruppen-referenz.test.ts` | 19 Tests, Backspace-Zeichen entfernt |
| `src/lib/ablage-auftrag.ts` | `alsTitelbild` am Ablageziel |
| `src/hooks/use-ablage-wache.ts` | setzt das Titelbild nach dem Ablegen |
| `src/components/characters/gruppen-referenz-dialog.tsx` | legt die Gruppe an, richtet die Ablage ein |

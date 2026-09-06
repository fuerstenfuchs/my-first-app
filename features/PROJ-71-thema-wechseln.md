# PROJ-71 — Einen Prompt in ein anderes Thema verschieben

**Status:** In Review
**Erstellt:** 2026-09-06

## Was Mark gesagt hat

> „Man kann die verschiedenen Prompts nicht aus einer Gruppe in eine andere
> übernehmen, oder? Das geht noch nicht. Ich habe eine Weile bei Sonstiges
> drin, die möchte ich woanders haben. Wie bringe ich die in eine andere
> Promptgruppe?"

Er hatte recht — und der Grund ist unangenehm.

## Der eigentliche Befund: tote Funktion

`verschieben(promptId, themaId)` lag seit **PROJ-63** fertig in
`src/hooks/use-themen.ts`. Nachgemessen: **kein einziger Aufrufer** im ganzen
Projekt. Code, der wie eine Funktion aussieht, aber keine Bedienung hat.

Das ist derselbe Fehler wie bei den Titelbildern, wo ich Mark eine Bedienung
beschrieben hatte, die es nicht gab, und er antwortete: „Wo mache ich das
genau, hab ich nicht gefunden."

Schlimmer noch: Die tote Funktion hätte auch dann nicht funktioniert, wenn man
sie angeschlossen hätte. Sie schrieb nur die Datenbank. Die Prompt-Liste auf
dem Bildschirm hängt aber an `use-prompts` — der Prompt wäre nach dem
Verschieben **sichtbar im alten Thema stehen geblieben**.

## Was gebaut wurde

Ein Untermenü **„Thema wechseln ›"** im Menü jedes Prompts. Es listet alle
Themen, mit einem Punkt am aktuellen (`DropdownMenuRadioGroup`).

**Ein Bauteil für beide Ansichten** — `src/components/prompts/thema-wechseln.tsx`.
Das Menü gibt es in der Kachel und in der Listenzeile; zwei Kopien wären beim
nächsten Umbau auseinandergelaufen, und dann kann man es in der einen Ansicht
und in der anderen nicht, ohne dass es auffällt.

**Überall verfügbar, nicht nur im geöffneten Thema.** Anders als „Als Titelbild
des Themas", das ohne offenes Thema nicht beantwortbar wäre: Ein falsch
einsortierter Prompt fällt beim Stöbern in „Alle Prompts" auf, und dort will
man ihn auch gleich umhängen.

**Die Rückmeldung nennt beide Namen** — „„Mitten drin" liegt jetzt in „Porträt
& Mode"". Nach dem Verschieben verschwindet die Kachel aus dem gerade offenen
Thema; ohne diesen Satz sähe das aus wie ein Löschen.

**Kein „kein Thema".** Ein Prompt ohne Thema taucht in der Übersicht nirgends
mehr auf und wäre nur noch über „Alle Prompts" zu finden. Ein Menüpunkt, der
Dinge unsichtbar macht, gehört nicht neben einen, der sie einsortiert.

### Der Datenweg wurde begradigt

Das tote `verschieben` ist aus `use-themen` **entfernt**. Der eine Weg heißt
jetzt `themaSetzen` und liegt in `use-prompts`, wo der Zustand der Liste hängt —
so zieht die Anzeige mit.

`themaSetzen` stößt bewusst **kein neues Embedding** an, anders als
`updatePrompt`. Das Thema steht nicht im eingebetteten Text; ein Umsortieren
würde die semantische Suche unverändert lassen und nur Rechenzeit kosten.

## Nachgemessen

Vorher gezählt: 9 Themen, 80 Prompts, **4 in „Sonstiges"** (NFSW Orgie, Mitten
drin, Überraschungsprompt, 20-Fragen-Spiel). Bei vier Stück braucht es keine
Mehrfachauswahl — ein Menüpunkt am einzelnen Prompt reicht und wirkt überall.

Im Browser auf der Produktionsadresse geprüft, angemeldet: Menüpunkt vorhanden,
Untermenü zeigt alle neun Themen mit Punkt am aktuellen, ein Verschieben lässt
die Kachel aus dem offenen Thema verschwinden und meldet beide Namen.

## Ein Fehler beim Prüfen, der hierher gehört

Beim Testen im Browser ist **„Mitten drin" versehentlich nach „Porträt & Mode"
gerutscht** — bemerkt, weil die Zählung danach nicht mehr stimmte (Sonstiges 3
statt 4). Zurückgesetzt und nachgemessen.

Die Lehre: An echten Daten zu testen heißt, **vorher und nachher zu zählen**,
nicht nur auf die Rückmeldung im Bild zu schauen. Die Rückmeldung war jedesmal
richtig — sie hat den zweiten, unbeabsichtigten Klick nur nicht erwähnt.

## Dateien

| Datei | Was |
|-------|-----|
| `src/components/prompts/thema-wechseln.tsx` | neu — das Untermenü, für beide Ansichten |
| `src/hooks/use-prompts.ts` | neu `themaSetzen`, ohne Embedding |
| `src/hooks/use-themen.ts` | totes `verschieben` entfernt |
| `src/components/prompts/prompt-card-grid.tsx` | Untermenü in der Kachel |
| `src/components/prompts/prompt-list-row.tsx` | Untermenü in der Listenzeile |
| `src/app/(app)/page.tsx` | verdrahtet, Rückmeldung mit beiden Namen |

# PROJ-87 — Die Aufstellung der Gruppe ist wählbar

**Status:** In Review
**Erstellt:** 2026-09-07
**Verfeinert:** PROJ-84 (Gruppen-Shooting-Kette)

---

## Der Auftrag

Mark am 07.09.2026:

> Da sollte man die Reihenfolge auf jeden Fall ändern können. Optisch gesehen
> anhand der Bilder, die ist immer gleich von links nach rechts.

Er hat es an den Bildern gesehen, nicht am Code. Und er hat recht: In allen
fünf Bildern einer Gruppenserie stand Person 1 links und bekam an jedem Platz
die erste Haltung. Über eine Serie liest sich das als **Rangordnung** — einer
ist der Anführer, weil er immer vorn steht.

---

## Der naheliegende Einfall, der nicht funktioniert

Man könnte die Haltungen durchrotieren: Person 1 bekommt an Platz 2 die zweite
Haltung, an Platz 3 die dritte, und so fort.

**Das geht nicht, und der Grund steht in den Haltungen selbst.** Manche sind
ORTSGEBUNDEN:

> `tiefe`, Haltung 1: *nearest to the camera and largest, one shoulder turned
> toward the lens*

Diese Haltung gehört zum **linken Platz** an der Fluchtlinie — dort, wo die
Formation sagt „the leftmost person nearest to the camera and largest". Wandert
sie mit der Person nach rechts, widerspricht sie der Formation zwei Zeilen
weiter oben. Dasselbe an der Fläche: „standing with the shoulders back against
the surface" ist die hintere Reihe, nicht eine Person.

**Also wandern die Personen, nicht die Haltungen.** `reihenfolge[platz]` sagt,
welche Person des Blattes an diesem Platz steht; die Haltung bleibt am Platz.

---

## Was das den Prompt kostet

Der Angelpunkt von PROJ-84 war: „Links nach rechts stehen sie in der Ordnung
des Blattes." Das war der einzige Anker der Zuordnung Person↔Gesicht.

Steht die Gruppe anders, **wäre dieser Satz eine Lüge** — und zwar die
schädlichste Sorte, weil das Modell sich sonst darauf verlässt. Deshalb wird er
in dem Fall ersetzt:

> They do NOT stand in the order of the group sheet. Each line below names which
> person of the sheet stands where in this picture; follow those lines exactly.

Danach trägt jede Personenzeile die Zuordnung allein: `PERSON 2 (leftmost) is …`

**Das verlangt vom Modell einen Schritt mehr** — es muss die Blattposition auf
eine andere Bildposition abbilden. Deshalb ist „wie auf dem Blatt" weiterhin die
**Vorgabe**, und „wechselnd" die bewusste Wahl. Mark sieht am Ergebnis, ob es
trägt; das ist die einzige ehrliche Art, das zu entscheiden.

---

## Die Regel bei „wechselnd"

Je Bild um einen Platz verschoben. Das ist die einfachste Regel, die niemanden
zweimal hintereinander an denselben Platz stellt — und eine, die man am
fertigen Bild nachzählen kann. Bei zwei Personen tauschen sie schlicht.

---

## Geändert

| Datei | Was |
|---|---|
| `src/lib/gruppen-shooting.ts` | `Aufstellung`, `AUFSTELLUNGEN`, `reihenfolgeFuer()`; `gruppenKonstellation()` nimmt eine Reihenfolge und nimmt die Ordnungszeile zurück, wenn sie nicht mehr stimmt |
| `src/lib/gruppen-shooting.test.ts` | 6 Tests, darunter „jede Person genau einmal" und „die Haltung bleibt am Platz" |
| `src/lib/shooting-kette.ts` | Option `aufstellung`, Reihenfolge je Bild |
| `src/components/shooting-kette-button.tsx` | Auswahl, nur bei Gruppen sichtbar |

---

## Offen

- **Ob „wechselnd" die Gesichtstreue hält, ist nicht belegt.** Es ist eine
  begründete Erwartung, kein Messwert — dafür braucht es Marks nächste Serie.
- **Die Verschiebung ist starr.** Bei drei Personen wiederholt sie sich ab dem
  vierten Bild. Für fünf Bilder reicht das; eine echte Mischung wäre erst bei
  längeren Serien nötig.

---

## Was die unabhängige Prüfung gefunden hat

**Ein gegenläufiges Paar im selben Prompt, am Platz „Tiefe".** Bei „wechselnd"
stand oben *„They do NOT stand in the order of the group sheet"* — und zwei
Zeilen darunter, aus der Formation, unverändert: *„Left to right **stays** left
to right."* „Stays" hat im Prompt keinen anderen Bezug als das Blatt.

Dieselbe Sorte Fehler wie früher „überlappen" gegen „Spalt Licht", nur an
anderer Stelle. Der Satz sagt jetzt, was er meint: Die Tiefenstaffelung
verschiebt niemanden seitwärts, und die Links-rechts-Ordnung ist die, die
darunter steht.

**Der Hinweis am Knopf versprach zu viel.** „Jedes Bild stellt die Gruppe anders
auf" stimmt für Bild 1 nicht (kein Versatz) und bei drei Personen ab Bild 4
auch nicht. Jetzt: „Von Bild zu Bild tauschen die Plätze — niemand steht zweimal
hintereinander am selben." Das kann man am Bild nachzählen, und dort stimmt es.

**Bestätigt:** Die Haltungen bleiben ortsgebunden, nur die Personennummer
wandert — an allen fünf Plätzen dieselbe Mechanik.

---

## Was kein Code entscheiden kann

**Ob „wechselnd" die Gesichtszuordnung trägt, steht nicht im Quelltext.** Der
einzige Anker ist die Blattzuordnung, und sie definiert Person *n* rein über die
Blattposition. In „wechselnd" muss das Modell zusätzlich Blattposition auf
Bildposition abbilden.

Das gehört an einer echten Serie geprüft: eine Dreier-Gruppe einmal in beiden
Fassungen durchlaufen lassen und die fünf Bilder Gesicht für Gesicht gegen das
Blatt halten. **Bis dahin ist „wechselnd" eine begründete Erwartung, kein
Messwert** — deshalb bleibt „wie auf dem Blatt" die Vorgabe.

Überlegenswert, falls es wackelt: `weit` auch in „wechselnd" bei
Blattreihenfolge lassen. Dort ist die Gruppe klein im Bild und die Zuordnung
ohnehin am dünnsten — sie dort zusätzlich zu verschieben, holt am wenigsten und
riskiert am meisten.

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

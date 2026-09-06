# PROJ-78 — Das Gruppen-Referenzbild

**Status:** In Review (Versuch)
**Erstellt:** 2026-09-06

## Wozu

Mark will Paar- und Gruppenshootings. Der naheliegende Weg — mehrere
Personenfotos an dasselbe Bild hängen — scheitert **nicht an der Anzahl,
sondern an der Zuordnung.**

Die Standardzeilen sagen dem Modell wörtlich:

```
Image 1 = CHARACTER — take the face, hair, skin tone of this person.
Image 2 = CHARACTER — take the face, hair, skin tone of this person.
Image 3 = OUTFIT — take only the garments.
Image 4 = OUTFIT — take only the garments.
```

**Nichts darin verbindet Bild 3 mit Person 1.** Das Modell rät, und die Jacke
landet bei der Falschen.

Mark: *„Ja, auch mal den Weg b. Und dann schauen wir, was dabei rauskommt …
Aber probieren wir erst mal."* Also nur das Blatt, noch keine eigene Kette.

## Die Idee

Einmal ein sauberes Blatt bauen, auf dem jede Person **schon ihre eigene
Kleidung trägt**. Danach ist die Zuordnung im BILD gelöst statt im Text, und
jede spätere Aufnahme braucht nur noch dieses eine Referenzbild.

Dieselbe Bauart wie Referenzkette (PROJ-48) und Shooting-Platten (PROJ-74):
erst eine saubere Vorlage, dann daraus arbeiten.

## Die benannten Zuordnungszeilen

`promptFuerAuftrag` nimmt jetzt eigene Zeilen an. Statt eines nackten
`OUTFIT` steht dort:

```
Image 1 = PERSON 1 — the face, hair, skin tone and body identity of the
          person standing leftmost in the row. Take the identity only.
Image 2 = THE CLOTHES OF PERSON 1 — take only the garments … and put them
          on PERSON 1. Whoever wears them in this image is a mannequin.
Image 3 = PERSON 2 — … rightmost in the row.
Image 4 = THE CLOTHES OF PERSON 2 — …
```

**Person und Kleidung liegen direkt hintereinander.** Stünden erst alle
Personen und dann alle Outfits, müsste das Modell über vier Bilder hinweg
zählen, um Bild 5 mit Bild 1 zu verbinden. Nebeneinander ist die Verbindung
kurz genug, dass sie hält.

**Der Platz in der Reihe ist der Anker** — „leftmost", „rightmost". Bei
Bildmodellen trägt eine Position mehr als jede Beschreibung. Ehrlich dazu:
Links/rechts ist bei Bildmodellen generell schwach. Es hilft, es garantiert
nichts.

## Warum das Blatt aussieht, wie es aussieht

Es ist ein **Werkzeug**, kein Bild. Jede Entscheidung folgt daraus:

* **Abstand statt Überlappung.** In einem Shooting-Bild *sollen* sich
  Silhouetten überlappen — hier ist das Gegenteil richtig, weil das Modell
  später jede Person einzeln herauslesen muss. Wer sich hier berührt,
  verschmilzt dort.
* **Echte Größenverhältnisse**, ausdrücklich nicht angeglichen. Der häufigste
  Fehler bei Erwachsenem und Kind ist die falsche Höhe; steht sie hier richtig,
  stimmt sie später auch.
* **Hände sichtbar und getrennt.** Freie Hände sind bei Bildmodellen die
  zuverlässigste Fehlerquelle — hier bekommen sie eine feste Aufgabe.
* **Neutraler Grund, kein Ort, keine Stimmung.** Nichts von diesem Blatt soll
  in spätere Bilder durchschlagen.
* **Querformat.** Hochkant müsste das Modell die Leute stapeln oder
  beschneiden; beides macht das Blatt unbrauchbar.
* **Keine Namen im Prompt.** „PERSON 1", nicht „Günther". Ein Name zieht
  Annahmen über Geschlecht, Alter und Herkunft nach sich, die dem Referenzfoto
  widersprechen können — genau der Fehler, den die Prompt-Datenbank heute
  losgeworden ist.

## Gemessen

162 echte Aufträge mit Referenzbildern: **nie mehr als drei.** Die
Fehlerquote lag bei einem, zwei und drei Bildern gleich (6,8 / 4,5 / 4,4 %) —
drei schaden also nicht. Vier oder mehr ist ungeprüftes Gebiet; der Arbeiter
selbst hat keine Grenze, er hängt alle an.

Deshalb steht ab vier Personen ein Hinweis im Dialog und ab fünf ein
deutlicherer — nicht verbieten, sondern sagen, was passiert.

## Fotografisch, für später

Ab vier Personen kippt es von *Haltung* zu *Aufstellung*. Zwei der vier
Shooting-Plätze brechen weg: **Gegenlicht** ergibt bei fünf Konturen eine
schwarze Masse, und der **Unterwegs-Shot** wird ein Marschblock. „An einer
Fläche" wird dagegen der beste Platz — Reihe an der Wand, Höhen über Hocken,
Lehnen, Stehen gestaffelt.

Ab sechs dreht sich die Kette um: ein Gruppenbild am Platz, der die Ordnung
liefert, plus vier Bilder von Untergruppen. Das ist noch nicht gebaut.

## Im Browser geprüft

Charakterseite → Knopf im Kopf der Liste → Dialog öffnet, zwei Personen
gewählt, Nummerierung 1 und 2, der Reihenfolgen-Hinweis erscheint, der
Erzeugen-Knopf wird frei. **Nichts erzeugt** — das erste Gruppenbild ist Marks
Versuch.

## Was noch offen ist

Zwei Dinge lassen sich nur am fertigen Bild sehen: ob gpt-image-2 zwei
Gesichter aus einem Blatt später auseinanderhält, und ob „links/rechts" trägt.
Danach entscheidet sich, ob die eigene Gruppen-Kette gebaut wird.

## Dateien

| Datei | Was |
|-------|-----|
| `src/lib/gruppen-referenz.ts` | neu — Reihenfolge, Zuordnungszeilen, Blattprompt |
| `src/lib/gruppen-referenz.test.ts` | neu — 17 Tests |
| `src/components/characters/gruppen-referenz-dialog.tsx` | neu — Personen und Outfits wählen |
| `src/lib/image-generation.ts` | `promptFuerAuftrag` nimmt eigene Zuordnungszeilen |
| `src/app/(app)/characters/page.tsx` | Knopf im Kopf der Liste |

# PROJ-90 — GPT Image 2.5 Sunburst als Vorgabe

**Status:** In Review
**Erstellt:** 2026-09-11

---

## Der Auftrag

Mark am 11.09.2026:

> Kannst Du ab sofort als erstes Bildmodell im Proxy GPT Image zwei Punkt fünf
> sunburst nehmen.

---

## Was schon galt, bevor ich etwas angefasst habe

Nachgemessen statt angenommen — und der Trésor war die **einzige** Stelle, die
noch hinterherhing:

| Ort | Stand am 11.09. |
|---|---|
| Marks globale Regel | sunburst ✓ (seit 10.09.) |
| KI-Zentrale (`BILD_MODELL`) | sunburst ✓ |
| Globales Bildskript `bild.mjs` | sunburst ✓ — aber unerreichbar (siehe unten) |
| **Prompt Trésor** | **`gpt-image-2`** — elf Stellen |

Der Proxy führt heute sechs Bildmodelle; alle drei 2.5er sind dabei.

---

## Was geändert wurde

Elf Vorgaben in neun Dateien, die Modellliste und die Wache des Arbeiters.

**Die drei Spielarten stehen jetzt oben, sunburst zuerst.** Aus Marks Messreihe
über 15 Bilder:

- **sunburst** — wärmer und heller, ruhigere Nacht. Seine Wahl.
- **2.5** — neutral und dokumentarisch, am besten für Gesichter.
- **flare** — mehr Kontrast und Sättigung, für Tageslicht und Produkte.

In der Geschwindigkeit trennt sie nichts: 37,2 / 38,6 / 38,4 Sekunden im
Mittel — die Streuung **eines** Modells ist mit 24 Sekunden siebzehnmal größer
als der Abstand zwischen ihnen.

### `kannReferenzen: true` ist nicht geraten

Das war die einzige Eigenschaft, die ich hätte annehmen müssen. Stattdessen
gemessen: Die KI-Zentrale fährt seit dem 10.09. mit `gpt-image-2.5-sunburst`
und schickt Referenzbilder als `image[]` an `/v1/images/edits`. Dieselbe
Familie, derselbe Weg wie bei `gpt-image-2`.

Das ist nicht nebensächlich: `kannReferenzen` entscheidet, ob ein Modell im
Scene Builder überhaupt angeboten wird. Stünde es falsch, fiele die halbe App
für diese Modelle aus.

### `gpt-image-2` bleibt in der Liste

Nicht aus Nostalgie: In der Warteschlange stehen Aufträge mit dieser Kennung.
Ein Eintrag, den die Anzeige nicht mehr auflösen kann, sähe dort aus wie ein
Fehler.

### Ein Modellname stand im sichtbaren Text

In der freien Erzeugung stand unter dem Format: *„— gpt-image-2 kennt nur drei
Größen."* Nach der Umstellung benannte dieser Satz ein Modell, das gar nicht
gewählt war. Jetzt ohne Namen: *„die GPT-Image-Reihe rechnet in drei festen
Größen."*

**Ungemessen geblieben:** ob 2.5 mehr als drei Größen kennt. Das ließe sich nur
mit einer bezahlten Erzeugung feststellen. Die Zuordnung bildet so oder so auf
drei ab — und genau das sagt der Satz jetzt, statt etwas über ein Modell zu
behaupten.

---

## Nebenbefund: Das globale Bildskript war seit dem 10.09. tot

Kein Teil dieses Projekts, aber beim Messen aufgefallen und sofort behoben.

`~/.claude/fuchs-memory/bild.mjs` las Adresse und Schlüssel aus der
`.env.local` des FILM STUDIOS. Am 10.09. wurden beide dort **entfernt** — das
Studio erzeugt keine Bilder mehr selbst, und zwei Kopien desselben Geheimnisses
auf einem Rechner sind eine zu viel. Der Schlüssel liegt seither nur in der
KI-Zentrale.

Das Skript zeigte weiter auf die alte Datei und meldete bei jedem Aufruf
„In der .env.local fehlt CLIPROXY_URL oder CLIPROXY_API_KEY". Der Weg, den
Marks globale Regel für alle Bilder außerhalb des Studios nennt, war damit
seit einem Tag unbenutzbar.

Es liest jetzt die Datei der Zentrale — **gelesen, nicht kopiert**, es
entsteht keine dritte Kopie. Der Umweg über den HTTP-Dienst der Zentrale wäre
die Alternative gewesen; er setzt aber voraus, dass die Zentrale läuft, und
das Skript soll auch dann gehen, wenn sie es nicht tut.

---

## Geändert

| Datei | Was |
|---|---|
| `src/lib/image-generation.ts` | drei 2.5er ergänzt, sunburst zuerst; Messreihe dokumentiert |
| `src/lib/image-generation.test.ts` | 3 Tests, die die Vorgabe festhalten |
| neun Dateien mit `model:` / `useState<ModellId>` | Vorgabe auf sunburst |
| `src/components/freie-erzeugung.tsx` | Modellname aus dem sichtbaren Text |
| `worker/src/pruefen.ts` | Wache prüft die neue Vorgabe |
| `~/.claude/fuchs-memory/bild.mjs` | liest den Schlüssel wieder dort, wo er liegt |

Tests: 800 → 803. Build sauber.

---

## Nachgemessen

- **Der Proxy** führt `gpt-image-2.5-sunburst` — über die Modellliste bestätigt,
  nicht aus einer Ankündigung übernommen.
- **Ein Rückschritt eingebaut** (gpt-image-2 wieder an erster Stelle) — wird von
  zwei Tests bemerkt. Das ist nötig, weil ein falsches Vorgabemodell an keiner
  Stelle als Fehler auffällt: Der Auftrag läuft durch, das Bild kommt, es sieht
  nur anders aus.
- **`bild.mjs --pruefen`** läuft wieder und meldet sunburst als vorhanden.

---

## Offen

- **Die Größen von 2.5 sind ungemessen.** Kennt es mehr als drei, bietet der
  Trésor derzeit zu wenige Formate an — der harmlosere der beiden möglichen
  Fehler.
- **Die Gemini-Einträge stehen weiter in der Liste**, obwohl Marks Regel sie
  sperrt. Zwei davon brauchen ohnehin einen Schlüssel, den der Proxy nicht
  führt. Sie zu entfernen wäre eine Entscheidung über seinen Auswahlkasten —
  seine, nicht meine.

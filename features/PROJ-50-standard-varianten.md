# PROJ-50: Sieben Standard-Varianten bei Charaktererzeugung

## Status: In Review
**Created:** 2026-09-03

## Warum

Mark am 03.09.2026: „Wenn ein Charakter generiert wird — meistens ist es so,
dass der über die Erweiterung kommt — sollten Varianten schon von Haus aus
angelegt werden … Ob da dann Bilder reinkommen oder nicht, sei dahingestellt,
aber das muss ich sonst immer manuell anstoßen."

Vorher entstand bei der Charaktererzeugung — egal auf welchem Weg — keine
einzige Variante. Über die Erweiterung (der von ihm meistgenutzte Weg) sowieso
nicht; über das In-App-Formular nur, wenn er sofort ein Foto in einen der drei
alten Slots hochlud, was seinem üblichen Arbeitsablauf (ein Titelbild, Rest per
KI) nicht entspricht.

## Die sieben Namen

Mit Mark abgestimmt (zwei Rückfragen, 03.09.2026), in dieser Reihenfolge:

1. **Kopf**, 2. **Körper**, 3. **Referenzsheet** — identisch mit
   `VARIANTEN_NAME` aus PROJ-48, damit die Referenzkette sie später wiederfindet
   statt zu duplizieren.
4. **Ausdrücke**
5. **Sonstige** — bewusst gewähltes Sammelfach ohne festen Zweck.
6. **Outfit** — laut Mark ein „leerer Platzhalter wie die anderen", KEINE
   Verknüpfung zur separaten Outfit-Bibliothek (PROJ-20).
7. **Calvanize** — benannt nach Marks gespeichertem Scene-Builder-Preset
   „Calvanize Studio" (Supabase `scene_presets`, id
   `1e7675d3-5823-4e68-ae3c-98f02aafc3d3`, seit 17.06.2026). Sein bisheriger
   manueller Ablauf: Preset laden, Referenzsheet des Charakters als Referenz
   einsetzen, erzeugen, Ergebnis von Hand als Titelbild setzen. Hier zunächst
   NUR das leere Fach — siehe PROJ-51 unten.

Alle sieben entstehen **leer**. Es wird nichts generiert.

## Umsetzung

**Neu:** `src/lib/charakter-varianten.ts` — `STANDARD_VARIANTEN` (die ersten
drei importiert aus `VARIANTEN_NAME`, `referenzkette.ts`, nicht neu
abgeschrieben — sonst laufen zwei Namensquellen auseinander),
`fehlendeStandardVarianten(vorhandene)`, `istStandardVariante(name)`. Frei von
React/Supabase, wie `referenzkette.ts`. `src/lib/charakter-varianten.test.ts`,
10 Tests.

**Geändert:**
- `src/hooks/use-characters.ts`, `createCharacterWithSlots` — legt die sieben
  Fächer per Batch-Insert an (sort_order 0–6), misst das Ergebnis NACH dem
  gesamten Ablauf (inklusive der Bild-Slot-Schleife) nach, nicht direkt danach
  — sonst könnte eine Meldung „Kopf fehlt" noch dastehen, obwohl die
  Slot-Schleife das Fach zwischenzeitlich selbst angelegt hat.
- `src/components/characters/character-form.tsx` — Slot-Beschriftung
  „Gesichtsausdruck" → „Ausdrücke" (kanonischer Name).
- `extension/src/components/CharacterCaptureScreen.tsx` — legt dieselben
  sieben Fächer an; lokale Kopie der Namensliste (eigenes Vite-Projekt, kein
  Import aus `src/`), Ergebnis wird per `.select()` nachgemessen statt nur auf
  `error === null` vertraut.

## Von Critic gefunden und noch vor der ersten Nutzung behoben

Ein unabhängiger Prüfdurchgang fand einen echten Blocker, ausgelöst durch
dieses Feature selbst:

- **`extension/src/components/AddCharacterImageScreen.tsx`** wählte bisher
  „die erste Variante nach sort_order" als Ziel für ein nachträglich
  hinzugefügtes Foto. Vorher harmlos (frisch erfasste Charaktere hatten null
  Varianten, das Fach hieß dann „Standard-Ansicht"). Ab diesem Feature ist die
  erste Variante aber IMMER „Kopf" — ein beliebiges Foto (Outfit, Screenshot,
  was auch immer) wäre dort gelandet, und die Referenzkette hätte es als
  Kopf-Sheet gelesen und den echten Kopf-Schritt übersprungen. Behoben: Ziel
  ist jetzt gezielt die Variante „Sonstige" (per Namen gesucht, nicht
  Position).
- Grüner „✓ Gespeichert!"-Knopf erschien in der Erweiterung gleichzeitig mit
  einem Bernstein-Warnhinweis, falls die sieben Fächer nicht angelegt werden
  konnten — las sich wie ein Erfolg trotz Warnung. Button bleibt jetzt neutral,
  wenn ein Hinweis ansteht.
- `sort_order`-Lücken bei zusätzlichen, nicht-standardmäßigen Bild-Slots
  behoben (fortlaufender Zähler statt Schleifenindex).

## Bewusst offen gelassen

- **Kein Nachrüsten bestehender Charaktere.** Nur ab jetzt neu angelegte
  bekommen die sieben Fächer automatisch. Ältere Charaktere bleiben, wie sie
  sind — eine bewusste, aber vorläufige Entscheidung; ein Nachziehen wäre mit
  `fehlendeStandardVarianten()` trivial, falls Mark das will.
- **RLS von `character_variants` nicht im Repo auffindbar** (keine
  Migrations-/Policy-SQL-Datei dazu) — vom Review als „nicht verifizierbar,
  nicht als unauffällig" markiert, nicht als Mangel dieses Features.
- **Keine Beschreibung an der „Calvanize"-Variante**, die erklärt, wofür sie
  steht — kosmetisch, siehe PROJ-51.

## Folgefeature

PROJ-51 (noch nicht spezifiziert): ein Knopf, der das „Calvanize
Studio"-Preset automatisch mit dem Referenzsheet des Charakters kombiniert,
erzeugt und als Titelbild setzt. Mark: „Wenn das automatisch möglich wäre, gib
mir gerne Bescheid — ein Knopf dafür reicht mir auch schon aus." Bewusst
NICHT als stille Automatik bei jeder Charaktererzeugung — das wäre eine
kostenpflichtige Bilderzeugung ohne erneute Zustimmung im Moment.

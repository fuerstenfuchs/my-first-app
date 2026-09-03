# PROJ-51: Titelbild per Knopf aus dem Preset „Calvanize Studio"

## Status: In Review
**Created:** 2026-09-03
**Gebaut:** 2026-09-03

## Warum

Mark am 03.09.2026:

> „Calvanize ist schon richtig. Das ist ein Preset, das abgespeichert ist im
> Scene Builder. Das mache ich manuell bisher immer noch. Das wird dann am Ende
> das Coverbild sozusagen von dem Charakter. Wenn das automatisch möglich wäre,
> gib mir gerne Bescheid. Das nimmt mir Arbeit ab. Referenzbild hierfür ist der
> Referenzsheet."

Sein Handgriff heute: Scene Builder öffnen, Preset laden, Referenzsheet des
Charakters als Charakter-Referenz einsetzen, erzeugen, Ergebnis von Hand als
Titelbild setzen. Vier Schritte, bei jedem Charakter.

## Ein Knopf, keine Automatik — und warum

Angeboten hatte ich beides. Mark am 03.09.2026: **„Ja, ein Knopf dafür reicht
mir auch schon aus. Das passt."**

Der Grund für die Rückfrage: Eine Automatik, die bei jeder Charaktererzeugung
von selbst ein Bild erzeugt, wäre eine **kostenpflichtige gpt-image-2-Anfrage
ohne Zustimmung im Moment**. Marks eigene Regel „Marks Bildauftrag ist die
Freigabe" gilt für den Moment, in dem er ein Bild bestellt — nicht für eine
Mechanik, die das künftig ungefragt für ihn tut. Der Klick auf den Knopf ist
der Auftrag; deshalb gibt es dort auch KEINE zusätzliche Kostenabfrage.

## Das Preset — nachgemessen, nicht vermutet

Ein Rechercheschritt kam zum Schluss, „Calvanize" sei vermutlich gar kein
Preset, weil es unter den neun eingebauten Standard-Presets nicht vorkommt.
Direkt in der Datenbank nachgesehen: **es existiert**, als Marks eigenes
gespeichertes Preset in `scene_presets`.

- Name: **„Calvanize Studio"** (er nennt es verkürzt „Calvanize")
- `id`: `1e7675d3-5823-4e68-ae3c-98f02aafc3d3`, Kategorie „Portrait",
  angelegt am 17.06.2026
- Kern der Konfiguration: 85 mm, Closeup, Augenhöhe, geringe Schärfentiefe,
  Format `portrait_4_5`, innen, Ringlicht, „cinematic", Haarlicht +
  Catchlights, grauer Verlaufshintergrund, ein eigener Stil-Eintrag und das
  Grading `bleach_bypass`.

**Der Stolperstein:** Das Preset speichert `character_id` und
`refs.character` von dem Charakter, mit dem Mark es damals gebaut hat. Wird es
unverändert angewendet, erzeugt es das Gesicht dieser fremden Person. Beides
muss beim Anwenden überschrieben werden — durch den Zielcharakter und dessen
Referenzsheet.

## Umsetzung

- `src/lib/szene-prompt.ts` — die Prompt-Bausteine des Scene Builders
  (`buildPrompt` samt Helfern, Typen `Scene`/`SceneRefs`), unverändert aus
  `scene-builder/page.tsx` herausgelöst und exportiert. Sie waren dort schon
  reine Funktionen auf Modulebene, nur nicht exportiert. **Bewusst Extraktion
  statt Kopie:** Eine zweite Prompt-Erzeugung neben der ersten wäre genau die
  Doppelquelle, die in diesem Projekt am 03.09.2026 mehrfach zu Fehlern
  geführt hat. Nebenbei bekommt diese Logik damit erstmals Tests.
- `src/lib/titelbild-preset.ts` — `TITELBILD_PRESET_NAME` und die reine
  Regel, wie aus einem Preset plus Zielcharakter plus Referenzsheet eine Szene
  wird (fremder Charakter und alle Outfit-/Location-Reste werden verworfen).
- `src/hooks/use-titelbild-erzeugen.ts` — der Ablauf: Preset laden,
  Referenzsheet ermitteln und auf eigenen Speicher prüfen, Prompt bauen,
  Auftrag einreihen, auf das Ergebnis warten, in die Variante „Calvanize"
  legen, als Titelbild setzen.
- Knopf im Charakter-Bereich neben „Referenzkette".

## Entscheidungen

- **Das Ergebnis wird zuerst abgelegt, dann verlinkt.** Als Titelbild kommt
  die Adresse aus `character-images`, nicht die rohe `generated-images`-Adresse
  des Auftrags: Wird der Auftrag später aus der Warteschlange gelöscht,
  verschwände seine Datei — und das Titelbild wäre still kaputt.
- **Das Titelbild wird ausdrücklich überschrieben**, anders als beim normalen
  „Übernehmen", das Titelbilder bewusst nie anfasst (Mark: „Da habe ich mühsam
  schon eigene Titelbilder erstellt … Ein übernommenes Bild ist immer nur ein
  weiteres Bild"). Hier ist das Überschreiben der Zweck — deshalb wird es auch
  gesagt und passiert nicht stillschweigend.
- **Der Knopf hängt am Namen des Presets.** Benennt Mark es um, findet der
  Knopf es nicht mehr; die Fehlermeldung nennt dann den gesuchten Namen
  wörtlich, statt nur „nicht gefunden" zu sagen.
- **Voraussetzung ist ein vorhandenes Referenzsheet.** Ohne das gibt es keine
  Vorlage; der Knopf bleibt gesperrt und sagt, warum.

## Umsetzungsnotizen (2026-09-03)

Gebaut wie oben beschrieben. Vier neue Dateien, zwei geänderte:

- neu `src/lib/szene-prompt.ts` + `szene-prompt.test.ts` (44 Tests)
- neu `src/lib/titelbild-preset.ts` + `titelbild-preset.test.ts` (21 Tests)
- neu `src/hooks/use-titelbild-erzeugen.ts`
- neu `src/components/characters/titelbild-knopf.tsx`
- geändert `src/app/(app)/scene-builder/page.tsx` (nur Import statt
  Deklaration — Verhalten unverändert)
- geändert `src/app/(app)/characters/page.tsx` (Knopf in der Kopfzeile)

**Gegenprobe zur Extraktion.** Vor der Verschiebung wurden die Zeilen der
Prompt-Erzeugung maschinell aus `page.tsx` geschnitten, in ein Wegwerf-Modul
gelegt und für acht Beispielszenen die Prompts aufgezeichnet. Diese acht
Zeichenketten stehen jetzt wörtlich in `szene-prompt.test.ts` und werden gegen
die verschobene Fassung geprüft — sie stammen aus der ALTEN Fassung, deshalb
beweisen sie die Gleichheit. Gegenprobe zur Gegenprobe: Ein einziges
entferntes Zeichen (`'Photorealistic.'` → `'Photorealistic'`) macht 10 der 44
Tests rot, darunter alle acht Grundlinien-Fälle.

Ebenso gegengeprüft: Lässt man `titelbildSzene` das Referenzbild aus dem
Preset durch, werden 3 Tests rot — darunter der, der den fremden Charakter
aus Marks gespeichertem Preset nachstellt.

**Abweichung vom Auftrag.** Der Knopf löst mit EINEM Klick aus; das
Fortschrittsfenster geht danach von selbst auf. Ein Dialog mit zweitem
Bestätigungsknopf (wie bei der Referenzkette) wäre ein zweiter Klick gewesen —
Mark: „Ein Knopf dafür reicht mir auch schon aus", und der Klick ist die
Freigabe. Gesperrt ist der Knopf nur, solange kein Referenzsheet vorliegt oder
es nicht im eigenen Speicher liegt; der Grund steht im Mouseover.

**Preis der Umsetzung.** Der Hook lädt drei Listen (`useVisualAssets`,
`useLookGrading`, `usePoseActions`), damit er ein Preset genauso auflöst wie
der Scene Builder. Das sind zwei bis drei zusätzliche Abfragen beim ersten
Öffnen eines Charakters — auch dann, wenn der Knopf nie gedrückt wird. Die
Posen wären heute sparbar (Marks Preset hat `pose_id: null`), aber ein Feld,
das stillschweigend verschwindet, sobald er dem Preset einmal eine Pose gibt,
wäre der teurere Fehler.

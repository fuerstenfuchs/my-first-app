# PROJ-91 — Körperform-Baukasten

**Status:** In Review
**Erstellt:** 2026-09-29 (nachträglich beschrieben, gebaut am selben Tag)

## Auftrag

Mark am 29.09.2026: Die Referenzkette lieferte Körper, die „fast immer gleich
aussehen" — Größe, Beinlänge und Proportionen wurden aus dem Referenzbild kaum
übernommen. „Wir brauchen extremere Maße, in allen Körperteilen."

## Was gebaut wurde

- **Zwölf Körperregionen** in `KoerperAuswahl` (`src/lib/referenzkette.ts`):
  Körperbau, Größe, Oberweite, Becken, Beinlänge, Oberschenkel, Wade, Gesäß,
  Bauch, Taille, Schultern, Arme — je mit Extremstufe in beide Richtungen
  („sehr …"), formuliert mit konkretem Bild/Verhältnis statt nur Adjektiv.
- **24 Blender-Presets** (`src/lib/koerper-presets.ts`): je Region zwei Extreme,
  gerendert mit `werkzeuge/blender/koerperform.py` (Fuchsbau-Repo, MPFB),
  im Speicher unter `prompt-media/<uid>/koerper-presets/`.
- **Preset-Leiste** in der Referenzkette und in „Sheet erstellen"
  (`platzVorbelegung` am `PromptToImageDialog`).

## Befunde, die es gekostet hat

- Ein Referenzbild mit abgeglätteten Extremen führt zu durchschnittlichen
  Ergebnissen — das Modell folgt dem, was es sieht.
- `TargetService.set_target_value` (MPFB) wirkt nur auf bereits geladene
  Ziele; ohne `load_target` passiert still nichts (per Pixelvergleich gefunden).

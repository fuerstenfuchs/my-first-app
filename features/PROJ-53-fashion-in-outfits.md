# PROJ-53: Fashion in Outfits zusammenlegen (Kategorie am Eintrag)

## Status: In Review
**Created:** 2026-09-03

## Warum

Mark am 03.09.2026: „Wir haben hier Fashion, Outfit und Outfit-Archetypen. Das
wird zukünftig alles ein Punkt sein." Die Archetypen sind mit PROJ-52 weg;
übrig bleibt die Zusammenlegung von **Fashion Assets** (einzelne
Kleidungsstücke, PROJ-21) und **Outfits** (komplette Looks, PROJ-20).

## Die Entscheidung: Kategorie am Eintrag

Ein einzelnes Kleidungsstück („Lederjacke") und ein kompletter Look
(„Schlager-Auftritt") sind verschiedene Dinge. Auf die Rückfrage, wie sie im
gemeinsamen Bereich auseinanderzuhalten sind, wählte Mark:
**„Kategorie am Eintrag"** — ein Bereich, jeder Eintrag trägt eine Kategorie,
gefiltert und gesucht wird wie bei den Bausteinen.

Die Alternative (alles flach ohne Unterscheidung) hätte die acht vorhandenen
Fashion-Kategorien verloren.

## Der Datenbestand

| | Einträge | Varianten |
|---|---|---|
| `fashion_assets` | 19 | 9 |
| `outfits` | 17 | 26 |

Fashion-Kategorien: kleider 8, oberteile 6, unterteile 2, jacken 1, schuhe 1,
sonstiges 1.

Die Kategorienliste bekommt einen **neunten** Eintrag für das, was die
bisherigen Outfits sind: `komplett` — „Komplett-Look". Er steht an erster
Stelle, weil er der ursprüngliche Zweck des Bereichs ist; die acht
Kleidungsstück-Kategorien folgen unverändert.

## Schema (bereits ausgeführt, 03.09.2026)

`outfits` fehlten vier Spalten, die `fashion_assets` hat. Additiv ergänzt:

```sql
alter table outfits
  add column if not exists category text,
  add column if not exists source_url text,
  add column if not exists source_title text,
  add column if not exists crop_image_url text;
update outfits set category = 'komplett' where category is null;
alter table outfits alter column category set default 'komplett';
```

Alle 17 vorhandenen Outfits stehen jetzt auf `komplett`. Die Varianten- und
Bildtabellen beider Seiten sind formgleich (`outfit_variants` hat mit
`metadata` sogar eine Spalte mehr) — der Umzug braucht dort keine Anpassung.

## Umfang

**Zusammenzuführen:** Seite `fashion-assets` → `outfits`; `use-fashion-assets`
→ `use-outfits`; die fünf Komponenten unter `src/components/fashion-assets/`;
`analyze-fashion`-Route; in der Erweiterung `FashionCaptureScreen` und
`AddFashionImageScreen`; Einträge in `bausteine.ts`, `sidebar-nav.ts`.

**Erhalten bleiben muss:** das Sheet-Erzeugen für Kleidungsstücke
(`fashion-sheet-dialog.tsx`, `generate-outfit-sheet`-Route) — es hängt an der
Kategorie und ist der Grund, warum die Kategorien überhaupt gebraucht werden.

## Reihenfolge

Schema (fertig) → Code bauen und prüfen → Datenumzug → sofort deployen. Der
Umzug kommt bewusst NACH dem Code: 19 Kleidungsstücke in einer Outfit-Liste
ohne Kategoriefilter wären sonst minutenlang unbrauchbar.

## Umzug durchgeführt (03.09.2026)

Additiv wie bei PROJ-52: nur `insert`, kein `update`, kein `delete`. Die
Tabellen `fashion_assets`, `fashion_asset_variants` und
`fashion_asset_images` stehen unverändert als Sicherheitsnetz.

| Kategorie | Einträge | Varianten | Bilder |
|---|---|---|---|
| komplett | 17 | 27 | 50 |
| kleider | 8 | 1 | 1 |
| oberteile | 6 | 6 | 6 |
| unterteile | 2 | 0 | 0 |
| jacken | 1 | 1 | 1 |
| schuhe | 1 | 0 | 0 |
| sonstiges | 1 | 1 | 1 |

36 Einträge = 17 bisherige Outfits + 19 Kleidungsstücke. Aus dem Fashion-
Bestand kamen **9 Varianten und 9 Bilder** — genau die Zahlen, die vorher in
den Fashion-Tabellen standen. Alle 19 behielten ihr Titelbild, ihre Kategorie,
Beschreibung, Schlagworte und den Quellen-Verweis. `metadata` trägt
zusätzlich `herkunft: 'fashion-umzug'` und die alte `fashion_id` — damit ist
der Umzug nachvollziehbar und umkehrbar, und das Statement überspringt beim
zweiten Lauf, was schon da ist.

## Sichtbare Änderung, die keine Fehlfunktion ist

Die Outfit-Liste sortiert jetzt **nach Namen** statt nach Anlagedatum. Die
Fashion-Seite hat immer nach Namen sortiert; nach Datum stünden die 19
umgezogenen Kleidungsstücke in einer Reihenfolge, die niemand sieht. Falls
Mark das Anlagedatum zurückwill, ist es eine Zeile.

## Offen gelassen

- Das Anlege-Formular bietet weiter vier Bildfächer (Vorne/Seite/Hinten/
  Detail), jetzt auch für ein einzelnes Kleidungsstück. Für eine Jacke
  plausibel, für ein Paar Schuhe halb. Bewusst behalten, weil die Fächer
  freiwillig sind und das Bild dabei in einer Variante landet statt nur in der
  Titelbildspalte.
- `SPEICHERLIMIT_MB['fashion-assets']` bleibt: Die Bilder der 19 Einträge
  liegen weiter in diesem Eimer.

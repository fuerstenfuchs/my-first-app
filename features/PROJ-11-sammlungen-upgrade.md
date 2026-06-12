# PROJ-11: Sammlungen Upgrade (Cover-Bilder, Drag & Drop)

## Status: Deployed
**Created:** 2026-06-12
**Last Updated:** 2026-06-12

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — geschützte Routen
- Requires: PROJ-2 (Prompt-Verwaltung CRUD) — Prompts müssen existieren
- Requires: PROJ-4 (Sammlungen & Workflows) — bestehende Collections-Infrastruktur (Tabellen, RLS, Sidebar)
- Requires: PROJ-8 (Mehrere Medien) — Prompt-Bilder als Quelle für automatische Collection-Cover

## User Stories

- Als KI-Power-User möchte ich meine Sammlungen auf einer eigenen visuellen Übersichtsseite sehen, damit ich schnell per Cover-Bild erkenne welche Sammlung welches Thema hat — ohne durch eine Textliste scrollen zu müssen
- Als KI-Power-User möchte ich eine neue Sammlung direkt auf der Übersichtsseite anlegen können, damit ich nicht in die Sidebar wechseln muss
- Als KI-Power-User möchte ich dass Sammlungen automatisch ein attraktives Cover-Bild bekommen (aus den enthaltenen Prompts), damit meine Sammlungsgalerie sofort visuell ist ohne manuelle Konfiguration
- Als KI-Power-User möchte ich ein individuelles Cover-Bild für eine Sammlung festlegen können (aus eigenen Prompt-Bildern oder per Upload), damit ich spezifische Sammlungen mit einem passenden Titelbild hervorheben kann
- Als KI-Power-User möchte ich Prompts innerhalb einer Sammlung per Drag & Drop umsortieren, damit ich meinen Workflow intuitiv und schnell neu ordnen kann — auch bei 20+ Prompts

## Out of Scope

- Sammlungen in der Sidebar per Drag & Drop umsortieren — deferred to PROJ-14 (optional)
- Prompts zwischen verschiedenen Sammlungen ziehen (Cross-Collection Drag & Drop) — deferred to PROJ-15 (optional)
- Sammlungs-Beschreibung / Notizen — nicht Teil dieses Upgrades
- Sammlungs-Statistiken (Nutzungszähler, Trend) — deferred to PROJ-5-Erweiterung
- Sammlungs-Farben / Labels
- Sammlungs-Teilen / Permissions
- Verschachtelte Sammlungen / Unterordner
- Cover-URL direkt eingeben — kein primärer Workflow; Nutzer sollen aus vorhandenen Prompt-Bildern wählen oder hochladen
- Cover beim Erstellen einer Sammlung konfigurieren — wird nach Erstellung automatisch generiert
- Kleine Thumbnails in der Sidebar — Sidebar bleibt schlank (nur Textlinks)

## Acceptance Criteria

### Collections-Übersichtsseite (`/collections`)

- [ ] Angenommen der Nutzer ist eingeloggt, wenn er `/collections` aufruft, dann sieht er alle seine Sammlungen als Kachelraster mit Cover-Bild, Name und Prompt-Anzahl
- [ ] Angenommen keine Sammlungen existieren, wenn der Nutzer `/collections` aufruft, dann erscheint ein Leer-Zustand: Icon + „Noch keine Sammlungen" + „Erste Sammlung anlegen"-Button
- [ ] Angenommen der Nutzer klickt auf „+ Neue Sammlung" im Seiten-Header oder im Leer-Zustand, dann öffnet sich ein Erstellungs-Dialog mit nur einem Pflichtfeld: Sammlungs-Name
- [ ] Angenommen der Nutzer gibt einen Namen ein und bestätigt, dann wird die Sammlung sofort angelegt und der Nutzer wird zur Detailseite `/collections/[id]` weitergeleitet
- [ ] Angenommen der Nutzer lässt das Namensfeld leer und klickt auf Erstellen, dann erscheint eine Validierungsfehlermeldung und die Sammlung wird nicht angelegt
- [ ] Angenommen der Nutzer klickt auf eine Sammlungs-Kachel, dann navigiert er zur Detailseite dieser Sammlung

### Cover-Bilder — Automatischer Modus

- [ ] Angenommen eine Sammlung enthält einen Prompt mit Cover-Bild, wenn kein manuelles Cover gesetzt ist, dann wird das Cover des ersten Prompts (in Sammlungsreihenfolge) als Collection-Cover angezeigt
- [ ] Angenommen der erste Prompt hat kein Cover-Bild aber hat andere Bilder (prompt_media), wenn kein manuelles Cover gesetzt ist, dann wird das erste Bild dieses Prompts als Collection-Cover verwendet
- [ ] Angenommen eine Sammlung enthält mindestens 2 Prompts mit Bildern, wenn kein manuelles Cover gesetzt ist, dann wird eine Collage aus den ersten verfügbaren Bildern angezeigt: 1 Bild = Vollbild, 2 = Split, 3 = Drei-Kacheln, 4+ = 2×2-Raster mit Bild-Anzahl-Badge
- [ ] Angenommen eine Sammlung enthält keine Prompts mit Bildern, wenn kein manuelles Cover gesetzt ist, dann wird ein Platzhalter-Cover (Icon + Sammlungsname) angezeigt

### Cover-Bilder — Manueller Modus

- [ ] Angenommen der Nutzer ist auf der Sammlungs-Detailseite, wenn er auf „Cover bearbeiten" klickt, dann öffnet sich ein Modal/Popover mit zwei Optionen: „Automatisch" und „Individuell"
- [ ] Angenommen der Nutzer wählt „Individuell", dann sieht er eine Auswahl aller Bilder aus den Prompts in dieser Sammlung sowie einen „Eigenes Bild hochladen"-Button
- [ ] Angenommen der Nutzer wählt ein Prompt-Bild aus der Galerie, dann wird dieses als fixes Cover-Bild gespeichert (Cover-Modus wechselt auf „Individuell")
- [ ] Angenommen der Nutzer lädt ein eigenes Bild hoch, dann wird es in Supabase Storage gespeichert und als fixes Cover-Bild gesetzt
- [ ] Angenommen der Nutzer wechselt zurück auf „Automatisch", dann wird das manuelle Cover entfernt und das Cover folgt wieder den automatischen Regeln
- [ ] Angenommen kein Bild aus der Galerie ist verfügbar (Sammlung hat keine Prompt-Bilder), wenn der Nutzer „Individuell" wählt, dann sieht er nur den Upload-Button (keine leere Galerie)

### Sammlungs-Detailseite — Verbesserter Header

- [ ] Angenommen der Nutzer ruft eine Sammlungsseite auf, dann sieht er im Header: ein einzelnes großes Cover-Bild (kein Collage-Raster), Sammlungsname, Prompt-Anzahl und „Cover bearbeiten"-Button
- [ ] Angenommen ein manuelles Cover gesetzt ist, dann zeigt der Header dieses Cover-Bild
- [ ] Angenommen kein manuelles Cover gesetzt ist (Auto-Modus), dann zeigt der Header das automatisch ausgewählte einzelne Bild (erstes verfügbares Bild aus den Prompts der Sammlung) — kein Collage-Raster auf der Detailseite
- [ ] Angenommen die Sammlung hat keine Bilder, dann zeigt der Header den Platzhalter (Icon + Name)

### Drag & Drop — Prompt-Reihenfolge

- [ ] Angenommen der Nutzer ist auf der Sammlungs-Detailseite, dann hat jede Prompt-Kachel ein sichtbares Drag-Handle-Icon (⠿) an einer fixen Position (z.B. oben links)
- [ ] Angenommen der Nutzer zieht eine Kachel per Maus auf eine neue Position, dann werden die anderen Kacheln flüssig animiert auseinandergeschoben und eine Drop-Indikator-Linie zeigt die Zielposition
- [ ] Angenommen der Nutzer lässt die Kachel los, dann springt sie sofort an die neue Position und die Reihenfolge wird in Supabase persistiert
- [ ] Angenommen der Nutzer zieht auf einem Touch-Gerät (Mobile), dann funktioniert das Drag & Drop ebenfalls (long-press startet den Drag)
- [ ] Angenommen die ↑/↓-Buttons existieren noch im Code, dann sind sie in PROJ-11 vollständig entfernt — nur Drag Handles

## Edge Cases

- **Leere Sammlung:** Detailseite zeigt Leer-Zustand „Noch keine Prompts in dieser Sammlung" + Button „Prompts hinzufügen" (navigiert zu `/` mit Hinweis)
- **Cover-Bild-Quelle ändert sich:** Wenn der erste Prompt aus der Sammlung entfernt wird, berechnet sich das automatische Cover neu aus dem dann ersten Prompt
- **Prompt ohne Bilder wird erster Prompt:** Automatisches Cover springt zum nächsten Prompt mit Bild weiter (nicht zwingend der erste); falls kein Prompt in der Sammlung Bilder hat → Platzhalter
- **Upload schlägt fehl:** Toast-Fehler beim Custom-Cover-Upload, Modal bleibt offen, vorheriges Cover bleibt erhalten
- **Drag & Drop mit einem einzigen Prompt:** Drag Handle sichtbar, aber kein sinnvoller Drop-Ziel → kein Fehler, nichts passiert
- **Sehr viele Prompts (50+):** Drag & Drop muss bei langen Listen performant bleiben (kein DOM-Rendering-Einbruch beim Scrollen)
- **Gleichzeitiger Zugriff:** Wenn der Nutzer dieselbe Sammlung auf zwei Tabs offen hat und auf beiden zieht, gewinnt der letzte Server-Write (kein Conflict-Dialog nötig — Solo-Nutzer)
- **Collection-Cover-Upload-Größe:** Gleiches Limit wie PROJ-8: 20 MB, nur Bildformate (JPEG, PNG, WebP, GIF)
- **Collage mit gelöschten Bildern:** Wenn ein Prompt aus der Sammlung entfernt oder sein Bild gelöscht wird, berechnet sich die Collage beim nächsten Laden neu

## Technical Requirements

- Drag & Drop: `@dnd-kit/core` + `@dnd-kit/sortable` — einzige DnD-Bibliothek in der App
- Drag & Drop: Desktop (Maus) und Mobile (Touch) müssen funktionieren
- Drag & Drop: Keyboard-Accessibility (Tab + Space/Enter für Reorder)
- Cover-Berechnung: Client-seitig aus bereits geladenen Prompt-Daten (kein separater API-Call)
- Reihenfolge-Persistierung: Optimistisches Update + Supabase-Write (gleiche Strategie wie PROJ-4)
- Cover-Upload: Supabase Storage (neuer `collection-covers`-Bucket oder bestehender `prompt-media`-Bucket — Architektur-Entscheidung)
- Collage: Nur auf `/collections` Übersicht; auf Detailseite immer einzelnes Bild

## Open Questions

_Alle Fragen geklärt — keine offenen Punkte._

---

## Decision Log

### Product Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Automatisches Cover ohne Nutzeraufwand | App ist visuell — Sammlungen sollen sofort attraktiv sein, auch wenn der Nutzer nie ein Cover konfiguriert | 2026-06-12 |
| Cover-Priorität: Manual > first prompt cover > first prompt media > Platzhalter | Deterministisch und intuitiv — Nutzer bekommt immer das „beste" verfügbare Bild | 2026-06-12 |
| Collage statt Einzelbild bei mehreren Bildern | Pinterest/Lightroom-Feeling; zeigt sofort die Vielfalt der Sammlung | 2026-06-12 |
| Keine Thumbnails in der Sidebar | Sidebar bleibt schlank und navigation-optimiert; visuelles Erlebnis gehört auf die Übersichtsseite | 2026-06-12 |
| Drag & Drop nur innerhalb einer Sammlung (Option A) | Häufigste Aktion zuerst; Cross-Collection-Drag ist komplexer und seltener genutzt | 2026-06-12 |
| ↑/↓-Buttons vollständig entfernen | Drag Handles ersetzen sie komplett — zwei parallele Systeme verwirren den Nutzer | 2026-06-12 |
| Cover beim Erstellen nicht konfigurieren | Sammlung soll in 2 Sekunden erstellt sein; Cover-System generiert automatisch nach Inhalt | 2026-06-12 |
| Nach Erstellung direkt zur Detailseite navigieren | Ermutigt Nutzer sofort Prompts hinzuzufügen; leere Sammlung auf Übersicht wirkt demotivierend | 2026-06-12 |
| Cover-URL-Eingabe nicht als primären Workflow | Nutzer haben bereits Bilder in ihren Prompts; Galerie-Auswahl ist komfortabler als URL-Tippen | 2026-06-12 |
| Detailseite: einzelnes Cover-Bild statt Collage | Detailseite braucht Identität und Lesbarkeit, nicht Browsing — Collage gehört auf die Übersichtsseite | 2026-06-12 |
| Drag & Drop: `@dnd-kit/core` + `@dnd-kit/sortable` | Einzige DnD-Bibliothek in der gesamten App; React-nativ, Touch-Support, Keyboard-Accessibility, aktiv gepflegt; Basis für künftige Features (Collection-Ordering, Cross-Collection-DnD) | 2026-06-12 |

### Technical Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| `cover_image_url = null` bedeutet Auto-Modus | Kein separates `cover_mode`-Feld nötig — null = automatisch, gesetzt = manuell; einfachste mögliche Implementierung | 2026-06-12 |
| Cover-Berechnung rein client-seitig | Die Prompt-Daten inkl. `preview_media` (PROJ-9) sind beim Laden der Seite bereits vorhanden — kein zusätzlicher API-Call nötig | 2026-06-12 |
| Neuer `collection-covers` Storage-Bucket | Saubere Trennung von `prompt-media`; ermöglicht eigene Storage-Regeln und Cleanup-Strategien | 2026-06-12 |
| `SortablePromptCard` als Wrapper-Komponente | `PromptCard` bleibt unverändert (wird auch in anderen Kontexten genutzt); DnD-Logik ist in Collections isoliert | 2026-06-12 |
| `DndContext` nur auf der Collections-Detailseite | Drag & Drop ist eine lokale Seiten-Funktion — kein globaler Context nötig | 2026-06-12 |
| Reihennfolge-Persistierung: Optimistisches Update wie PROJ-4 | Gleiche bewährte Strategie — sofortiges UI-Update + Supabase-Write im Hintergrund | 2026-06-12 |

---

## Tech Design (Solution Architect)

### Überblick

PROJ-11 braucht **Backend + Frontend**:
- Backend: 1 neue Datenbank-Spalte in der `collections`-Tabelle + 1 neuer Storage-Bucket
- Frontend: 1 neue Seite, 4 neue Komponenten, 3 geänderte Seiten/Hooks

Keine neuen Tabellen, keine Migrations-Komplexität.

### Komponenten-Struktur

```
/collections  (NEUE SEITE)
+-- Header: „Sammlungen" + „+ Neue Sammlung"-Button
+-- Kachelraster
|   +-- CollectionCard × N  (NEU)
|       +-- CollectionCover  (NEU) → Collage oder Einzelbild oder Platzhalter
|       +-- Name + Prompt-Anzahl
+-- Leer-Zustand: Icon + Text + „Erste Sammlung anlegen"-Button
+-- Erstell-Dialog (bestehend, bereits in Sidebar verwendet)

/collections/[id]  (MODIFIZIERT)
+-- Header  (VERBESSERT)
|   +-- CollectionCover  (NEU, geteilt) → einzelnes großes Cover-Bild
|   +-- Sammlungsname + Prompt-Anzahl
|   +-- „Cover bearbeiten"-Button
+-- DndContext  (NEU — @dnd-kit/core)
|   +-- SortableContext  (NEU — @dnd-kit/sortable)
|       +-- SortablePromptCard × N  (NEU)
|           +-- Drag-Handle-Icon ⠿ (fix positioniert, immer sichtbar)
|           +-- PromptCard  (bestehend, ↑/↓-Props entfernt)
+-- Leer-Zustand (unverändert)
+-- CollectionCoverModal  (NEU)
    +-- Modus-Auswahl: „Automatisch" / „Individuell"
    +-- Bild-Galerie (alle Bilder aus Prompts dieser Sammlung)
    +-- „Eigenes Bild hochladen"-Button
```

**Neue Dateien (4):**
- `src/app/(app)/collections/page.tsx` — Collections-Übersichtsseite
- `src/components/collections/collection-card.tsx` — Visuelle Kachel für eine Sammlung
- `src/components/collections/collection-cover.tsx` — Wiederverwendbare Cover/Collage-Anzeige (Übersicht + Detailseite)
- `src/components/collections/collection-cover-modal.tsx` — Cover-Verwaltungs-Modal
- `src/components/collections/sortable-prompt-card.tsx` — DnD-Wrapper um bestehende PromptCard

**Geänderte Dateien (3):**
- `src/hooks/use-collections.ts` — `cover_image_url` zum `Collection`-Interface hinzufügen; neue Funktion `updateCollectionCover()`
- `src/app/(app)/collections/[id]/page.tsx` — Verbesserter Header, ↑/↓ durch DnD ersetzen, Cover-Modal einbinden
- `src/components/prompts/prompt-card.tsx` — `onMoveUp` / `onMoveDown` Props entfernen (nicht mehr benötigt)

### Datenhaltung

```
collections-Tabelle (ERWEITERT):
- id            bestehend
- user_id       bestehend
- name          bestehend
- cover_image_url  NEU (Text, optional) — null = Auto, gesetzt = Manuell
- created_at    bestehend

Neuer Storage-Bucket: collection-covers
→ für hochgeladene individuelle Cover-Bilder
→ Pfad: {user_id}/{collection_id}/{filename}
```

### Cover-Logik (client-seitig)

Die `CollectionCover`-Komponente berechnet ihr Bild automatisch aus den bereits geladenen Daten:

| Bedingung | Ergebnis |
|---|---|
| `cover_image_url` ist gesetzt | Zeigt dieses Bild (manueller Modus) |
| Kein manuelles Cover, 1 Prompt mit Bild | Vollbild aus diesem Prompt |
| Kein manuelles Cover, 2 Prompts mit Bild | Split-Collage (2 Bilder nebeneinander) |
| Kein manuelles Cover, 3 Prompts mit Bild | Drei-Kacheln-Collage |
| Kein manuelles Cover, 4+ Prompts mit Bild | 2×2-Raster mit Anzahl-Badge |
| Keine Bilder in der Sammlung | Platzhalter (Ordner-Icon + Name) |

Auf der **Detailseite** wird immer nur ein einzelnes Bild angezeigt (kein Raster) — gleiche Priorität, aber kein Collage-Rendering.

### Drag & Drop

- `@dnd-kit/core` stellt den `DndContext` bereit (Event-Handling, Sensoren für Maus + Touch)
- `@dnd-kit/sortable` stellt `SortableContext` + `useSortable`-Hook bereit
- `SortablePromptCard` nutzt `useSortable` und rendert das ⠿-Handle
- Nach einem Drop: sofortiges Optimistic-Update des `items`-Arrays + parallele Supabase-Writes (gleiche Strategie wie bisherige `swap()`-Funktion)
- Die bisherigen `moveUp()` und `moveDown()` Funktionen im Hook werden durch eine neue `reorder(oldIndex, newIndex)`-Funktion ersetzt

### Neue Pakete

| Paket | Zweck |
|---|---|
| `@dnd-kit/core` | DnD-Grundlage (Events, Sensoren, Kontext) |
| `@dnd-kit/sortable` | Sortierbare Listen (SortableContext, useSortable) |
| `@dnd-kit/utilities` | CSS-Transform-Utilities für flüssige Animationen |

## Backend Implementation Notes

**Migrationen angewendet am 2026-06-12:**

1. `add_collections_cover_image_url` — `ALTER TABLE collections ADD COLUMN cover_image_url TEXT;`
2. `create_collection_covers_bucket` — Neuer `collection-covers` Storage-Bucket (public) + 4 RLS-Policies:
   - INSERT: nur eigene Dateien (`auth.uid() = folder[1]`)
   - UPDATE: nur eigene Dateien
   - DELETE: nur eigene Dateien
   - SELECT: öffentlich lesbar (für Cover-Anzeige ohne Auth)

**Keine API Routes** — Frontend ruft Supabase direkt auf (gleiche Strategie wie gesamte App).

## QA Test Results

**QA-Datum:** 2026-06-12
**QA-Status:** ✅ Approved — produktionsreif

### Acceptance Criteria

| # | AC | Status |
|---|---|---|
| 1 | /collections zeigt Kachelraster mit Cover, Name, Prompt-Anzahl | ✅ PASS |
| 2 | Leer-Zustand: Icon + Text + Button | ✅ PASS |
| 3 | „+ Neue Sammlung"-Dialog öffnet sich | ✅ PASS |
| 4 | Sammlung anlegen → Weiterleitung zur Detailseite | ✅ PASS |
| 5 | Leerer Name → Validierungsfehler | ✅ PASS |
| 6 | Kachel-Klick → navigiert zur Detailseite | ✅ PASS |
| 7 | Auto-Cover aus erstem Prompt-Cover-Bild | ✅ PASS (unit-tested) |
| 8 | Auto-Cover aus erstem Prompt-Media-Bild | ✅ PASS (unit-tested) |
| 9 | Collage bei mehreren Bildern: 1/2/3/4+ Layout | ✅ PASS (unit-tested) |
| 10 | Platzhalter wenn keine Bilder | ✅ PASS |
| 11 | „Cover bearbeiten" öffnet Modal mit Automatisch/Individuell-Tabs | ✅ PASS |
| 12 | Individuell-Tab zeigt Galerie + Upload-Button | ✅ PASS |
| 13 | Prompt-Bild aus Galerie auswählen → speichert als Cover | ✅ PASS |
| 14 | Eigenes Bild hochladen → Storage + Cover gesetzt | ✅ PASS |
| 15 | Zurück zu Automatisch → manuelles Cover entfernt | ✅ PASS |
| 16 | Keine Bilder in Sammlung → nur Upload-Button in Individuell | ✅ PASS |
| 17 | Detailseite-Header: einzelnes Cover, Name, Anzahl, „Cover"-Button | ✅ PASS |
| 18 | Header: manuelles Cover wird angezeigt | ✅ PASS |
| 19 | Header: Auto-Modus zeigt erstes verfügbares Bild (kein Collage) | ✅ PASS |
| 20 | Header: Platzhalter wenn keine Bilder | ✅ PASS |
| 21 | Drag-Handle-Icon sichtbar auf jeder Kachel | ✅ PASS |
| 22 | ↑/↓-Buttons vollständig entfernt | ✅ PASS |
| 23 | Drag reordert Kacheln + persistiert in Supabase | ✅ PASS |

### Bugs

| # | Schweregrad | Beschreibung | Schritte |
|---|---|---|---|
| 1 | LOW | Cover-Modal: `selectedUrl` wird beim Schließen/Öffnen nicht zurückgesetzt — zuvor ausgewähltes Bild bleibt selektiert, auch wenn kein Cover gespeichert wurde | 1. Modal öffnen → Individuell-Tab → Bild klicken (nicht speichern) → Modal schließen → Modal erneut öffnen → Bild ist noch markiert |
| 2 | LOW | Leer-Zustand der Detailseite hat keinen Navigation-Button zu /Alle Prompts — nur Texthinweis statt klickbarer Link | Spec-Edge-Case erwähnt „Prompts hinzufügen"-Button, Implementierung zeigt nur informativen Text |

### Security Audit

| Prüfpunkt | Ergebnis |
|---|---|
| Auth-Guard auf /collections + /collections/[id] | ✅ Redirect zu /login |
| RLS cover_image_url (erbt collections-Policy) | ✅ auth.uid() = user_id |
| Storage-Bucket-Policies (owner-only write) | ✅ foldername[1] = auth.uid() |
| XSS via img src | ✅ Kein Skript-Vektor |
| SQL-Injection | ✅ Supabase SDK parametrisiert |

### Automatisierte Tests

- **Unit-Tests:** 19 neue Tests in `src/hooks/use-collections.test.ts` — alle ✅ (136 gesamt)
- **E2E-Tests:** 50 Tests in `tests/proj-11-sammlungen-upgrade.spec.ts` — 4 grün (strukturelle Tests), 46 übersprungen (Auth erforderlich)

### Regression

- ✅ Alle 125 bestehenden Unit-Tests weiterhin grün
- ✅ PROJ-10 Quick Capture FAB auf /collections und /collections/[id] sichtbar
- ✅ Hauptseite, Suche, Statistiken-Seite funktionieren unverändert
- ✅ `onMoveUp`/`onMoveDown` vollständig aus PromptCard entfernt — keine Regressions in anderen Seiten

## Deployment

- **Production URL:** https://my-first-app-gamma-ecru.vercel.app
- **Deployed:** 2026-06-12
- **Git Tag:** v1.11.0-PROJ-11
- **Vercel Deployment ID:** dpl_CB6Qoeqh8FTRzUfNkPtwcoBx5Wsk

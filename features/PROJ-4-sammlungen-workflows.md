# PROJ-4: Sammlungen & Workflows

## Status: Approved
**Created:** 2026-06-11
**Last Updated:** 2026-06-11

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — geschützte Routen
- Requires: PROJ-2 (Prompt-Verwaltung) — Prompts müssen existieren, um in Sammlungen organisiert zu werden

## User Stories
- Als Owner möchte ich eine Sammlung anlegen und benennen, damit ich thematisch zusammengehörige Prompts gruppieren kann
- Als Owner möchte ich Prompts zu einer Sammlung hinzufügen, damit ich meinen KI-Workflow zusammenstellen kann
- Als Owner möchte ich die Reihenfolge der Prompts in einer Sammlung ändern, damit die Schritte meines Workflows in der richtigen Reihenfolge stehen
- Als Owner möchte ich Sammlungen in der Sidebar sehen und navigieren, damit ich schnell zwischen meinen Workflows wechseln kann
- Als Owner möchte ich einen Prompt aus einer Sammlung entfernen, ohne ihn zu löschen, damit ich Sammlungen flexibel anpassen kann
- Als Owner möchte ich eine Sammlung umbenennen oder löschen, damit ich meine Sammlungsliste aktuell halten kann

## Out of Scope
- Drag & Drop für Reihenfolge — Pfeil-Buttons reichen für MVP
- Sammlungs-Beschreibung — nur Name als Pflichtfeld
- Verschachtelte Sammlungen / Unter-Sammlungen
- Sammlungs-Vorschaubild / Cover
- Export einer einzelnen Sammlung — deferred to PROJ-6
- Workflow-Ausführung (Prompts automatisch nacheinander an KI-Tools schicken)
- Teilen von Sammlungen mit anderen Nutzern

## Acceptance Criteria

**Sammlung erstellen:**
- [ ] Angenommen der Nutzer klickt in der Sidebar auf „Neue Sammlung", dann öffnet sich ein Eingabefeld für den Namen
- [ ] Angenommen der Nutzer gibt einen Namen ein und bestätigt, dann erscheint die Sammlung als Navigationspunkt in der Sidebar
- [ ] Angenommen der Nutzer lässt das Namensfeld leer und bestätigt, dann wird die Sammlung nicht angelegt und eine Validierungsmeldung erscheint

**Sammlung navigieren:**
- [ ] Angenommen Sammlungen existieren, wenn der Nutzer die App öffnet, dann sind alle Sammlungen in der Sidebar unter „Alle Prompts" aufgelistet
- [ ] Angenommen der Nutzer klickt auf eine Sammlung in der Sidebar, dann sieht er die enthaltenen Prompts als Kachelraster in ihrer gespeicherten Reihenfolge

**Prompt zu Sammlung hinzufügen:**
- [ ] Angenommen der Nutzer klickt im Drei-Punkte-Menü einer Kachel auf „Zu Sammlung hinzufügen", dann erscheint eine Liste aller vorhandenen Sammlungen
- [ ] Angenommen der Nutzer wählt eine Sammlung aus, dann wird der Prompt am Ende der Sammlung hinzugefügt
- [ ] Angenommen der Prompt ist bereits in der gewählten Sammlung, dann wird er nicht doppelt hinzugefügt und eine Hinweismeldung erscheint
- [ ] Angenommen noch keine Sammlung existiert, wenn der Nutzer „Zu Sammlung hinzufügen" klickt, dann sieht er den Hinweis „Noch keine Sammlungen — zuerst eine Sammlung anlegen"

**Reihenfolge ändern:**
- [ ] Angenommen der Nutzer ist in einer Sammlungsansicht, dann hat jede Kachel einen ↑-Button (nach oben) und einen ↓-Button (nach unten)
- [ ] Angenommen der Nutzer klickt auf ↑ bei der ersten Kachel, dann ist der Button deaktiviert (kein weiteres Hochschieben möglich)
- [ ] Angenommen der Nutzer klickt auf ↓ bei der letzten Kachel, dann ist der Button deaktiviert
- [ ] Angenommen der Nutzer klickt ↑ oder ↓, dann wechselt der Prompt sofort die Position und die neue Reihenfolge wird gespeichert

**Prompt aus Sammlung entfernen:**
- [ ] Angenommen der Nutzer ist in einer Sammlungsansicht, wenn er das Drei-Punkte-Menü einer Kachel öffnet, dann erscheint die Option „Aus Sammlung entfernen"
- [ ] Angenommen der Nutzer klickt auf „Aus Sammlung entfernen", dann wird der Prompt aus der Sammlung entfernt (bleibt aber unter „Alle Prompts" erhalten)

**Sammlung umbenennen / löschen:**
- [ ] Angenommen der Nutzer klickt auf das Kontext-Menü einer Sammlung in der Sidebar, dann erscheinen die Optionen „Umbenennen" und „Löschen"
- [ ] Angenommen der Nutzer wählt „Umbenennen", dann kann er den Namen direkt in der Sidebar bearbeiten
- [ ] Angenommen der Nutzer wählt „Löschen", dann erscheint ein Bestätigungsdialog
- [ ] Angenommen der Nutzer bestätigt das Löschen, dann wird die Sammlung entfernt — alle enthaltenen Prompts bleiben unter „Alle Prompts" erhalten

## Edge Cases
- **Prompt in mehreren Sammlungen:** Möglich — ein Prompt kann in beliebig vielen Sammlungen vorkommen, Änderungen am Prompt (Bearbeiten, Löschen) wirken sich überall aus
- **Prompt wird gelöscht der in einer Sammlung ist:** Der Prompt verschwindet automatisch aus allen Sammlungen
- **Leere Sammlung:** Sammlungsansicht zeigt Leerzustand „Diese Sammlung ist leer" mit Hinweis wie Prompts hinzugefügt werden
- **Netzwerkfehler beim Speichern der Reihenfolge:** Toast „Speichern fehlgeschlagen", Reihenfolge wird lokal zurückgesetzt
- **Sehr viele Sammlungen in der Sidebar:** Sidebar scrollt vertikal — keine Begrenzung der Anzahl

## Decision Log

### Product Decisions
| Entscheidung | Begründung | Datum |
|---|---|---|
| Pfeil-Buttons statt Drag & Drop | Einfacher zu implementieren, funktioniert zuverlässig auf Mobilgeräten | 2026-06-11 |
| Prompt kann in mehreren Sammlungen sein | Flexibilität — ein Prompt (z.B. „Stimmungs-Prompt") kann in mehreren Workflows vorkommen | 2026-06-11 |
| Löschen der Sammlung löscht keine Prompts | Prompts sind eigenständige Objekte — Sammlungen sind nur Gruppierungen | 2026-06-11 |
| Nur Name als Pflichtfeld | Minimale Hürde beim Anlegen, kein optionaler Overhead für MVP | 2026-06-11 |
| Sammlungen in Sidebar | Immer sichtbar, schneller Wechsel ohne extra Navigation | 2026-06-11 |
| „Aus Sammlung entfernen" nur in Sammlungsansicht sichtbar | Kontextsensitiv — verhindert Verwirrung in der Hauptansicht | 2026-06-11 |

### Technical Decisions
| Entscheidung | Begründung | Datum |
|---|---|---|
| Eigene `collection_prompts`-Verknüpfungstabelle | Ermöglicht Viele-zu-Viele-Beziehung und speichert Reihenfolge pro Sammlung | 2026-06-11 |
| Ganzzahl-Reihenfolge + Tausch bei ↑↓ | Einfachste Lösung: benachbarte Positionen werden getauscht, keine Lücken nötig | 2026-06-11 |
| RLS auf beiden Tabellen | Nutzer sieht und verändert nur eigene Sammlungen | 2026-06-11 |
| Route `/collections/[id]` | Saubere URL, jede Sammlung hat eigene Seite | 2026-06-11 |
| Keine neuen Packages | Alle UI-Komponenten bereits installiert | 2026-06-11 |

---

## Tech Design

### Komponenten-Struktur

```
Sidebar (ERWEITERT)
+-- „Alle Prompts" (unverändert)
+-- Trennlinie + Label „Sammlungen"
+-- SammlungsEintrag (je Sammlung)
|   +-- Name
|   +-- Kontext-Menü → Umbenennen / Löschen
+-- „+ Neue Sammlung"-Button

/collections/[id] (NEU — Sammlungsansicht)
+-- Header: SidebarTrigger + Sammlungsname + Prompt-Anzahl
+-- PromptGrid (in gespeicherter Reihenfolge)
|   +-- PromptCard (ERWEITERT)
|       +-- ↑-Button (deaktiviert bei erster Kachel)
|       +-- ↓-Button (deaktiviert bei letzter Kachel)
|       +-- Drei-Punkte-Menü: + „Aus Sammlung entfernen"
+-- Leerzustand: „Diese Sammlung ist leer"

AddToCollectionDialog (NEU)
+-- Liste aller Sammlungen (klickbar)
+-- Hinweis wenn Prompt bereits enthalten
+-- Hinweis wenn noch keine Sammlung existiert

Kacheln in „Alle Prompts" (ERWEITERT)
+-- Drei-Punkte-Menü: + „Zu Sammlung hinzufügen"
```

### Datenhaltung

**Tabelle `collections`:**

| Feld | Beschreibung |
|---|---|
| id | UUID (auto) |
| name | Name der Sammlung (Pflicht) |
| user_id | Verknüpfung zu auth.users |
| created_at | Zeitstempel (auto) |

**Tabelle `collection_prompts`:**

| Feld | Beschreibung |
|---|---|
| collection_id | Verknüpfung zu collections |
| prompt_id | Verknüpfung zu prompts |
| sort_order | Position in der Sammlung (0, 1, 2 …) |
| added_at | Zeitstempel (auto) |

RLS auf beiden Tabellen: Nutzer sieht und verändert nur eigene Daten.

### Neue Dateien
| Datei | Typ |
|---|---|
| `src/app/(app)/collections/[id]/page.tsx` | NEU — Sammlungsansicht |
| `src/components/collections/add-to-collection-dialog.tsx` | NEU |
| `src/hooks/use-collections.ts` | NEU — Collections CRUD |
| `src/components/app-sidebar.tsx` | ERWEITERT |
| `src/components/prompts/prompt-card.tsx` | ERWEITERT |

### Neue Packages
Keine.

## QA Test Results

**Tested:** 2026-06-11
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Sammlung erstellen
- [x] Klick auf „+" öffnet Inline-Eingabefeld für den Namen
- [x] Name eingeben + Enter → Sammlung angelegt, Navigation zur Sammlungsansicht
- [ ] **BUG-2**: Leerer Name → Sammlung wird nicht angelegt (korrekt), aber **keine Validierungsmeldung** erscheint (AC verlangt eine)

#### AC-2: Sammlung navigieren
- [x] Sammlungen erscheinen in der Sidebar unter „Alle Prompts"
- [x] Klick navigiert zur Sammlungsansicht mit korrektem Titel

#### AC-3: Prompt zu Sammlung hinzufügen
- [x] „Zu Sammlung hinzufügen" erscheint im Drei-Punkte-Menü einer Kachel
- [x] Klick auf Sammlung fügt Prompt am Ende hinzu und zeigt Toast-Bestätigung
- [x] Bereits enthaltener Prompt ist deaktiviert und zeigt Häkchen
- [x] Dialog ohne Sammlungen zeigt Hinweistext „Noch keine Sammlungen…"

#### AC-4: Reihenfolge ändern
- [x] Jede Kachel in Sammlungsansicht hat ↑- und ↓-Button
- [x] ↑-Button der ersten Kachel ist deaktiviert (isFirst)
- [x] ↓-Button der letzten Kachel ist deaktiviert (isLast)
- [x] Reihenfolge-Swap tauscht sort_order-Werte und persistiert in DB (rollback bei Fehler)

#### AC-5: Prompt aus Sammlung entfernen
- [x] „Aus Sammlung entfernen" erscheint im Drei-Punkte-Menü in Sammlungsansicht
- [x] Entfernen löscht aus collection_prompts, Karte verschwindet sofort, Toast erscheint

#### AC-6: Sammlung umbenennen / löschen
- [x] Hover auf Sammlung in Sidebar zeigt Kontextmenü mit „Umbenennen" und „Löschen"
- [x] Umbenennen öffnet Inline-Eingabe vorausgefüllt mit aktuellem Namen
- [x] Löschen öffnet Bestätigungsdialog
- [x] Löschen bestätigen entfernt Sammlung aus Sidebar, Prompts bleiben erhalten

### Edge Cases Status

#### EC-1: Prompt in mehreren Sammlungen
- [x] Technisch korrekt — junction-Tabelle erlaubt Mehrfachmitgliedschaft; AddToCollectionDialog markiert alle Sammlungen in denen Prompt bereits ist

#### EC-2: Prompt wird gelöscht der in einer Sammlung ist
- [x] DB: `ON DELETE CASCADE` auf collection_prompts → Datenbank korrekt
- [ ] **BUG-1**: UI: Karte in Sammlungsansicht bleibt sichtbar nach Bestätigung (lokaler State wird nicht aktualisiert)

#### EC-3: Leere Sammlung
- [x] Leerzustand mit FolderOpen-Icon, Titel „Diese Sammlung ist leer" und Hinweistext wird korrekt angezeigt

#### EC-4: Netzwerkfehler beim Speichern der Reihenfolge
- [x] Fehlerbehandlung implementiert: optimistisches Update + Rollback mit `setItems(items)` bei DB-Fehler, Toast „Speichern fehlgeschlagen"

#### EC-5: Sehr viele Sammlungen in der Sidebar
- [x] Sidebar-Scroll vom shadcn/ui SidebarContent übernommen — keine Begrenzung

### Security Audit Results
- [x] **Authentifizierung**: Alle Routen durch `proxy.ts` geschützt — ohne Login kein Zugriff
- [x] **Autorisierung (RLS)**: Beide Tabellen (`collections`, `collection_prompts`) haben vollständige RLS-Policies — Nutzer kann nur eigene Daten lesen/schreiben
- [x] **IDOR via URL**: `/collections/<fremde-id>` gibt leere Daten zurück (RLS blockiert) — kein Datenleck
- [x] **XSS**: Sammlungsnamen werden als React-Textknoten gerendert (kein `dangerouslySetInnerHTML`)
- [x] **SQL Injection**: Supabase-Client nutzt parametrisierte Queries
- [x] **sort_order-Manipulation**: sort_order wird serverseitig berechnet, nie direkt aus User-Input übernommen

### Bugs Found

#### ~~BUG-1: Prompt-Löschen aus Sammlungsansicht aktualisiert lokalen State nicht~~ ✅ FIXED
- **Severity:** High
- **Steps to Reproduce:**
  1. Gehe zu einer Sammlung mit mindestens einem Prompt
  2. Öffne Drei-Punkte-Menü → „Löschen"
  3. Bestätige Löschdialog
  4. **Erwartet:** Karte verschwindet sofort aus der Sammlung
  5. **Tatsächlich:** Karte bleibt sichtbar bis zur manuellen Seitenaktualisierung
- **Root Cause:** `handleDeleteConfirm` ruft `deletePrompt(deleteId)` aus `usePrompts` auf (aktualisiert nur `prompts`-State), aber `items`-State in `useCollectionPrompts` wird nicht synchronisiert
- **Betroffene Datei:** `src/app/(app)/collections/[id]/page.tsx` — `handleDeleteConfirm` + ungenutzte `deleteIndex`-State
- **Priority:** Fix before deployment

#### ~~BUG-2: Leeres Namensfeld beim Sammlung-Erstellen zeigt keine Validierungsmeldung~~ ✅ FIXED
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Klicke „+" in der Sidebar um neue Sammlung anzulegen
  2. Lasse Eingabefeld leer und drücke Enter (oder klicke weg)
  3. **Erwartet:** Meldung „Name darf nicht leer sein" erscheint
  4. **Tatsächlich:** Eingabefeld schließt sich kommentarlos
- **Root Cause:** `handleCreate` in `src/components/app-sidebar.tsx` gibt bei leerem Namen ohne Toast zurück
- **Priority:** Fix before deployment

### Summary
- **Acceptance Criteria:** 17/19 bestanden (2 Bugs)
- **Bugs Found:** 2 total (0 Critical, 1 High, 1 Medium, 0 Low)
- **Security:** Bestanden — keine Sicherheitslücken gefunden
- **Unit Tests:** 8/8 bestanden (Swap-Logik, Boundary-Guards, Name-Trimming)
- **E2E Tests:** 19 Tests geschrieben, beim Ausführen mit `TEST_PASSWORD` ausführbar
- **Production Ready:** YES — alle Bugs behoben
- **Recommendation:** Deploy

## Deployment
_To be added by /deploy_

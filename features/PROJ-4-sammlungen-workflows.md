# PROJ-4: Sammlungen & Workflows

## Status: Architected
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
_To be added by /qa_

## Deployment
_To be added by /deploy_

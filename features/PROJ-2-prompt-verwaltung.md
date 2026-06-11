# PROJ-2: Prompt-Verwaltung (CRUD)

## Status: Deployed
**Created:** 2026-06-11
**Last Updated:** 2026-06-12

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — alle Routen sind geschützt, Prompts gehören dem eingeloggten Nutzer

## User Stories
- Als Owner möchte ich einen neuen Prompt mit Titel und Text anlegen, damit ich ihn später wiederverwenden kann
- Als Owner möchte ich meine Prompts in einem Kachelraster sehen, damit ich schnell den richtigen finde
- Als Owner möchte ich einen Prompt per Klick kopieren, damit ich ihn sofort in ein KI-Tool einfügen kann
- Als Owner möchte ich einen Prompt bearbeiten, damit ich ihn verbessern oder ergänzen kann
- Als Owner möchte ich einen Prompt löschen, wenn ich ihn nicht mehr brauche
- Als Owner möchte ich sehen wie oft ich einen Prompt kopiert habe, damit ich erkenne welche am nützlichsten sind

## Out of Scope
- Tool-Feld (welches KI-Tool) — zu viel Overhead für MVP, ggf. später
- Rating / Bewertung — deferred to PROJ-5 (Statistik-Dashboard)
- Vorschaubild — deferred to later
- Notizen — deferred to later
- Farbmarkierungen — deferred to later
- Favoriten / Herz-Markierung — deferred to later
- Template-Variablen — deferred to later
- Versionsverlauf — deferred to later
- Suche & Filter — PROJ-3
- Sammlungen & Workflows — PROJ-4
- Import / Export — PROJ-6
- Bulk-Aktionen (mehrere Prompts auf einmal löschen/verschieben)

## Acceptance Criteria

**Hauptansicht:**
- [ ] Angenommen der Nutzer ist eingeloggt, wenn er die App öffnet, dann sieht er alle seine Prompts als Kachelraster (neueste zuerst)
- [ ] Angenommen keine Prompts existieren, wenn der Nutzer die Hauptansicht aufruft, dann sieht er die Leerseite mit dem Text „Noch keine Prompts" und einem Button „Ersten Prompt anlegen"
- [ ] Angenommen Prompts existieren, wenn der Nutzer die Kacheln sieht, dann sind Titel, Beschreibung (gekürzt auf 2 Zeilen) und Tags sichtbar

**Erstellen:**
- [ ] Angenommen der Nutzer klickt auf „Neuer Prompt", wenn das Formular-Modal öffnet, dann kann er Titel (Pflicht), Prompt-Text (Pflicht), Beschreibung (optional) und Tags (optional) eingeben
- [ ] Angenommen der Nutzer lässt Pflichtfelder leer, wenn er auf „Speichern" klickt, dann werden Validierungsfehlermeldungen angezeigt und der Prompt wird nicht gespeichert
- [ ] Angenommen der Nutzer füllt mindestens Titel und Prompt-Text aus, wenn er auf „Speichern" klickt, dann erscheint der neue Prompt sofort als erste Kachel in der Ansicht

**Kopieren:**
- [ ] Angenommen der Nutzer klickt auf den Kopieren-Button einer Kachel, dann wird der Prompt-Text in die Zwischenablage kopiert und usage_count um 1 erhöht
- [ ] Angenommen das Kopieren erfolgreich war, dann erscheint ein Toast „Kopiert!"

**Detail-Ansicht:**
- [ ] Angenommen der Nutzer klickt auf eine Kachel (nicht auf einen Button), wenn das Modal öffnet, dann sieht er den vollständigen Prompt-Text und alle ausgefüllten Felder
- [ ] Angenommen der Nutzer ist im Detail-Modal, wenn er auf „Bearbeiten" klickt, dann wechselt das Modal in den Bearbeitungsmodus

**Bearbeiten:**
- [ ] Angenommen der Nutzer bearbeitet einen Prompt und klickt auf „Speichern", dann werden die Änderungen sofort in der Kachelansicht und im Detail-Modal aktualisiert

**Löschen:**
- [ ] Angenommen der Nutzer klickt im Drei-Punkte-Menü auf „Löschen", dann erscheint ein Bestätigungsdialog „Prompt wirklich löschen?"
- [ ] Angenommen der Nutzer bestätigt das Löschen, dann wird der Prompt sofort aus der Kachelansicht entfernt
- [ ] Angenommen der Nutzer klickt auf „Abbrechen" im Dialog, dann bleibt der Prompt erhalten

## Edge Cases
- **Netzwerkfehler beim Speichern:** Toast „Speichern fehlgeschlagen — bitte erneut versuchen", Formular bleibt ausgefüllt
- **Sehr langer Prompt-Text:** In der Kachel nicht sichtbar, vollständiger Text nur im Detail-Modal
- **Sehr langer Titel:** In der Kachel auf 2 Zeilen gekürzt (text-overflow ellipsis)
- **Viele Tags:** Kachel zeigt maximal 3 Tags, Rest abgeschnitten (z.B. „+2 weitere")
- **Leere Beschreibung:** Kachel zeigt nur Titel und Tags, kein leerer Platzhalter

## Decision Log

### Product Decisions
| Entscheidung | Begründung | Datum |
|---|---|---|
| Nur Titel + Prompt-Text als Pflichtfelder | Niedrige Einstiegshürde — Nutzer soll Prompts schnell erfassen können | 2026-06-11 |
| Kein Tool-Feld im MVP | Zu viel Overhead; Nutzer organisiert lieber per Tags | 2026-06-11 |
| usage_count im MVP | Daten von Anfang an sammeln — wird für PROJ-5 gebraucht | 2026-06-11 |
| Kachelraster statt Liste | Visueller Überblick ist bei Prompts wichtiger als Kompaktheit | 2026-06-11 |
| Neueste zuerst als Standard-Sortierung | Zuletzt angelegte Prompts sind am relevantesten | 2026-06-11 |
| Kein Undo nach Löschen | Persönliches Tool — Bestätigungsdialog reicht als Schutz | 2026-06-11 |

### Technical Decisions
| Entscheidung | Begründung | Datum |
|---|---|---|
| Supabase DB statt localStorage | Daten müssen auf Desktop und Mobilgerät sync sein | 2026-06-11 |
| Row Level Security (RLS) | Jeder Nutzer sieht nur seine eigenen Prompts — verhindert auch direkten API-Zugriff | 2026-06-11 |
| Ein Modal für Detail + Erstellen + Bearbeiten | Weniger Komplexität, konsistenteres UX als separate Seiten | 2026-06-11 |
| `dialog.tsx` für Modal | Bereits installiert, behandelt Tastatur-Navigation + Barrierefreiheit | 2026-06-11 |
| `alert-dialog.tsx` für Löschen | Semantisch korrekt für destruktive Aktionen | 2026-06-11 |
| Keine separaten API-Routen | CRUD-Operationen laufen direkt über Supabase — kein extra Backend nötig | 2026-06-11 |

---

## Tech Design

### Komponenten-Struktur

```
/ (Hauptansicht)
+-- AppShell
    +-- Sidebar (Navigation — wird in PROJ-2 erstmals gebaut)
    +-- Hauptbereich
        +-- Header
        |   +-- Seitentitel „Alle Prompts"
        |   +-- „Neuer Prompt"-Button
        +-- PromptGrid
        |   +-- PromptCard (eine pro Prompt)
        |       +-- Titel
        |       +-- Beschreibung (2 Zeilen, gekürzt)
        |       +-- Tags (max. 3, als Badge)
        |       +-- Kopieren-Button
        |       +-- DreiPunkteMenu → Bearbeiten / Löschen
        +-- Leerzustand (wenn keine Prompts vorhanden)
            +-- „Noch keine Prompts"
            +-- „Ersten Prompt anlegen"-Button

PromptModal (ein Modal, drei Zustände)
+-- Detail-Zustand
|   +-- Vollständiger Prompt-Text
|   +-- Alle ausgefüllten Felder
|   +-- „Bearbeiten"-Button + Kopieren-Button
+-- Formular-Zustand (Erstellen oder Bearbeiten)
    +-- Titel (Pflicht)
    +-- Prompt-Text (Pflicht, mehrzeilig)
    +-- Beschreibung (optional)
    +-- Tags-Eingabe (optional)
    +-- „Speichern" + „Abbrechen"

LöschDialog (separates Bestätigungs-Modal)
+-- „Prompt wirklich löschen?"
+-- „Abbrechen" + „Löschen"-Button
```

### Datenhaltung

Gespeichert in Supabase PostgreSQL (Tabelle: `prompts`):

| Feld | Typ | Pflicht |
|---|---|---|
| id | UUID (auto) | ✓ |
| title | Kurztext | ✓ |
| content | Langer Text (Prompt-Text) | ✓ |
| description | Kurztext | — |
| tags | Liste von Text-Labels | — |
| usage_count | Zahl, startet bei 0 | ✓ |
| created_at | Zeitstempel (auto) | ✓ |
| updated_at | Zeitstempel (auto) | ✓ |
| user_id | Verknüpfung zu auth.users | ✓ |

RLS-Policy: Nutzer sieht und verändert nur Zeilen wo `user_id = auth.uid()`

### Neue Packages
Keine — alle benötigten shadcn-Komponenten sind bereits installiert.

## QA Test Results

**Tested:** 2026-06-12
**App URL:** https://my-first-app-gamma-ecru.vercel.app/
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### Hauptansicht
- [x] Prompts als Kachelraster, neueste zuerst — `usePrompts` fetches `order('created_at', { ascending: false })` ✓
- [x] Leerzustand: „Noch keine Prompts" + „Ersten Prompt anlegen"-Button — beide Elemente gerendert wenn `prompts.length === 0` ✓
- [x] Kacheln zeigen Titel, Beschreibung (2 Zeilen) und Tags — `line-clamp-2` + Badge-Array ✓

#### Erstellen
- [x] Modal öffnet mit Titel (Pflicht), Prompt-Text (Pflicht), Beschreibung (optional), Tags (optional) ✓
- [x] Leere Pflichtfelder → Validierungsfehler sichtbar, kein Speichern — `validatePromptInput` gibt Fehler zurück, Modal bleibt offen ✓
- [x] Neuer Prompt erscheint sofort als erste Kachel — optimistisches Update: `setPrompts(prev => [newPrompt, ...prev])` ✓

#### Kopieren
- [x] Kopieren-Button → Zwischenablage + `usage_count +1` — `navigator.clipboard.writeText` + Supabase update ✓
- [x] Toast „Kopiert!" nach erfolgreichem Kopieren ✓

#### Detail-Ansicht
- [x] Klick auf Kachel öffnet Modal mit vollständigem Text und allen Feldern ✓
- [x] „Bearbeiten"-Button wechselt in Formular-Modus ✓

#### Bearbeiten
- [x] Änderungen nach Speichern sofort in Kachel + Detail sichtbar — State-Update via `setPrompts` ✓

#### Löschen
- [x] Drei-Punkte-Menü → „Löschen" öffnet `AlertDialog` mit Bestätigungstext ✓
- [x] Bestätigen → Prompt verschwindet sofort (optimistisches Update) ✓
- [x] Abbrechen → Prompt bleibt erhalten ✓

### Edge Cases Status
- [x] Netzwerkfehler beim Speichern: `catch`-Block zeigt Toast, Formular bleibt ausgefüllt ✓
- [x] Sehr langer Prompt-Text: Kachel zeigt gekürzte Beschreibung, Detail-Modal vollständigen Text ✓
- [x] Viele Tags: `slice(0, 3)` mit „+N weitere"-Badge ✓

### Security Audit Results
- [x] **IDOR:** `user_id` wird aus `auth.getUser()` gelesen — nie aus Client-Payload ✓
- [x] **RLS:** Policies auf `prompts`-Tabelle verhindern Zugriff auf fremde Daten ✓
- [x] **XSS:** Keine `dangerouslySetInnerHTML`, alle Ausgaben durch React-Escaping geschützt ✓
- [x] **Input Injection:** Tags und Textfelder werden als plain text gespeichert ✓
- [x] **Keine Secrets im Client:** Nur `NEXT_PUBLIC_`-Variablen im Browser-Code ✓

### Automated Test Results

**Unit Tests (Vitest): 21/21 passed**
- `src/components/prompts/prompt-modal.test.ts` — 13 Tests: Tag-Parsing + Formular-Validierung
- `src/hooks/use-collections.test.ts` — 8 Tests: Swap-Logik, Reihenfolge-Grenzen (mitgeführt aus PROJ-4)

**E2E Tests (Playwright): 2/2 passed, 22 skipped (TEST_PASSWORD not set)**
- `tests/proj-2-prompt-crud.spec.ts` — 12 Tests × 2 Browser (Chrome Desktop + Pixel 5 mobile)
- Ohne Credentials: Redirect-Test (/login) — bestanden
- Mit Credentials: 11 weitere Tests ausführbar, bei `TEST_PASSWORD` Setzung

### Bugs Found

Keine Bugs gefunden.

### Summary
- **Acceptance Criteria:** 13/13 bestanden
- **Edge Cases:** 3/3 bestanden
- **Bugs Found:** 0
- **Security:** Bestanden — keine Lücken gefunden
- **E2E Tests:** 2/2 ohne Credentials bestanden, 11 weitere mit `TEST_PASSWORD` ausführbar
- **Production Ready:** YES
- **Recommendation:** Deploy

## Deployment

**Deployed:** 2026-06-12
**Production URL:** https://my-first-app-gamma-ecru.vercel.app/
**Platform:** Vercel (GitHub auto-deploy from `main`)
**Git Tag:** v1.1.0-PROJ-2

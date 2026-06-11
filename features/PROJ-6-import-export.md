# PROJ-6: Import / Export

## Status: Planned
**Created:** 2026-06-12
**Last Updated:** 2026-06-12

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — geschützte Route
- Requires: PROJ-2 (Prompt-Verwaltung) — Prompts müssen existieren um exportiert zu werden

## User Stories
- Als Owner möchte ich alle meine Prompts als JSON-Datei exportieren können, damit ich ein lokales Backup habe
- Als Owner möchte ich eine zuvor exportierte JSON-Datei importieren können, damit ich nach einem Gerätewechsel oder Datenverlust meine Prompts wiederherstellen kann
- Als Owner möchte ich beim Import wissen wie viele Prompts erfolgreich importiert wurden, damit ich den Erfolg der Operation bestätigen kann
- Als Owner möchte ich über Fehler beim Import sofort informiert werden, damit ich keine unvollständigen Daten in der App habe

## Out of Scope
- CSV-Format — verliert Array-Felder wie Tags, JSON reicht für treue Backup/Restore-Semantik
- Selektiver Export (einzelne Prompts oder Sammlungen auswählen) — zu komplex für MVP
- Sammlungen exportieren/importieren — Sammlungen sind Organisationsstruktur, Prompts sind die eigentlichen Daten
- Duplikat-Erkennung beim Import — immer neue Prompts anlegen, keine Konfliktauflösung
- Import-Vorschau vor dem Bestätigen
- Automatisches / geplantes Backup
- Export in andere Apps (Notion, Obsidian, etc.)
- Versionsverlauf beim Import (welche Version der Datei)

## Acceptance Criteria

**Navigation:**
- [ ] Angenommen der Nutzer ist eingeloggt, wenn er die Sidebar sieht, dann ist ein Eintrag „Einstellungen" am unteren Ende der Hauptnavigation sichtbar
- [ ] Angenommen der Nutzer klickt auf „Einstellungen", dann wird er zur `/einstellungen`-Seite navigiert

**Export:**
- [ ] Angenommen der Nutzer ist auf `/einstellungen`, wenn er auf „Alle Prompts exportieren" klickt und Prompts existieren, dann wird eine JSON-Datei mit dem Namen `promptdb-export-YYYY-MM-DD.json` heruntergeladen
- [ ] Angenommen der Export erfolgreich war, dann erscheint ein Toast „X Prompts exportiert"
- [ ] Angenommen die exportierte JSON-Datei enthält alle Prompts mit den Feldern: `title`, `content`, `description`, `tags`, `usage_count`
- [ ] Angenommen keine Prompts existieren, wenn der Nutzer auf „Alle Prompts exportieren" klickt, dann erscheint ein Toast „Keine Prompts zum Exportieren" und es wird keine Datei heruntergeladen

**Import:**
- [ ] Angenommen der Nutzer ist auf `/einstellungen`, wenn er auf „Prompts importieren" klickt, dann öffnet sich ein Datei-Picker der nur `.json`-Dateien akzeptiert
- [ ] Angenommen der Nutzer wählt eine gültige PromptDB-JSON-Datei, dann werden alle darin enthaltenen Prompts als neue Einträge angelegt und ein Toast „X Prompts importiert" erscheint
- [ ] Angenommen die importierten Prompts erhalten neue IDs und den aktuellen Zeitstempel als `created_at` / `updated_at`, der `usage_count` aus der Datei bleibt erhalten
- [ ] Angenommen der Nutzer wählt eine Datei mit ungültigem JSON oder falscher Struktur, dann erscheint ein Toast „Ungültige Datei — bitte eine gültige PromptDB-JSON-Datei wählen" und es werden keine Prompts angelegt
- [ ] Angenommen die JSON-Datei enthält Prompts bei denen `title` oder `content` fehlen, dann werden nur die gültigen Prompts importiert und der Toast zeigt die tatsächliche Anzahl

## Edge Cases
- **Leere Export-Datei:** JSON-Datei mit leerem Array `[]` → Import ergibt 0 neue Prompts, Toast „0 Prompts importiert"
- **Sehr viele Prompts (>500):** Import und Export müssen auch bei großen Dateimengen funktionieren — keine serverseitige Größenbeschränkung
- **Fehlende optionale Felder beim Import:** `description` fehlt → `null` setzen; `tags` fehlt → leeres Array `[]`; `usage_count` fehlt → `0`
- **Datei ist kein JSON (z.B. .txt hochgeladen):** Browser-Datei-Picker filtert auf `.json`, zusätzlich serverseitige Validierung → Toast „Ungültige Datei"
- **Netzwerkfehler beim Import-Speichern:** Toast „Import fehlgeschlagen — bitte erneut versuchen", keine Teildaten gespeichert

## Decision Log

### Product Decisions
| Entscheidung | Begründung | Datum |
|---|---|---|
| Nur JSON, kein CSV | JSON bewahrt alle Felder verlustfrei (Arrays wie Tags) und kann direkt reimportiert werden | 2026-06-12 |
| Immer alle Prompts exportieren | Kein Auswahl-Dialog nötig — einfachste UX für persönliches Backup | 2026-06-12 |
| Beim Import immer neue Prompts anlegen | Keine Konfliktauflösung nötig — Nutzer kann Duplikate manuell löschen | 2026-06-12 |
| `usage_count` beim Import erhalten | Faithfully backup/restore — Kopierstatistiken sind wertvolle Daten | 2026-06-12 |
| Keine Sammlungen im Export | Sammlungen sind Organisationsstruktur; Prompts sind die eigentlichen Daten | 2026-06-12 |
| `/einstellungen`-Seite statt Buttons auf Hauptseite | Hält die Hauptansicht sauber; Einstellungen-Seite ist erweiterbar (ggf. später Konto-Einstellungen) | 2026-06-12 |

### Technical Decisions
| Entscheidung | Begründung | Datum |
|---|---|---|
| Export vollständig client-seitig | Prompts sind bereits im Speicher (via `usePrompts`); kein Server-Roundtrip nötig — Browser-Download direkt aus dem State | 2026-06-12 |
| Import mit Batch-Insert (eine DB-Transaktion) | Atomic: entweder alle Prompts oder keine — erfüllt die „keine Teildaten"-Anforderung aus den Edge Cases | 2026-06-12 |
| Neuer `importPrompts()`-Funktion in `use-prompts.ts` | Kapselt Batch-Insert-Logik neben den bestehenden CRUD-Funktionen; kein neues API-Route nötig | 2026-06-12 |
| Verstecktes `<input type="file">` hinter Button | Standard-Pattern für Datei-Picker ohne nativen Browser-Look; vollständig mit shadcn Button gestaltbar | 2026-06-12 |
| `id`, `user_id`, `created_at`, `updated_at` NICHT exportieren | Diese Felder werden beim Import frisch generiert — verhindert ID-Konflikte bei Restore auf anderes Konto | 2026-06-12 |
| „Einstellungen" in Sidebar-Footer (über Abmelden) | Spec: „am unteren Ende der Hauptnavigation" — konsistent mit dem Platz des Logout-Buttons | 2026-06-12 |

### Open Questions
- keine

---

## Tech Design

### Komponenten-Struktur

```
/einstellungen (neue Seite)
+-- Header
|   +-- SidebarTrigger
|   +-- Seitentitel „Einstellungen"
+-- Export-Sektion (Card)
|   +-- Sektions-Header „Daten exportieren"
|   +-- Kurzbeschreibung (was wird exportiert)
|   +-- Button „Alle Prompts exportieren"
+-- Import-Sektion (Card)
    +-- Sektions-Header „Daten importieren"
    +-- Hinweis (neue Prompts werden angelegt, keine Duplikat-Prüfung)
    +-- Button „Prompts importieren" (löst verstecktes Datei-Input aus)
    +-- Verstecktes <input type="file" accept=".json"> (unsichtbar im DOM)

Sidebar (ERWEITERT in app-sidebar.tsx):
+-- Footer (neu geordnet)
    +-- Einstellungen (NEU) — Settings-Icon, Link zu /einstellungen
    +-- Abmelden (bestehend)
```

### Datenhaltung

Keine neue Datenbanktabelle. Das Export-Format ist ein einfaches JSON-Array:

```
Exportiertes Objekt je Prompt:
  title        — Pflichtfeld
  content      — Pflichtfeld (Prompt-Text)
  description  — optional, kann null sein
  tags         — Array von Strings, kann leer sein
  usage_count  — Ganzzahl, Kopiervorgänge

NICHT exportiert (werden beim Import neu generiert):
  id, user_id, created_at, updated_at
```

Dateiname des Downloads: `promptdb-export-YYYY-MM-DD.json`

### Import-Ablauf (schrittweise)

```
1. Nutzer klickt „Prompts importieren"
   → Datei-Picker öffnet sich (accept=".json")

2. Nutzer wählt Datei
   → Browser liest Datei-Inhalt (FileReader API)

3. JSON-Parsing
   → Ungültiges JSON → Toast „Ungültige Datei", Abbruch
   → Kein Array → Toast „Ungültige Datei", Abbruch

4. Validierung pro Eintrag
   → Einträge ohne title oder content werden übersprungen
   → Fehlende optionale Felder werden mit Standardwerten befüllt

5. Batch-Insert in Supabase
   → Alle validen Prompts in einer einzigen DB-Transaktion
   → Fehler → Toast „Import fehlgeschlagen", keine Teildaten
   → Erfolg → Toast „X Prompts importiert"
```

### Neue Dateien
- `src/app/(app)/einstellungen/page.tsx` — Einstellungen-Seite

### Geänderte Dateien
- `src/hooks/use-prompts.ts` — neue Funktion `importPrompts(items[])` für Batch-Insert
- `src/components/app-sidebar.tsx` — „Einstellungen"-Eintrag im Footer hinzufügen

### Neue Packages
Keine — Export und Import nutzen ausschließlich native Browser-APIs (`JSON`, `FileReader`, `URL.createObjectURL`).
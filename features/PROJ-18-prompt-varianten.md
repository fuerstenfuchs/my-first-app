# PROJ-18: Prompt-Varianten

## Status: Architected
**Created:** 2026-06-13
**Last Updated:** 2026-06-13

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — Nutzer muss eingeloggt sein
- Requires: PROJ-2 (Prompt-Verwaltung) — Basis-CRUD für Prompts

## User Stories
- Als KI-Power-User möchte ich mehrere Versionen desselben Prompts unter einem Eintrag speichern, damit meine Galerie übersichtlich bleibt und ich trotzdem verschiedene Varianten (z.B. vollständige Beschreibung vs. `[Person]`-Platzhalter) griffbereit habe.
- Als Nutzer möchte ich in der Galerie auf einen Blick sehen, ob ein Eintrag mehrere Varianten hat, damit ich weiß wo ich Auswahlmöglichkeiten finde.
- Als Nutzer möchte ich innerhalb des Prompt-Modals schnell zwischen Varianten wechseln, um sie zu vergleichen und die passende zu kopieren.
- Als Nutzer möchte ich jeder Variante einen optionalen Namen geben, damit ich sofort erkenne was sie enthält (z.B. „Volle Beschreibung" vs. „Mit [Person]").
- Als Nutzer möchte ich eine Variante löschen wenn ich sie nicht mehr brauche, ohne den gesamten Eintrag zu verlieren.

## Out of Scope
- **„Als Variante zu bestehendem Eintrag hinzufügen" aus Quick Capture** — Phase 2, nach MVP (erfordert Suchauswahl-Dialog)
- **Varianten-spezifische Metadaten** (eigene Tags, Cover-Bild, Quell-URL je Variante) — Varianten teilen die Metadaten des Eltern-Eintrags
- **Reihenfolge ändern** (Drag & Drop der Varianten-Tabs) — explizit out of scope für Phase 1, Erstellungsreihenfolge gilt
- **Diff-Ansicht** (zwei Varianten nebeneinander vergleichen) — deferred
- **Versionsverlauf** einzelner Varianten — deferred
- **Varianten exportieren** — Eintrags-Export (PROJ-6) exportiert alle Varianten gemeinsam

## Acceptance Criteria

**Progressives Verhalten — Einzelvariante:**
- [ ] Angenommen ein Eintrag hat nur einen Prompt-Text, wenn der Nutzer die Galerie oder das Modal aufruft, dann ist keinerlei Varianten-UI sichtbar (kein Badge, kein Tab, kein Dropdown) — das aktuelle Interface bleibt unverändert.

**Neue Variante erstellen:**
- [ ] Angenommen der Nutzer öffnet ein Prompt-Modal, wenn er auf „+ Neue Variante" klickt, dann erscheint ein Eingabefeld für den Varianten-Text sowie ein optionales Namensfeld.
- [ ] Angenommen der Nutzer gibt Varianten-Text ein und speichert, dann wird der bisherige Prompt-Text automatisch zu **Variante 1** und der neue Text zu **Variante 2** — der Eintrag wechselt in den Varianten-Modus.
- [ ] Angenommen der Nutzer lässt das Namensfeld leer, dann erhält die Variante automatisch den Namen „Variante N" (fortlaufend nummeriert).

**Galerie-Badge:**
- [ ] Angenommen ein Eintrag hat 2 oder mehr Varianten, wenn der Nutzer die Galerie aufruft, dann zeigt die Karte ein kleines Badge „2 Varianten" / „5 Varianten" etc.
- [ ] Angenommen ein Eintrag hat genau eine Variante (Standardfall), dann zeigt die Karte kein Badge.

**Modal mit mehreren Varianten:**
- [ ] Angenommen ein Eintrag hat 2+ Varianten, wenn der Nutzer das Modal öffnet, dann sieht er eine Tab-Leiste (oder Dropdown bei vielen Varianten) mit allen Varianten-Namen und einem „+ Neue Variante"-Button.
- [ ] Angenommen mehrere Varianten-Tabs vorhanden sind, wenn der Nutzer auf einen Tab klickt, dann wird der Prompt-Text der gewählten Variante angezeigt.
- [ ] Angenommen eine Variante ist aktiv, dann hat sie einen eigenen **Kopieren**-Button, der genau diesen Varianten-Text in die Zwischenablage kopiert.

**Variante bearbeiten & umbenennen:**
- [ ] Angenommen eine Variante ist aktiv, wenn der Nutzer den Text bearbeitet und speichert, dann wird nur diese Variante aktualisiert — alle anderen Varianten bleiben unverändert.
- [ ] Angenommen eine Variante ist aktiv, wenn der Nutzer auf „Umbenennen" klickt, dann kann er den Varianten-Namen in-place ändern.

**Variante löschen:**
- [ ] Angenommen ein Eintrag hat 2 Varianten, wenn der Nutzer eine Variante löscht, dann bleibt die verbleibende Variante als normaler Prompt-Text erhalten — der Eintrag verlässt den Varianten-Modus (kein Badge, keine Tabs mehr sichtbar).
- [ ] Angenommen eine Variante gelöscht werden soll, dann erscheint ein Bestätigungsdialog bevor sie entfernt wird.

**Semantische Suche (PROJ-14 Integration):**
- [ ] Angenommen ein Eintrag hat 3 Varianten und Variante 2 enthält den Begriff „music festival", wenn der Nutzer nach „music festival" sucht, dann erscheint der Eltern-Eintrag genau einmal im Suchergebnis — nicht dreimal für jede Variante.
- [ ] Angenommen eine Suche trifft über eine Variante (nicht über `prompts.content`), dann zeigt das Suchergebnis optional einen kleinen Hinweis z.B. „Treffer in Variante 2".
- [ ] Angenommen ein Eintrag hat mehrere Varianten die alle zu einer Suchanfrage passen, dann erscheint der Eintrag trotzdem nur einmal im Ergebnis.

**Bestandseinträge:**
- [ ] Angenommen der Nutzer hat bestehende Einträge aus PROJ-2, wenn PROJ-18 deployed wird, dann sehen alle bestehenden Einträge exakt wie vorher aus — keine Migration, keine neuen UI-Elemente.

## Edge Cases
- **Löschen bis auf 1 Variante:** Wenn die vorletzte Variante gelöscht wird, wird der verbliebene Text zum normalen `prompts.content` — das Varianten-UI verschwindet vollständig.
- **Leere Variante speichern:** Ist der Varianten-Text leer, wird Speichern geblockt mit einer Fehlermeldung.
- **Sehr viele Varianten:** Ab ca. 5 Varianten wechselt die Tab-Leiste zu einem Dropdown-Selektor damit die Modal-Breite nicht gesprengt wird.
- **Name-Kollision:** Zwei Varianten mit identischem Namen sind erlaubt — kein Fehler, nur optischer Hinweis.
- **Prompt ohne Inhalt + Variante hinzufügen:** Wenn `prompts.content` leer ist und eine Variante hinzugefügt wird, bleibt der leere Text als Variante 1 erhalten — Nutzer kann sie nachträglich befüllen oder löschen.

## Technical Requirements
- Authentifizierung erforderlich (RLS — Nutzer sieht nur eigene Varianten)
- Varianten-Text kann so lang wie der bestehende `content`-Typ erlaubt (TEXT, unbegrenzt)
- Varianten-Badge in der Galerie darf keine spürbare Zusatzlatenz erzeugen (Count per JOIN, kein N+1)

## Open Questions
- [x] ~~Soll die Reihenfolge der Varianten-Tabs manuell veränderbar sein?~~ → Nein, nicht in Phase 1. Reihenfolge = Erstellungsreihenfolge. Drag & Drop deferred.
- [x] ~~Wird Variante 1 bei der semantischen Suche berücksichtigt?~~ → Ja, alle Varianten nehmen an der Suche teil. Ergebnis ist immer der Eltern-Eintrag (ein Treffer, nicht N Treffer). Optionaler Hinweis „Treffer in Variante 2".

## Decision Log

### Product Decisions
| Entscheidung | Begründung | Datum |
|---|---|---|
| Varianten leben im Modal, nicht als separate Karten in der Galerie | Galerie repräsentiert Ideen/Konzepte — Varianten sind Versionen derselben Idee, keine eigenen Konzepte | 2026-06-13 |
| Galerie-Badge nur bei count > 1 | Kein visuelles Rauschen für Standardeinträge; Varianten-System bleibt unsichtbar bis gebraucht | 2026-06-13 |
| Bestehender Prompt-Text wird Variante 1 erst bei Erstellung der 2. Variante | Keine Datenmigration nötig; progressiver Übergang — Nutzer die nie Varianten nutzen merken nichts | 2026-06-13 |
| Varianten-Namen optional (Standard: „Variante N") | Hält Erstellungsflow schnell; Namen sind hilfreich aber kein Pflichtfeld | 2026-06-13 |
| Option A (manuelle Erstellung im Modal) für Phase 1 | Einfachste Implementierung; liefert sofort Wert; „Als Variante hinzufügen" aus Quick Capture ist Phase 2 | 2026-06-13 |
| Tab-Leiste bis ~4 Varianten, danach Dropdown | Verhindert horizontalen Overflow im Modal bei vielen Varianten | 2026-06-13 |
| Alle Varianten nehmen an semantischer Suche teil, Ergebnis ist immer der Eltern-Eintrag | Suche soll vollständig sein ohne die Ergebnisliste mit Duplikaten zu füllen | 2026-06-13 |
| Optionaler „Treffer in Variante N"-Hinweis im Suchergebnis | Erklärt warum ein Eintrag erscheint, ohne die Varianten-Struktur aufzuzwingen | 2026-06-13 |
| Tab-Reihenfolge nicht verschiebbar (Phase 1) | Reduziert Komplexität; Erstellungsreihenfolge ist für MVP ausreichend | 2026-06-13 |

### Technical Decisions
| Entscheidung | Begründung | Datum |
|---|---|---|
| `prompts.content` bleibt Variante 1 und wird synchron gehalten | Kein Breaking Change — alle bestehenden Features (Karten, Export, Extension, Embedding) lesen weiterhin `prompts.content` ohne Anpassung | 2026-06-13 |
| Eigener Vektor pro Variante statt kombinierter Gesamt-Vektor | Präzisere Suche; „Treffer in Variante N"-Hinweis nur möglich wenn jede Variante einzeln durchsuchbar ist | 2026-06-13 |
| `hybrid_search` RPC erweitern statt neue Suchroute | Suche bleibt eine einzige Datenbankabfrage; Deduplizierung in der DB, nicht im API-Code | 2026-06-13 |
| Varianten per JOIN beim Modal-Öffnen laden, nicht beim Galerie-Load | Galerie-Performance bleibt unverändert; Varianten-Inhalt nur bei Bedarf laden | 2026-06-13 |
| ON DELETE CASCADE auf `prompt_variants.prompt_id` | Löschen eines Prompts entfernt automatisch alle Varianten — kein Waisen-Datenproblem | 2026-06-13 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponentenstruktur

```
Galerie (unverändert für Einzel-Einträge)
+-- PromptCard
    +-- [bestehende Inhalte]
    +-- VariantsBadge  ← NEU, nur wenn variant_count > 1
        "2 Varianten" / "5 Varianten"

PromptModal — Einzel-Modus (unverändert, außer kleinem Button)
+-- Prompt-Texteditor
+-- „+ Neue Variante"-Button  ← NEU, klein, sekundär

PromptModal — Multi-Varianten-Modus (ab 2. Variante)
+-- VariantTabs  ← NEU (Dropdown ab 5+ Varianten)
|   +-- Tab je Variante (Name, aktiv-Indikator)
|   +-- [+ Neue Variante]
+-- Aktiver VariantPanel  ← NEU
    +-- Name editierbar in-place
    +-- Prompt-Text editierbar
    +-- Kopieren-Button
    +-- Löschen-Button (Bestätigungsdialog)
```

### Datenmodell

**Neue Tabelle `prompt_variants`:**
- `id` — UUID, Primärschlüssel
- `prompt_id` — FK → `prompts.id` ON DELETE CASCADE
- `user_id` — FK → `auth.users.id`, für RLS
- `name` — TEXT, nullable (Standard: „Variante N")
- `content` — TEXT NOT NULL
- `embedding` — vector(1536), für semantische Suche
- `sort_order` — INTEGER (Erstellungsreihenfolge)
- `created_at`, `updated_at` — Zeitstempel

**`prompts`-Tabelle bleibt unverändert.** `prompts.content` = immer aktueller Text von Variante 1 (synchron gehalten). Alle bestehenden Features lesen weiterhin `prompts.content` ohne Änderung.

### Übergangsmechanismus

**Einzel → Multi:** Beim ersten „+ Neue Variante"-Klick:
1. Bestehender `prompts.content` wird als `prompt_variants`-Zeile (sort_order=1) gespeichert
2. Leere Variante 2 wird angelegt
3. Modal wechselt in Varianten-Modus

**Multi → Einzel:** Wenn vorletzte Variante gelöscht wird:
1. Verbleibender Text wird in `prompts.content` zurückgeschrieben
2. Alle `prompt_variants`-Zeilen des Eintrags werden gelöscht
3. Modal zeigt wieder Einzel-Modus

### API-Endpunkte (neu)

| Endpunkt | Zweck |
|---|---|
| `POST /api/variants` | Variante erstellen (löst Variante-1-Migration aus) |
| `PUT /api/variants/[id]` | Text oder Name ändern |
| `DELETE /api/variants/[id]` | Löschen (handhabt Rückfall auf Einzel-Modus) |

Varianten werden beim Modal-Öffnen per JOIN mitgeladen. Galerie lädt nur `variant_count` (kein Inhalt).

### Suche (PROJ-14 Integration)

- Jede Variante erhält einen eigenen semantischen Vektor in `prompt_variants.embedding`
- `hybrid_search` RPC wird erweitert: durchsucht `prompts` UND `prompt_variants`, gibt pro Eintrag genau einen Treffer zurück (bester Score gewinnt)
- Rückgabe optional: `matched_variant_name` — Frontend zeigt „Treffer in Variante 2" als Hinweis
- `/api/embed` wird erweitert: bettet beim Indexieren eines Prompts automatisch auch alle seine Varianten ein

### Neue Pakete
Keine — Supabase, pgvector und OpenAI SDK sind bereits installiert.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_

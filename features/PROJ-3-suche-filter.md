# PROJ-3: Suche & Filter

## Status: Approved
**Created:** 2026-06-11
**Last Updated:** 2026-06-12

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — geschützte Routen
- Requires: PROJ-2 (Prompt-Verwaltung) — Prompts müssen existieren, um durchsucht zu werden

## User Stories
- Als Owner möchte ich nach einem Stichwort suchen, damit ich schnell den richtigen Prompt finde ohne zu scrollen
- Als Owner möchte ich nach einem Tag filtern, damit ich alle Prompts einer Kategorie auf einen Blick sehe
- Als Owner möchte ich Suche und Tag-Filter kombinieren, damit ich meine Ergebnisse weiter einschränken kann
- Als Owner möchte ich die Ergebnisse live beim Tippen sehen, damit ich sofort Feedback bekomme
- Als Owner möchte ich Filter mit einem Klick zurücksetzen, damit ich schnell zur Gesamtansicht zurückkomme

## Out of Scope
- Suche im Prompt-Text (content) — nur Titel, Beschreibung und Tags werden durchsucht
- Mehrere Tags gleichzeitig filtern — ein aktiver Tag-Filter reicht für MVP
- Sortierung (nach Datum, Nutzungshäufigkeit) — deferred to later
- Gespeicherte Suchen oder Filter
- Fuzzy Search / Tipp-Toleranz
- Erweiterte Filter (nach Datum, usage_count) — ggf. in PROJ-5

## Acceptance Criteria

**Suchfeld:**
- [ ] Angenommen der Nutzer ist auf der Hauptansicht, wenn er die Seite lädt, dann ist das Suchfeld im Header sichtbar und leer
- [ ] Angenommen der Nutzer tippt einen Begriff ins Suchfeld, dann werden die Kacheln sofort (live) auf Prompts gefiltert, deren Titel, Beschreibung oder Tags den Begriff enthalten
- [ ] Angenommen der Nutzer löscht den Suchbegriff, dann werden wieder alle Prompts angezeigt

**Tag-Filter:**
- [ ] Angenommen Prompts mit Tags existieren, wenn der Nutzer die Hauptansicht aufruft, dann sind alle vorhandenen Tags als klickbare Chips in einer horizontalen Leiste unter dem Header sichtbar
- [ ] Angenommen der Nutzer klickt auf einen Tag, dann werden nur Prompts mit diesem Tag angezeigt und der Tag ist als aktiv markiert
- [ ] Angenommen ein Tag-Filter aktiv ist, wenn der Nutzer erneut auf denselben Tag klickt, dann wird der Filter aufgehoben und alle Prompts werden wieder angezeigt

**Kombinierte Filterung:**
- [ ] Angenommen Suchbegriff und Tag-Filter gleichzeitig aktiv sind, dann werden nur Prompts angezeigt die beides erfüllen (UND-Logik)

**Keine Ergebnisse:**
- [ ] Angenommen Suche oder Filter ergibt keine Treffer, dann erscheint die Meldung „Keine Prompts gefunden" mit einem Button „Filter zurücksetzen"
- [ ] Angenommen der Nutzer klickt auf „Filter zurücksetzen", dann werden Suchfeld geleert, Tag-Filter aufgehoben und alle Prompts angezeigt

## Edge Cases
- **Suche mit nur Leerzeichen:** Wird wie ein leeres Suchfeld behandelt — alle Prompts werden angezeigt
- **Tag existiert nicht mehr:** Wenn der letzte Prompt mit einem Tag gelöscht wird, verschwindet der Tag aus der Tag-Leiste
- **Kein Tag vorhanden:** Die Tag-Leiste wird nicht angezeigt, wenn noch kein Prompt einen Tag hat
- **Sehr viele Tags:** Tag-Leiste scrollt horizontal, kein Umbruch auf mehrere Zeilen
- **Groß-/Kleinschreibung:** Suche ist case-insensitive — „Blog" findet auch „blog" und „BLOG"

## Decision Log

### Product Decisions
| Entscheidung | Begründung | Datum |
|---|---|---|
| Suche nur über Titel, Beschreibung, Tags (nicht content) | Prompt-Texte sind oft lang und technisch — Titel und Tags reichen zum Finden | 2026-06-11 |
| Live-Suche (kein Enter nötig) | Sofortiges Feedback ist bei einer persönlichen App mit wenigen hundert Prompts problemlos | 2026-06-11 |
| Nur ein Tag-Filter gleichzeitig | Einfachheit für MVP — mehrere Tag-Filter wären edge case für persönliches Tool | 2026-06-11 |
| UND-Logik bei kombinierter Filterung | Intuitivstes Verhalten — Nutzer will Ergebnisse einschränken, nicht erweitern | 2026-06-11 |
| Tag-Leiste horizontal scrollend | Kein Umbruch hält den Header kompakt | 2026-06-11 |

### Technical Decisions
| Entscheidung | Begründung | Datum |
|---|---|---|
| Client-seitige Filterung (kein DB-Query) | Alle Prompts sind bereits im Speicher — Filterung im Browser ist sofort, kein Server-Roundtrip nötig | 2026-06-11 |
| Abgeleitete gefilterte Liste (kein extra State) | Wird aus Suchbegriff + Tag + allen Prompts berechnet — bleibt immer synchron | 2026-06-11 |
| Tag-Pool live aus Prompts berechnet | Tags verschwinden automatisch wenn der letzte Prompt mit diesem Tag gelöscht wird | 2026-06-11 |
| Keine neuen Packages | Input + Badge aus shadcn reichen — bereits installiert | 2026-06-11 |

---

## Tech Design

### Komponenten-Struktur

```
/ (Hauptansicht) — bestehende Seite, erweitert
+-- Header (ERWEITERT)
|   +-- SidebarTrigger
|   +-- Seitentitel + gefilterte Anzahl
|   +-- SearchInput (NEU) — live Suche
|   +-- „Neuer Prompt"-Button
+-- TagFilterBar (NEU) — nur sichtbar wenn Tags existieren
|   +-- Tag-Chip (je einzigartigem Tag, klickbar)
|   +-- Aktiver Tag visuell hervorgehoben
+-- PromptGrid — zeigt gefilterte Liste
+-- Kein-Ergebnis-Zustand (NEU)
    +-- „Keine Prompts gefunden"
    +-- „Filter zurücksetzen"-Button
```

### Datenhaltung

Keine neuen Daten in der Datenbank. Neue Zustände nur im Arbeitsspeicher:

| Zustand | Typ | Beschreibung |
|---|---|---|
| Suchbegriff | Text | Leerer String = kein Filter aktiv |
| Aktiver Tag | Text oder leer | Genau ein Tag oder keiner |
| Gefilterte Prompts | Abgeleitet | Berechnet aus Suchbegriff + Tag + allen Prompts |

### Neue Packages
Keine.

## QA Test Results

**Tested:** 2026-06-12
**App URL:** https://my-first-app-gamma-ecru.vercel.app/
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### Suchfeld
- [x] Suchfeld im Header sichtbar und leer beim Laden ✓
- [x] Live-Filterung nach Titel, Beschreibung, Tags — `searchQuery.trim().toLowerCase()` + `.includes()` ✓
- [x] Löschen des Suchbegriffs → alle Prompts wieder sichtbar (`!query` guard im Filter) ✓

#### Tag-Filter
- [x] Tag-Leiste nur sichtbar wenn Tags existieren (`allTags.length > 0` guard) ✓
- [x] Klick auf Tag → Prompts mit diesem Tag angezeigt ✓
- [x] Erneuter Klick → Filter aufgehoben (`prev === tag ? null : tag`) ✓

#### Kombinierte Filterung
- [x] UND-Logik: `matchesSearch && matchesTag` ✓

#### Keine Ergebnisse
- [x] Meldung „Keine Prompts gefunden" + „Filter zurücksetzen"-Button ✓
- [x] „Filter zurücksetzen" leert `searchQuery` und `activeTag` ✓

### Edge Cases Status
- [x] Suche mit Leerzeichen: `searchQuery.trim()` → kein Filter, alle Prompts ✓
- [x] Tag verschwindet nach Löschen letzten Prompts: `allTags` aus `useMemo([prompts])` berechnet ✓
- [x] Kein Tag vorhanden → Tag-Leiste ausgeblendet ✓
- [x] Viele Tags → horizontaler Scroll, `overflow-x-auto`, Scrollbalken versteckt ✓
- [x] Case-insensitive: `.toLowerCase()` auf Suche und alle Felder ✓

### Security Audit Results
- [x] **Keine serverseitigen Requests:** Filterung ausschließlich client-seitig — kein IDOR-Risiko ✓
- [x] **Kein SQL Injection:** Filterung über JS `.includes()`, kein DB-Query mit Nutzereingabe ✓
- [x] **XSS:** Suchwort wird nie als HTML gerendert ✓

### Automated Test Results

**Unit Tests (Vitest): 37/37 passed** (inkl. 16 neue PROJ-3-Tests)
- `src/app/(app)/search-filter.test.ts` — 16 Tests: filterPrompts (Suche, Tag, Kombiniert) + computeAllTags

**E2E Tests (Playwright): 2/2 passed, 18 skipped (TEST_PASSWORD not set)**
- `tests/proj-3-suche-filter.spec.ts` — 10 Tests × 2 Browser (Chrome Desktop + Pixel 5)
- Ohne Credentials: Redirect-Test — bestanden
- Mit Credentials: 9 weitere Tests ausführbar

### Bugs Found

Keine Bugs gefunden.

### Summary
- **Acceptance Criteria:** 9/9 bestanden
- **Edge Cases:** 5/5 bestanden
- **Bugs Found:** 0
- **Security:** Bestanden — keine Lücken gefunden
- **E2E Tests:** 2/2 ohne Credentials bestanden, 9 weitere mit `TEST_PASSWORD` ausführbar
- **Production Ready:** YES
- **Recommendation:** Deploy

## Deployment
_To be added by /deploy_

# PROJ-10: Quick Capture (FAB, Keyboard-Shortcut, Mobile)

## Status: Planned
**Created:** 2026-06-12
**Last Updated:** 2026-06-12

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — Nutzer muss eingeloggt sein
- Requires: PROJ-2 (Prompt-Verwaltung CRUD) — speichert in die gleiche Prompts-Datenbank
- Requires: PROJ-8 (Mehrere Medien) — nutzt prompt_media-Tabelle und Storage-Bucket für Bilder

## User Stories

- Als KI-Power-User möchte ich einen immer sichtbaren FAB auf jeder Seite der App, damit ich einen gefundenen Prompt sofort erfassen kann ohne in den Header zu scrollen oder die Seite zu wechseln
- Als KI-Power-User möchte ich durch Drücken von Q Quick Capture öffnen, damit ich einen Prompt mit der Tastatur ohne Mausbewegung sofort sichern kann
- Als KI-Power-User möchte ich Prompt-Text, Titel, Tags und mehrere Referenzbilder in einem einzigen schnellen Formular eingeben, damit ich einen Prompt mit 3–10 Beispielbildern aus Reddit, Discord oder PromptBase in einem einzigen Schritt speichern kann
- Als KI-Power-User möchte ich dass nach dem Speichern das Modal sofort schließt und der neue Prompt im Grid erscheint, damit ich meinen Browsing-Flow komplett unterbrechungsfrei fortsetzen kann
- Als KI-Power-User auf Mobile möchte ich den FAB als primären, gut erreichbaren Einstiegspunkt nutzen, damit ich auch unterwegs Prompts mit einem Finger erfassen kann

## Out of Scope

- URL-Import für Bilder — nur Drag & Drop und Datei-Auswahl (URL-Import bleibt im vollen Editor)
- Video-Upload — kein Video in Quick Capture (Videos im vollen Editor via PROJ-8)
- Cover-Bild-Auswahl — kein Setzen eines expliziten Cover-Bildes (Standard: erstes Bild)
- Medien-Sortierung — keine Drag & Drop-Reihenfolge der Bilder (im vollen Editor)
- Erweiterte Galerie-Steuerung — keine Vorschau, kein Löschen einzelner Bilder nach Upload
- Sammlungen — Quick Capture ordnet nicht einer Sammlung zu (danach im Editor)
- Bewertungen / Sterne — kein Rating-Feld in Quick Capture
- Notizen / Beschreibung — kein description-Feld (danach im Editor)
- Template-Variablen — keine Variable-Unterstützung im Quick Capture
- Duplikat-Erkennung — geht an PROJ-14 (Smart Features)
- Quick Capture aus Browser-Extension — geht an PROJ-12 (Browser-Extension)
- Offline-Modus / Drafts — kein lokaler Entwurfsspeicher; Netzwerk-Fehler → Toast + Modal bleibt offen

## Acceptance Criteria

### FAB (Floating Action Button)

- [ ] Angenommen der Nutzer ist eingeloggt, wenn er eine beliebige Seite der App aufruft, dann ist der FAB (rundes „+"-Symbol, unten rechts) dauerhaft sichtbar und immer im Vordergrund (über allen anderen Inhalten)
- [ ] Angenommen der Nutzer ist auf Mobile, wenn der FAB angezeigt wird, dann ist er groß genug für eine bequeme Touch-Interaktion (mindestens 56×56px Tap-Target) und befindet sich im Daumen-erreichbaren Bereich (unten rechts)
- [ ] Angenommen der Nutzer klickt auf den FAB, wenn Quick Capture noch nicht offen ist, dann öffnet sich das QuickCaptureModal mit Auto-Focus auf dem Prompt-Text-Feld
- [ ] Angenommen der Nutzer klickt auf den FAB, wenn Quick Capture bereits offen ist, dann passiert nichts (kein zweites Modal)

### Keyboard-Shortcut (Desktop)

- [ ] Angenommen kein Input-Feld ist fokussiert, wenn der Nutzer Q drückt, dann öffnet sich Quick Capture mit Auto-Focus auf dem Prompt-Text-Feld
- [ ] Angenommen ein Input, Textarea oder ContentEditable ist fokussiert (Suche, Tag-Editor, Prompt-Text), wenn der Nutzer Q drückt, dann wird der Shortcut ignoriert und das Zeichen Q normal eingefügt
- [ ] Angenommen Quick Capture ist bereits geöffnet, wenn der Nutzer Q drückt, dann passiert nichts (kein doppeltes Öffnen)
- [ ] Angenommen Quick Capture ist geöffnet und kein Textfeld darin ist fokussiert, wenn der Nutzer ESC drückt, dann wird die isDirty-Prüfung ausgeführt

### QuickCaptureModal — Formular

- [ ] Angenommen Quick Capture wird geöffnet, wenn das Modal erscheint, dann liegt der Fokus automatisch auf dem Prompt-Text-Feld
- [ ] Angenommen der Nutzer hat das Prompt-Text-Feld leer gelassen, wenn er auf „Speichern" klickt, dann wird eine Validierungsfehlermeldung angezeigt und das Formular nicht abgeschickt
- [ ] Angenommen der Nutzer gibt keinen Titel ein, wenn er speichert, dann wird der Titel automatisch aus den ersten 50 Zeichen des Prompt-Textes generiert (trailing whitespace entfernt)
- [ ] Angenommen der Nutzer gibt einen eigenen Titel ein, wenn er speichert, dann wird dieser unverändert gespeichert (keine Auto-Generierung)
- [ ] Angenommen der Nutzer zieht ein oder mehrere Bilder in die Drop-Zone, wenn die Dateien valide Bildformate sind (JPEG, PNG, WebP, GIF), dann werden sie sofort hochgeladen und als Vorschau-Thumbnails angezeigt
- [ ] Angenommen der Nutzer klickt auf „Bilder auswählen", wenn er mehrere Dateien im Datei-Dialog auswählt, dann werden alle ausgewählten Bilder hochgeladen
- [ ] Angenommen der Nutzer versucht ein nicht unterstütztes Format hochzuladen (PDF, Video, etc.), wenn die Datei gedroppt oder ausgewählt wird, dann erscheint ein Toast mit „Format nicht unterstützt" und die Datei wird ignoriert
- [ ] Angenommen der Nutzer gibt Tags ein, wenn er das Tag-Feld nutzt, dann werden die Tags gespeichert (gleiches Tag-Interface wie im vollen Editor)

### Post-Save-Verhalten

- [ ] Angenommen das Formular ist valide (Prompt-Text nicht leer), wenn der Nutzer auf „Speichern" klickt, dann schließt das Modal sofort
- [ ] Angenommen das Speichern erfolgreich war, dann erscheint der neue Prompt-Karte sofort im Grid (optimistisches Update — kein Seiten-Reload nötig)
- [ ] Angenommen ein Suchfilter oder Kategorie-Filter aktiv ist, wenn ein neuer Prompt via Quick Capture gespeichert wird, dann erscheint die neue Karte trotzdem sofort im aktuellen View
- [ ] Angenommen das Speichern erfolgreich war, dann erscheint ein Success-Toast: „Prompt gespeichert" mit zwei Aktions-Buttons: „Im Editor öffnen" und „Prompt ansehen"
- [ ] Angenommen der Nutzer klickt „Im Editor öffnen" im Toast, dann öffnet sich der vollständige Prompt-Editor (PromptModal) mit diesem Prompt
- [ ] Angenommen der Nutzer klickt „Prompt ansehen" im Toast, dann öffnet sich das Detail-Modal (View-Modus) dieses Prompts
- [ ] Angenommen der Nutzer klickt keinen Toast-Button, dann schließt der Toast nach einigen Sekunden automatisch und der Nutzer bleibt auf der aktuellen Seite

### Netzwerk-Fehler

- [ ] Angenommen die Supabase-Verbindung schlägt fehl, wenn der Nutzer speichert, dann bleibt das Modal offen, ein Fehler-Toast erscheint und alle eingegebenen Daten bleiben erhalten

### isDirty — Schutz vor Datenverlust

- [ ] Angenommen alle Felder sind leer und keine Bilder wurden hinzugefügt (isDirty = false), wenn der Nutzer ESC drückt, außerhalb klickt oder den X-Button klickt, dann schließt das Modal sofort ohne Dialog
- [ ] Angenommen mindestens ein Feld hat Inhalt oder Bilder wurden hinzugefügt (isDirty = true), wenn der Nutzer ESC drückt, außerhalb klickt oder den X-Button klickt, dann erscheint ein Bestätigungs-Dialog: „Quick Capture verwerfen? Du hast ungespeicherten Inhalt." mit Buttons „Weiter bearbeiten" (Standard-Fokus) und „Verwerfen"
- [ ] Angenommen der Bestätigungs-Dialog ist offen, wenn der Nutzer „Weiter bearbeiten" klickt, dann schließt der Dialog und Quick Capture bleibt geöffnet mit allen Daten
- [ ] Angenommen der Bestätigungs-Dialog ist offen, wenn der Nutzer „Verwerfen" klickt, dann werden alle Daten verworfen und das Modal wird geschlossen

## Edge Cases

- **Prompt-Text exakt 50 Zeichen:** Auto-Titel nimmt alle 50 Zeichen — kein Abschneiden nötig
- **Prompt-Text kürzer als 50 Zeichen, kein Titel:** Auto-Titel = kompletter Prompt-Text (ohne trailing whitespace)
- **Nutzer öffnet Quick Capture, öffnet dann auch Detail-Modal aus einem Toast:** Beide Modals können gleichzeitig sichtbar sein (Quick Capture bleibt offen) — Nutzer schließt jeweils selbst
- **Bild-Upload während Speichern:** Wenn der Nutzer speichert bevor alle Bild-Uploads abgeschlossen sind, wartet der Speichern-Button bis alle Uploads fertig sind (Lade-Zustand auf dem Button)
- **Einzelnes Bild über 20 MB:** Toast „Datei zu groß — maximal 20 MB pro Bild", Datei wird ignoriert
- **Mehr als 10 Bilder auf einmal gedropt:** Alle werden hochgeladen (kein Hard Limit in Quick Capture, aber Performance-Hinweis bei > 10 Bilder)
- **Modal offen, Seiten-Navigation:** Wenn der Nutzer über Sidebar navigiert während Quick Capture offen ist: isDirty-Prüfung analog zu ESC; Navigation wird erst nach Bestätigung ausgeführt
- **Doppeltes Öffnen:** FAB-Klick und Q-Shortcut gleichzeitig → nur ein Modal öffnet sich
- **Offline:** Keine Verbindung → sofortiger Fehler-Toast beim Speichern, Modal bleibt mit Inhalt offen

## Technical Requirements

- QuickCaptureModal ist eine eigenständige Komponente (`QuickCaptureModal.tsx`) — kein Code-Sharing mit `PromptModal.tsx` (vollständiger Editor)
- Beide Modals speichern in die gleiche `prompts`-Tabelle und `prompt_media`-Tabelle
- FAB muss oberhalb aller gestapelten Modals liegen (z-index Hierarchie beachten)
- Q-Shortcut: `keydown`-Event auf `document`, Guard gegen `input`, `textarea`, `[contenteditable]`
- Bild-Upload: gleiche Validierungs-Logik wie PROJ-8 (`IMAGE_TYPES`, `IMAGE_MAX` aus `use-prompt-media.ts`)
- Auto-Titel-Generierung: rein clientseitig, kein Server-Call
- Der FAB erscheint auf allen authentifizierten Seiten (Main Grid, Collections, Stats, Einstellungen)

## Open Questions

- [ ] Soll der FAB auf der Login-Seite und der Reset-Seite ausgeblendet werden? (Empfehlung: Ja — nur für eingeloggte Nutzer sichtbar)
- [ ] Welches Icon für den FAB — einfaches „+" oder ein spezifischeres „Blitz/Capture"-Icon?

---

## Decision Log

### Product Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Eigenständiges QuickCaptureModal, nicht PromptModal wiederverwenden | Unterschiedliche UX-Ziele: Quick Capture = Speed, PromptModal = Organisation; getrennte Komponenten vermeiden gegenseitige Regressions | 2026-06-12 |
| Titel auto-generiert aus ersten 50 Zeichen | Reibungsloser Workflow — Nutzer muss nicht unterbrechen um Titel zu überlegen; später im Editor editierbar | 2026-06-12 |
| Mehrere Bilder erlaubt, aber kein URL-Import / kein Video | Primärer Use Case: Referenzbilder von Websites speichern (3–10 Bilder); URL-Import/Video erhöhen Komplexität ohne Speed-Vorteil | 2026-06-12 |
| FAB + Header-Button koexistieren | Verschiedene Intentionen: FAB = „Jetzt sichern", Header-Button = „Ordentlich anlegen"; kein gegenseitiges Ersetzen | 2026-06-12 |
| Q-Shortcut nur wenn kein Input fokussiert | Gmail/Notion/Linear-Pattern — verhindert versehentliches Öffnen beim Tippen, entspricht Nutzer-Erwartungen bei Produktivitäts-Apps | 2026-06-12 |
| isDirty-Prüfung auf allen Exit-Pfaden (ESC, Klick außen, X-Button) | Verhindert Datenverlust bei langen eingefügten Prompts; Konsistenz auf allen Ausstiegspfaden | 2026-06-12 |
| Post-Save: Toast mit „Im Editor öffnen" + „Prompt ansehen" | Nutzer soll nicht automatisch weitergeleitet werden (Browsing-Flow); optionale Weiterführung über Toast-Aktionen | 2026-06-12 |
| FAB auf allen authentifizierten Seiten sichtbar | „Fastest way to save anywhere" — Nutzer soll nicht erst auf Hauptseite navigieren müssen | 2026-06-12 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|---|---|---|
| _To be added by /architecture_ | | |

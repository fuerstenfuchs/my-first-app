# PROJ-15: Extension Prompt Saver (Rechtsklick → In PromptDB speichern)

## Status: In Progress
**Created:** 2026-06-13
**Last Updated:** 2026-06-13

## Dependencies
- PROJ-12 (Browser-Extension) — Popup-Infrastruktur, Supabase-Auth, bestehende UI-Komponenten
- PROJ-2 (Prompt-Verwaltung) — Speichern von Prompts via Supabase
- PROJ-13 (Mobile Share Integration) — `source_url`-Feld im Prompt-Datenmodell

## User Stories

- Als KI-Power-User möchte ich Text auf einer Webseite markieren, rechtsklicken und „In PromptDB speichern" wählen, damit ich wertvolle Prompts ohne Copy-Paste-Umweg direkt archivieren kann.
- Als KI-Power-User möchte ich den markierten Inhalt vor dem Speichern kurz prüfen und den Titel anpassen können, damit keine Müll-Einträge in meiner Datenbank landen.
- Als KI-Power-User möchte ich eine interessante Seite ohne Text-Auswahl als Referenz speichern können, damit PromptDB auch als Lesezeichen-System für Prompt-relevante Ressourcen dient.
- Als KI-Power-User möchte ich meine aktuelle Webseite nicht verlassen müssen, damit das Speichern so wenig Zeit kostet wie das Setzen eines Lesezeichens.
- Als KI-Power-User möchte ich, dass ein begonnener Capture-Vorgang niemals verloren geht — selbst wenn ich die Extension schließe oder den Browser neu starte — damit ich kein wertvolles Material ein zweites Mal suchen muss.

## Out of Scope

- **„Sofort speichern" ohne Review** — deferred als sekundäre Kontextmenü-Aktion für spätere Phase; der Default-Flow erfordert immer einen Review-Schritt
- **Bild-Capture von Webseiten** — technisch komplex (Base64, Supabase Storage); in Phase 2 ergänzen
- **Sammlungs-Management in der Extension** — „Zu Sammlung hinzufügen" bleibt dem PromptDB-Web-Tab vorbehalten; zu komplex für Extension-UI
- **Variablen-Substitution (`{{variable}}`)** — in der Roadmap für spätere Phase
- **Prompt-Typen (Prompt vs. Reference)** — Klassifikation geplant, aber Datenfeld noch nicht angelegt; erst wenn source_type-Inferenz implementiert ist
- **Auto-Tagging** — keine KI-gestützte Tag-Vorschläge in Phase 1
- **Firefox / Safari** — wie bei PROJ-12 nur Chromium (Chrome, Edge, Brave)
- **PromptDB-Tab öffnen** — nur bei komplexen Aufgaben (Medien-Management, Sammlungen), nie bei Standard-Capture

## Acceptance Criteria

### Kontextmenü

- [ ] Angenommen die Extension ist installiert, wenn der Nutzer auf einer beliebigen Webseite rechtsklickt (mit oder ohne Textauswahl), dann erscheint der Eintrag „In PromptDB speichern" im Kontextmenü.
- [ ] Angenommen der Nutzer hat Text markiert, wenn er auf „In PromptDB speichern" klickt, dann öffnet sich das Extension-Popup mit dem Quick Capture Screen und folgenden vorausgefüllten Feldern: Content = markierter Text, Source URL = aktuelle Seiten-URL, Titel = generierter Vorschlag aus den ersten 40–60 Zeichen des Textes.
- [ ] Angenommen kein Text markiert ist, wenn der Nutzer auf „In PromptDB speichern" klickt, dann öffnet sich das Extension-Popup mit dem Quick Capture Screen: Content-Feld leer mit Hinweis „Kein Text ausgewählt. Inhalt manuell eingeben oder Seite als Referenz speichern.", Source URL = aktuelle Seiten-URL, Titel = Browser-Tab-Titel.

### Quick Capture Screen (in der Extension)

- [ ] Angenommen der Quick Capture Screen ist geöffnet, dann zeigt er die Felder: Titel (fokussiert), Prompt-Inhalt (Textarea), Tags, Quell-Link — alle editierbar vor dem Speichern.
- [ ] Angenommen der Nutzer klickt auf „Speichern", dann wird der Prompt in Supabase gespeichert, ein Erfolgs-Toast erscheint, der Pending Capture wird gelöscht und das Popup schließt sich.
- [ ] Angenommen nur Source URL vorhanden ist (kein Content), wenn der Nutzer auf „Speichern" klickt, dann wird der Prompt ohne Content gespeichert — Content ist kein Pflichtfeld für Extension-Saves.
- [ ] Angenommen der Quick Capture Screen ist geöffnet, wenn der Nutzer ESC drückt, dann gilt die normale Dirty-State-Logik (unveränderte Felder → schließen; veränderte Felder → Rückfrage).
- [ ] Angenommen der Nutzer klickt auf „Zurück", dann kehrt er zur Extension-Hauptansicht zurück ohne dass der Pending Capture gelöscht wird.

### Pending Capture — Draft-Verhalten

- [ ] Angenommen ein Pending Capture existiert, wenn der Nutzer das Popup öffnet (egal von wo), dann öffnet sich die Extension direkt mit dem Quick Capture Screen — nicht mit der Hauptansicht.
- [ ] Angenommen ein Pending Capture existiert, wenn der Nutzer das Popup schließt und wieder öffnet, dann ist der Inhalt vollständig wiederhergestellt (alle Felder erhalten).
- [ ] Angenommen ein Pending Capture existiert, wenn der Browser neu gestartet wird und der Nutzer das Popup öffnet, dann ist der Capture wiederhergestellt.
- [ ] Angenommen ein Pending Capture existiert, dann zeigt die Extension-Hauptansicht einen Banner „📝 Unsaved Capture" als permanente Erinnerung.
- [ ] Angenommen der Nutzer klickt auf „Verwerfen" im Quick Capture Screen, dann erscheint ein Bestätigungsdialog: Titel „Capture verwerfen?", Text „Dieser Capture wurde noch nicht gespeichert.", Buttons „Weiter bearbeiten" und „Capture verwerfen".
- [ ] Angenommen der Nutzer bestätigt „Capture verwerfen", dann werden alle Pending-Capture-Daten gelöscht und er landet auf der Extension-Hauptansicht.
- [ ] Angenommen der Nutzer klickt „Weiter bearbeiten" im Bestätigungsdialog, dann bleibt er im Quick Capture Screen mit unveränderten Feldern.

### Nicht-eingeloggt Flow

- [ ] Angenommen der Nutzer ist nicht eingeloggt, wenn er „In PromptDB speichern" klickt, dann wird der Capture-Payload (Text, URL, Titel) in `chrome.storage.local` gespeichert und der Login-Screen erscheint.
- [ ] Angenommen ein Pending Capture existiert und der Login **schlägt fehl**, dann bleibt der Pending Capture erhalten.
- [ ] Angenommen ein Pending Capture existiert und der Nutzer **loggt sich erfolgreich ein**, dann erscheint kurz der Hinweis „Capture wiederhergestellt" und der Quick Capture Screen öffnet sich automatisch mit dem vollständig vorausgefüllten Inhalt.
- [ ] Angenommen der Nutzer schließt das Popup während des Logins (Pending Capture liegt vor), dann ist der Capture beim nächsten Popup-Öffnen weiterhin vorhanden.

### Netzwerkfehler beim Speichern

- [ ] Angenommen die Verbindung fehlt, wenn der Nutzer auf „Speichern" klickt, dann wird eine Fehlermeldung angezeigt, der Pending Capture bleibt erhalten und der Nutzer kann es erneut versuchen.

## Edge Cases

- **Sehr langer Text (> 10.000 Zeichen):** Content wird vollständig übergeben; Quick Capture zeigt alle Zeichen mit scrollbarer Textarea.
- **Mehrere Tabs gleichzeitig:** Kontextmenü-Klick in Tab A, während in Tab B bereits ein Pending Capture läuft — neuer Capture überschreibt den alten (nach Bestätigungsdialog: „Du hast einen ungespeicherten Capture. Ersetzen?").
- **Extension-Update während Pending Capture:** `chrome.storage.local` überlebt Extension-Updates; Capture bleibt erhalten.
- **Seiten mit CSP oder iframe-Restrictions:** Content-Script kann auf manchen Seiten (z.B. `chrome://`, Webstore) nicht injiziert werden — Kontextmenü-Eintrag erscheint nicht oder zeigt „Capture auf dieser Seite nicht verfügbar".
- **Kein Internetzugang:** Popup zeigt Fehlermeldung beim Speicherversuch; Pending Capture bleibt erhalten.
- **Sehr kurzer Text (1–2 Wörter):** Wird akzeptiert; kein Mindestlimit für Captures.
- **URL ohne Text und ohne Titel:** Source URL wird gespeichert; Titel bleibt leer und der Nutzer muss ihn manuell eingeben (Pflichtfeld bleibt Titel).

## Technical Requirements

- `contextMenus`-Permission in `manifest.json` (Manifest V3)
- `activeTab`-Permission zum Lesen von URL und Tab-Titel
- `scripting`-Permission zum Lesen von selektiertem Text via Content Script
- `chrome.storage.local` für Pending Capture (persistiert über Browser-Neustart)
- Kein neues npm-Paket erforderlich — bestehende Extension-Infrastruktur (Supabase, React, Tailwind)
- Quick Capture Screen ist ein neuer View-State innerhalb des bestehenden Popup-React-App

## Open Questions

- [ ] Soll der Titel-Vorschlag aus dem markierten Text oder dem Browser-Tab-Titel kommen wenn beides verfügbar ist? (Empfehlung: markierter Text hat Vorrang, da präziser)
- [ ] Maximale Lebensdauer des Pending Capture? (Empfehlung: unbegrenzt — nur manuell löschbar)

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Kein Direktspeichern ohne Review | PromptDB ist ein Langzeit-Archiv; ein Review-Schritt verhindert Datenmüll (versehentliche Auswahl, unvollständige Prompts, Textfragmente) | 2026-06-13 |
| Quick Capture im Popup, kein neuer Tab | Extension soll sich wie Lesezeichen setzen anfühlen — kein Kontext-Verlust, kein Tab-Wechsel | 2026-06-13 |
| Pending Capture = unzerstörbarer Draft | User-Intent „Ich will das speichern" darf nicht durch Auth-Unterbrechung oder Popup-Schließen verloren gehen | 2026-06-13 |
| „📝 Unsaved Capture"-Banner auf Hauptansicht | Permanente Erinnerung — analog zu E-Mail-Entwürfen; verhindert, dass der Nutzer den Draft vergisst | 2026-06-13 |
| Kontextmenü immer sichtbar (auch ohne Selektion) | Nutzer wollen auch reine Quell-URLs und Referenzseiten speichern, nicht nur kopierten Text | 2026-06-13 |
| Content kein Pflichtfeld bei Extension-Saves | Erlaubt Referenz-Only-Einträge (nur URL + Titel); konsistent mit dem Design-Prinzip „Quelle und Inhalt sind getrennte Felder" aus PROJ-13 | 2026-06-13 |
| Bestätigungsdialog vor Verwerfen | Draft-Deletion muss intentional sein; kein versehentliches Löschen durch Back-Button | 2026-06-13 |
| Mehrfach-Capture überschreibt mit Bestätigung | Verhindert stillschweigenden Datenverlust wenn zwei Captures kollidieren | 2026-06-13 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponenten-Struktur

```
Extension Popup
├── App.tsx                          [ÄNDERN] State-Machine um 'quick-capture' erweitern
│   ├── Loading-Spinner              [unverändert]
│   ├── LoginScreen                  [ÄNDERN] nach Login: pendingCapture prüfen
│   ├── MainScreen                   [ÄNDERN] PendingCaptureBanner hinzufügen
│   │   ├── Header + Search + Tabs   [unverändert]
│   │   └── PendingCaptureBanner     [NEU] "📝 Unsaved Capture" – klickbar
│   └── QuickCaptureScreen           [NEU] vollständiger eigener Screen
│       ├── QuickCaptureHeader       (← Zurück | Verwerfen)
│       ├── TitleField               (auto-fokussiert, editierbar)
│       ├── ContentTextarea          (scrollbar, editierbar)
│       ├── TagsInput                (kommagetrennt)
│       ├── SourceUrlField           (vorausgefüllt mit Seiten-URL)
│       ├── EmptyContentNotice       (Hinweis wenn kein Text ausgewählt)
│       ├── SaveButton
│       └── DiscardConfirmDialog     (Bestätigung vor Verwerfen)
│
└── Background Service Worker        [NEU] background.ts
    ├── contextMenus.create          (beim Extension-Install einmalig)
    └── contextMenus.onClicked       (liest Text + URL + Titel → speichert + öffnet Popup)
```

### Datenfluss

```
Nutzer rechtsklickt → "In PromptDB speichern"
         ↓
Background Service Worker
  liest: selectionText (markierter Text, kann leer sein)
  liest: tab.url (aktuelle Seiten-URL)
  liest: tab.title (Browser-Tab-Titel)
         ↓
Speichert in chrome.storage.local:
  pendingCapture = {
    content:    markierter Text (oder leer)
    source_url: aktuelle URL
    title:      Vorschlag (erste 40–60 Zeichen des Textes ODER Tab-Titel)
    timestamp:  Zeitpunkt des Captures
  }
         ↓
Öffnet das Extension-Popup
         ↓
App.tsx startet → prüft chrome.storage.local auf pendingCapture
         ↓
  ┌──────────────────────────────────────────────────┐
  │ Eingeloggt?                                      │
  │  JA  → QuickCaptureScreen (Felder vorausgefüllt) │
  │  NEIN → LoginScreen (pendingCapture bleibt)      │
  │         → nach Login: "Capture wiederhergestellt" │
  │         → QuickCaptureScreen                     │
  └──────────────────────────────────────────────────┘
         ↓
Nutzer prüft, passt an, speichert
         ↓
Supabase INSERT (prompts: title, content, source_url, tags)
pendingCapture aus chrome.storage.local gelöscht
Erfolgs-Toast → Popup schließt sich
```

### Pending Capture Datenstruktur

Gespeichert in `chrome.storage.local` — überlebt Browser-Neustart und Extension-Updates:

| Feld | Inhalt |
|------|--------|
| `content` | Markierter Text (leer wenn nichts ausgewählt) |
| `source_url` | URL der aktuellen Seite |
| `title` | Vorschlag: erste 40–60 Zeichen des Textes, oder Tab-Titel wenn kein Text |
| `timestamp` | Zeitpunkt — für spätere Anzeige |

Lebensdauer: **unbegrenzt** — nur durch Speichern oder explizites Verwerfen gelöscht.

### Neue Permissions in `manifest.json`

| Permission | Zweck |
|------------|-------|
| `contextMenus` | Rechtsklick-Eintrag registrieren |
| `activeTab` | URL und Titel des aktiven Tabs lesen |
| `background` (Service Worker) | Context-Menu-Handler im Hintergrund |

`scripting`-Permission ist **nicht nötig**: Chrome liefert den markierten Text direkt über `selectionText` im Context-Menu-Event — kein Content-Script-Injection erforderlich.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_

# PROJ-7: Visuelles Redesign & Cover-Bilder

## Status: Planned
**Created:** 2026-06-12
**Last Updated:** 2026-06-12

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — geschützte Routes
- Requires: PROJ-2 (Prompt-Verwaltung) — Prompt-Karten werden umgebaut, `cover_image_url`-Feld wird zur Prompt-Entität hinzugefügt

## User Stories
- Als KI-Power-User möchte ich die App in einem dunklen, modernen Design sehen, damit sie professionell wirkt und meinen Augen bei langer Nutzung schont
- Als KI-Power-User möchte ich meinen Prompts ein Cover-Bild zuweisen können (Upload oder URL), damit die Galerie visuell ansprechend und auf einen Blick erkennbar ist
- Als KI-Power-User möchte ich zwischen Kachel- und Listenansicht wechseln können, damit ich je nach Aufgabe die passende Darstellung wähle
- Als KI-Power-User möchte ich beim Durchscrollen animierte Hover-Effekte und weiche Übergänge sehen, damit sich die App hochwertig anfühlt
- Als KI-Power-User möchte ich auch Prompts ohne Bild ansprechend dargestellt sehen (Gradient-Platzhalter), damit die Galerie auch ohne vollständige Bebilderung gut aussieht

## Out of Scope
- Helles Theme / Dark Mode Toggle — die App ist bewusst immer dunkel (kein Umschalter)
- Stern-Bewertung (Rating) für Prompts — separates Feature, falls gewünscht später als PROJ-8
- KI-generierte Cover-Bilder (Unsplash Auto-Cover) — User-Upload und URL-Eingabe reichen für MVP
- Masonry-Layout (variierende Kartenhöhen) — einheitliche Kartenhöhe ist sauberer und einfacher
- Bildbearbeitung / Zuschneiden im Browser — Bilder werden so gespeichert wie hochgeladen
- Separate Bildverwaltungsseite — Bilder werden direkt im Prompt-Bearbeitungsformular verwaltet
- Vollbild-Bildansicht / Lightbox
- Animiertes Onboarding / Intro-Animation

## Acceptance Criteria

### Dark Theme
- [ ] Angenommen der Nutzer öffnet die App, dann ist das gesamte UI immer im Dark Theme dargestellt — kein Toggle, kein Light Mode
- [ ] Angenommen der Nutzer lädt die Seite neu, dann bleibt das Dark Theme bestehen (kein Flash of Light Mode)

### Grid/Listen-Umschalter
- [ ] Angenommen der Nutzer ist auf der Hauptseite „Alle Prompts", dann ist oben rechts ein Umschalter mit Grid-Icon (⊞) und Listen-Icon (☰) sichtbar
- [ ] Angenommen der Nutzer klickt auf das Listen-Icon, dann wechselt die Darstellung zur kompakten Listenansicht (ein Eintrag pro Zeile, kein Bild)
- [ ] Angenommen der Nutzer klickt auf das Grid-Icon, dann wechselt die Darstellung zur Kachelansicht mit Cover-Bildern
- [ ] Angenommen der Nutzer hat die Listenansicht gewählt und lädt die Seite neu, dann ist die gewählte Ansicht weiterhin aktiv (Präferenz wird im localStorage gespeichert)
- [ ] Angenommen der Nutzer wechselt die Ansicht, dann erfolgt der Wechsel mit einer weichen Übergangsanimation (Framer Motion)

### Kachelansicht (Grid)
- [ ] Angenommen der Nutzer ist in der Kachelansicht, dann werden Prompts in einem 4-spaltigen Grid dargestellt (Desktop ≥1280px), 2-spaltig (Tablet ≥768px), 1-spaltig (Mobil)
- [ ] Angenommen ein Prompt hat ein Cover-Bild gesetzt, dann wird es im 16:9-Bildbereich vollständig und ohne Zuschnitt angezeigt (`object-fit: contain`)
- [ ] Angenommen ein Prompt hat kein Cover-Bild, dann wird ein individueller Gradient-Platzhalter basierend auf dem Prompt-Titel angezeigt
- [ ] Angenommen der Nutzer bewegt die Maus über eine Karte, dann reagiert die Karte mit einem subtilen Hover-Effekt (leichtes Anheben + Glow, Framer Motion)
- [ ] Angenommen der Nutzer klickt auf eine Karte, dann öffnet sich das Detail-Modal mit einer weichen Einblend-Animation (Framer Motion)

### Listenansicht
- [ ] Angenommen der Nutzer ist in der Listenansicht, dann wird jeder Prompt als kompakte Zeile dargestellt: Titel, erste Tags, Beschreibung (gekürzt), Datum
- [ ] Angenommen ein Prompt hat ein Cover-Bild, dann wird in der Listenansicht ein kleines quadratisches Vorschaubild (Thumbnail, 48×48px) links neben dem Titel angezeigt
- [ ] Angenommen der Nutzer klickt auf einen Listeneintrag, dann öffnet sich das Detail-Modal

### Cover-Bild: URL-Eingabe
- [ ] Angenommen der Nutzer öffnet das Prompt-Formular (Erstellen oder Bearbeiten), dann gibt es ein optionales Feld „Cover-Bild (URL)"
- [ ] Angenommen der Nutzer gibt eine gültige Bild-URL ein und speichert, dann wird die URL als `cover_image_url` gespeichert und das Bild sofort in der Galerie angezeigt
- [ ] Angenommen der Nutzer gibt eine ungültige URL ein (kein Bild ladbar), dann wird das Bild-Feld leer dargestellt und kein Fehler geworfen — stattdessen erscheint der Gradient-Platzhalter

### Cover-Bild: Datei-Upload
- [ ] Angenommen der Nutzer klickt im Prompt-Formular auf „Bild hochladen", dann öffnet sich ein Datei-Picker der Bilder (jpg, png, webp, gif) akzeptiert
- [ ] Angenommen der Nutzer wählt eine gültige Bilddatei, dann wird sie in Supabase Storage hochgeladen und die resultierende öffentliche URL als `cover_image_url` gespeichert
- [ ] Angenommen die Bilddatei ist größer als 5 MB, dann erscheint ein Toast „Bild zu groß — maximal 5 MB" und es wird nichts hochgeladen
- [ ] Angenommen der Upload schlägt fehl (Netzwerkfehler), dann erscheint ein Toast „Upload fehlgeschlagen — bitte erneut versuchen"
- [ ] Angenommen ein Prompt hat bereits ein Cover-Bild und der Nutzer lädt ein neues hoch, dann ersetzt das neue Bild das alte (altes Bild wird aus Storage gelöscht)

### Cover-Bild entfernen
- [ ] Angenommen ein Prompt hat ein Cover-Bild, dann gibt es im Formular eine Schaltfläche „Bild entfernen"
- [ ] Angenommen der Nutzer klickt auf „Bild entfernen" und speichert, dann wird `cover_image_url` auf `null` gesetzt und der Gradient-Platzhalter wird angezeigt

### Animationen (Framer Motion)
- [ ] Angenommen die Prompt-Galerie lädt, dann erscheinen die Karten mit einer gestaffelten Einblend-Animation (staggered fade-in)
- [ ] Angenommen ein Modal öffnet sich, dann erscheint es mit einer weichen Scale+Fade-Animation
- [ ] Angenommen ein Modal schließt sich, dann verschwindet es mit einer entsprechenden Ausblend-Animation

## Edge Cases
- **Bild-URL lädt nicht (404 / CORS):** `<img>` löst `onError` aus → Gradient-Platzhalter wird angezeigt, kein Fehler-Toast, kein kaputtes Layout
- **Sehr langer Prompt-Titel ohne Bild:** Gradient-Platzhalter muss auch bei langen Titeln stabil aussehen
- **Viele Prompts (>100) in Grid-Ansicht:** Lazy-Loading oder Virtualisierung ist Out of Scope für MVP — normales DOM-Rendering reicht
- **Upload während schlechter Verbindung:** Lade-Spinner im Upload-Button während des Uploads, Button disabled bis fertig
- **Gleichzeitiges Bearbeiten desselben Prompts in zwei Tabs:** Letzter Speicher-Stand gewinnt (kein Optimistic Locking nötig)
- **gif als Cover:** Wird unterstützt, aber ohne besondere Behandlung — läuft einfach als animiertes Bild

## Technical Requirements
- Supabase Storage Bucket `prompt-covers` (public) für hochgeladene Bilder
- `cover_image_url TEXT NULL` — neues Feld in der `prompts`-Tabelle
- Framer Motion als neue Dependency
- Dark Theme via CSS-Variablen (`:root` Override oder `class="dark"` auf `<html>`)
- Präferenz Grid/Liste: `localStorage` Key `promptdb-view-mode`

## Open Questions
- keine

## Decision Log

### Product Decisions
| Entscheidung | Begründung | Datum |
|---|---|---|
| Dark Theme immer an, kein Toggle | Klare Design-Entscheidung — App soll dunkel sein; Toggle erhöht Komplexität ohne klaren Nutzen | 2026-06-12 |
| 16:9 mit object-fit: contain statt cover | Bilder sollen vollständig sichtbar sein — kein Zuschnitt | 2026-06-12 |
| Gradient-Platzhalter statt leerer Fläche | Prompts ohne Bild sollen trotzdem visuell ansprechend aussehen | 2026-06-12 |
| Grid/Listen-Präferenz in localStorage | Kein Server-Roundtrip nötig; Präferenz ist gerätespezifisch | 2026-06-12 |
| Max. 5 MB Upload-Limit | Supabase Free Tier hat 1 GB Storage — 5 MB pro Bild ist großzügig genug und verhindert versehentlich riesige Uploads | 2026-06-12 |
| Kein Masonry-Layout | Einheitliche Kartenhöhe ergibt saubereres Grid; vollständige Bilder durch contain statt cover | 2026-06-12 |
| Rating-Sterne Out of Scope | Im Screenshot sichtbar, aber kein eigener Nutzen-Kontext genannt — separates Feature bei Bedarf | 2026-06-12 |
| Altes Bild bei Neuupload löschen | Verhindert unbegrenzt wachsende Storage-Kosten | 2026-06-12 |

### Technical Decisions
| Entscheidung | Begründung | Datum |
|---|---|---|
| `class="dark"` fix auf `<html>` | shadcn/ui hat `.dark`-Variablen bereits fertig — kein neues CSS nötig | 2026-06-12 |
| ThemeProvider entfernen | War nur für den Toggle nötig; fällt weg wenn Dark Theme erzwungen wird | 2026-06-12 |
| Framer Motion | Industriestandard für React-Animationen, tree-shakeable | 2026-06-12 |
| Gradient aus Titel-Hash | Deterministisch (gleicher Prompt → immer gleiche Farbe), kein extra DB-Feld | 2026-06-12 |
| 2 separate Karten-Komponenten (Grid + Liste) | Sauberer als eine Mega-Komponente mit vielen Fallunterscheidungen | 2026-06-12 |
| Storage-Pfad `{user_id}/{uuid}.{ext}` | RLS rein per Pfad möglich — kein DB-Join in der Storage-Regel nötig | 2026-06-12 |
| `prompt-card.tsx` bleibt für Collections | Collections-Ansicht braucht kein Cover-Bild — keine unnötige Kopplung | 2026-06-12 |

---

## Tech Design (Solution Architect)

### Komponenten-Struktur

```
globals.css + layout.tsx (GEÄNDERT)
+-- class="dark" fix auf <html> → erzwingt Dark Theme
+-- ThemeProvider entfernt

src/app/(app)/page.tsx (GEÄNDERT)
+-- Grid/Listen-Umschalter (oben rechts, 2 Icon-Buttons)
+-- useViewMode() Hook → liest/schreibt localStorage
+-- Grid-Modus → PromptCardGrid
+-- Listen-Modus → PromptListRow

src/components/prompts/
+-- prompt-card-grid.tsx (NEU)
|   +-- 16:9 Bildbereich (object-fit: contain)
|   |   +-- <img> onError → Gradient-Fallback
|   |   +-- GradientPlaceholder wenn kein Bild
|   +-- Titel, Tags, Beschreibung gekürzt
|   +-- Framer Motion: Hover (leichtes Anheben + Glow)
|   +-- Dropdown: Bearbeiten / Sammlung / Löschen
|
+-- prompt-list-row.tsx (NEU)
|   +-- 48x48 Thumbnail (Bild oder Gradient)
|   +-- Titel, erste 2 Tags, Beschreibung, Datum
|   +-- Klick → Modal
|
+-- cover-image-picker.tsx (NEU)
|   +-- Toggle: URL eingeben vs. Datei hochladen
|   +-- URL-Modus: Input + Live-Vorschau
|   +-- Upload-Modus: Datei-Picker (jpg/png/webp/gif, max 5 MB)
|   +-- Schaltfläche "Bild entfernen"
|
+-- prompt-modal.tsx (GEÄNDERT)
    +-- CoverImagePicker ins Formular
    +-- Framer Motion: Scale+Fade beim Oeffnen/Schliessen

src/hooks/
+-- use-view-mode.ts (NEU) — localStorage "promptdb-view-mode"
+-- use-prompts.ts (GEÄNDERT) — cover_image_url in Typ + CRUD
```

### Datenhaltung

```
prompts-Tabelle (neues Feld):
  cover_image_url  TEXT  NULL
    → externe URL (vom Nutzer eingegeben)
    → oder oeffentliche Supabase-Storage-URL (nach Upload)
    → null = kein Bild, Gradient-Platzhalter wird gezeigt

Supabase Storage Bucket: prompt-covers (oeffentlich lesbar)
  prompt-covers/
    {user_id}/
      {uuid}.jpg / .png / .webp / .gif
```

### Neue Pakete
- `framer-motion` — Hover-, Modal- und Stagger-Animationen

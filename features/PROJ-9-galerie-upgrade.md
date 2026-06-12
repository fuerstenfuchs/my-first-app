# PROJ-9: Prompt-Galerie Upgrade (Hover-Carousel, Video-Preview)

## Status: In Progress
**Created:** 2026-06-12
**Last Updated:** 2026-06-12

## Dependencies
- Requires: PROJ-7 (Visuelles Redesign) — Kachelansicht, cover_image_url, Glassmorphism-Karten
- Requires: PROJ-8 (Mehrere Medien) — prompt_media-Tabelle mit type/url/sort_order

## User Stories

- Als KI-Power-User möchte ich beim Hovern über eine Kachel automatisch durch alle Bilder eines Prompts durchblättern können, damit ich das richtige Bild schnell visuell identifiziere ohne das Modal zu öffnen
- Als KI-Power-User möchte ich sehen wie viele Medien ein Prompt hat, damit ich weiß ob ein Prompt reich bebildert ist bevor ich ihn öffne
- Als KI-Power-User möchte ich ein Video-Prompt durch einen stummen Vorschau-Clip auf der Kachel erkennen, damit ich Prompts mit Video-Output sofort von Bild-Prompts unterscheide
- Als KI-Power-User möchte ich dass GIFs auf Kacheln animiert angezeigt werden, damit KI-generierte Animationen (Runway, Kling) direkt in der Galerie sichtbar sind
- Als KI-Power-User möchte ich dass das normale Kachel-Verhalten bei Prompts ohne mehrere Medien unverändert bleibt, damit die bekannte Oberfläche nicht gestört wird

## Out of Scope

- Hover-Carousel in der Listenansicht — nur Grid-View erhält dieses Upgrade
- Pfeil-Navigation (← →) auf Kacheln — das ist Aufgabe des Detail-Modals und der Galerie (PROJ-8)
- Tastatur-Navigation im Carousel auf Kacheln — zu komplex, Keyboard-User nutzen das Modal
- Preloading aller Medien beim Seitenaufbau — zu teuer; Medien werden pro Kachel lazy geladen
- Automatisch generierte Video-Thumbnails/Poster-Bilder — kein Server-seitiges Transcoding (Out of PRD scope)
- Touch-Swipe auf Kacheln zum Wechsel zwischen Bildern — Swipe ist für die Galerie (PROJ-8); zu kleines Ziel auf Mobile
- Carousel-Pause bei Klick auf das Bild — Klick öffnet das Detail-Modal (bestehendes Verhalten bleibt)
- Mute/Unmute-Button für Video-Preview auf Kacheln — Video-Preview ist immer stumm
- Vollbild-Video direkt aus dem Kachel-Hover — dafür ist der Galerie-Viewer (PROJ-8)

## Acceptance Criteria

### Hover-Carousel (mehrere Bilder)

- [ ] Angenommen ein Prompt hat mehrere Einträge in prompt_media (type='image'), wenn der Nutzer die Maus über die Kachel bewegt, dann beginnen die Bilder automatisch alle 1,5 Sekunden zu wechseln (Crossfade)
- [ ] Angenommen der Carousel läuft, dann werden am unteren Rand der Bildzone kleine Punkt-Indikatoren angezeigt — ausgefüllt für das aktive Bild, hohl für die restlichen
- [ ] Angenommen der Nutzer bewegt die Maus von der Kachel weg, dann stoppt der Carousel sofort und das Cover-Bild wird wieder angezeigt
- [ ] Angenommen ein Prompt hat nur ein Bild oder keins, dann passiert beim Hovern kein Carousel (keine Punkt-Indikatoren, kein Bildwechsel)
- [ ] Angenommen der Nutzer hat `prefers-reduced-motion: reduce` aktiviert, dann startet kein automatischer Bildwechsel (Punkte werden ggf. trotzdem angezeigt, aber kein Auto-Advance)

### Video-Preview

- [ ] Angenommen das erste Medium eines Prompts in prompt_media hat type='video', wenn der Nutzer die Maus über die Kachel bewegt, dann startet ein stummes, loopend abgespieltes Video-Preview in der Bildzone der Kachel
- [ ] Angenommen der Video-Preview läuft, wenn der Nutzer die Kachel verlässt, dann pausiert das Video und das statische Poster/Cover-Bild wird wieder angezeigt
- [ ] Angenommen ein Prompt hat kein Video in prompt_media, dann gibt es keinen Video-Preview-Effekt auf der Kachel
- [ ] Angenommen das Video noch lädt wenn der Nutzer bereits die Kachel verlassen hat, dann bricht der Ladevorgang ab (kein Video-Element im DOM mehr)

### Medien-Anzahl-Badge

- [ ] Angenommen ein Prompt hat mehr als ein Medium in prompt_media, dann wird ein kleines Badge mit der Anzahl (z.B. „3 Medien" oder ein Icon + Zahl) dauerhaft auf der Kachel angezeigt — auch ohne Hover
- [ ] Angenommen ein Prompt hat genau ein Medium oder keins, dann wird kein Zähler-Badge angezeigt
- [ ] Angenommen ein Prompt hat ein Video als erstes Medium, dann wird auf der Kachel dauerhaft ein Video-Icon angezeigt (auch ohne Hover), damit der Nutzer es erkennt

### Lazy Loading

- [ ] Angenommen der Nutzer scrollt die Galerie ohne zu hovern, dann werden die Medien für keine der Kacheln vorab geladen (keine versteckten Fetch-Requests im Hintergrund)
- [ ] Angenommen der Nutzer hovered zum ersten Mal über eine Kachel, dann werden die Medien für genau diese Kachel geladen und gecacht für die Sitzung
- [ ] Angenommen die Medien wurden einmal geladen, wenn der Nutzer erneut über die gleiche Kachel hovered, dann startet der Carousel sofort ohne neuen Fetch

### GIF-Animation

- [ ] Angenommen das Cover-Bild oder das erste Bild eines Prompts ist eine GIF-Datei, dann wird es auf der Kachel animiert dargestellt (Browser-Standard-Verhalten für animated GIFs)

## Edge Cases

- **Prompt mit nur Videos (kein Standbild):** Das Video-Preview startet beim Hover; als Fallback-Thumbnail wird ein schwarzes Rechteck angezeigt solange das Video lädt
- **Sehr viele Medien (>10 pro Prompt):** Punkt-Indikatoren zeigen maximal 5 Punkte an (+ „…" oder Sättigung); Carousel läuft weiter durch alle Bilder
- **Schlechte Netzwerkverbindung:** Medien laden langsam; Carousel startet erst wenn mindestens 2 Bilder geladen sind; kein Ladeindikator auf der Kachel (zu ablenkend)
- **Bild-URL kaputt (404):** Das fehlerhafte Bild wird übersprungen; der Carousel zeigt nur die funktionierenden Bilder
- **Sehr kurzes Hover (< 200ms):** Carousel startet nicht (Debounce), um versehentliches Triggern beim Scrollen zu verhindern
- **Prompt wird gleichzeitig geöffnet (Klick) während Carousel läuft:** Klick öffnet das Modal, Carousel-State wird verworfen
- **Mobile (Touch):** Kein Hover-Event auf Touch-Geräten; das Carousel-Verhalten tritt nicht auf (Touch-Nutzer öffnen das Modal per Klick)
- **Carousel-Bilder vs. cover_image_url:** Falls prompt_media Bilder vorhanden sind, wird das cover_image_url ignoriert und die prompt_media-Liste benutzt; falls prompt_media leer ist, wird nur cover_image_url gezeigt (wie bisher)

## Technical Requirements

- Medien werden per `prompt_id` aus der `prompt_media`-Tabelle geladen (Supabase RLS bereits vorhanden)
- Lazy-Loading: Fetch nur bei erstem Hover pro Kachel (Hover-Event als Trigger)
- Sitzungs-Caching: Geladene Medien einer Kachel werden im React-State der Kachel gehalten, nicht refetched
- Debounce: 200ms Verzögerung vor Carousel-Start, um versehentliches Triggern zu vermeiden
- `prefers-reduced-motion`: Kein Auto-Advance wenn diese Systemeinstellung aktiv ist
- Carousel-Transition: Crossfade (opacity) — nicht Slide (wegen Konsistenz mit dem bestehenden glassmorphism Stil)

## Open Questions
- keine — Anforderungen aus Roadmap-Dokument vollständig spezifiziert

---

## Implementation Notes (Frontend)

**Geänderte Dateien:**
- `src/hooks/use-card-carousel.ts` (NEU) — Kapselung der Carousel-Logik: 200ms Debounce, 1.5s Auto-Advance, prefers-reduced-motion-Check via `window.matchMedia`, onMouseEnter/onMouseLeave Handler
- `src/hooks/use-prompts.ts` (MODIFIZIERT) — `PreviewMediaItem`-Interface + `preview_media: PreviewMediaItem[]` im `Prompt`-Interface; SELECT-Query erweitert auf `*, prompt_media(type, url, sort_order)`; Daten werden client-seitig sortiert (sort_order), auf max. 6 Items gesliced, typisiert. `createPrompt`, `updatePrompt`, `importPrompts` setzen `preview_media` korrekt im lokalen State.
- `src/components/prompts/prompt-card-grid.tsx` (MODIFIZIERT) — `mediaVisible`-State für lazy Rendering der Overlay-Schichten (Bilder laden erst beim ersten Hover); Crossfade-Overlays (opacity 400ms) per `preview_media`; Video-Elemente nur gerendert wenn Overlay aktiv; Dot-Indikatoren (max. 5 Punkte + „…") bei Carousel; Medien-Badge oben links (Video-Icon oder Images+Zahl, je nach erstem Medium-Typ); Carousel stoppt beim Öffnen des Modals (`handleCardClick`)

**Implementierungs-Abweichungen vom Spec:**
- Das Lightbox-Feature (cover_image_url → Lightbox bei Klick auf Basisbild) bleibt erhalten; Overlay-Schichten haben `pointer-events-none`, Klicks fallen durch zum Basisbild. Dies ist die erwartete Rückwärtskompatibilität.
- `preview_media` wird nach einer Prompt-Bearbeitung (via MediaManager) im lokalen State nicht sofort aktualisiert — ein Seiten-Reload ist nötig. Dies ist eine bewusste Einschränkung für PROJ-9-Scope (kein Realtime-Subscription).

**Build:** ✓ TypeScript fehlerfrei, Next.js 16.1.1 Build erfolgreich (2026-06-12)

---

## Tech Design (Solution Architect)

### Überblick

PROJ-9 ist **rein frontend** — keine neuen Datenbank-Tabellen, keine Migrationen. Die `prompt_media`-Tabelle aus PROJ-8 wird genutzt. Die einzige Daten-Änderung ist eine erweiterte SELECT-Query beim Laden der Prompts: statt nur `cover_image_url` zu laden, werden jetzt auch die ersten 6 Medien-Vorschau-Einträge pro Prompt mitgeladen.

### Komponenten-Struktur

```
src/app/(app)/page.tsx (UNVERÄNDERT)

src/hooks/
+-- use-prompts.ts (MODIFIZIERT)
|   +-- SELECT-Query erweitert: liefert jetzt preview_media[] (max. 6 Einträge: type + url + sort_order)
|   +-- Prompt-Interface erhält preview_media[]
|
+-- use-card-carousel.ts (NEU)
    +-- Eingabe: previewMedia[] (aus dem erweiterten Prompt-Objekt)
    +-- Zustand: currentIndex, isCarouselActive
    +-- Logik: Debounce 200ms, Auto-Advance alle 1,5s, prefers-reduced-motion-Check
    +-- Ausgabe: currentIndex, isCarouselActive, onMouseEnter, onMouseLeave

src/components/prompts/
+-- prompt-card-grid.tsx (MODIFIZIERT)
    +-- 16:9 Bildzone (ERWEITERT)
    |   +-- Basis-Schicht: cover_image_url oder Gradient (immer sichtbar, unverändert)
    |   +-- Carousel-Schichten: je eine Schicht pro preview_media-Eintrag
    |   |   +-- Bild-Schicht: opacity 0 → 1 per Crossfade beim Carousel
    |   |   +-- Video-Schicht: <video muted loop> für Einträge mit type='video'
    |   +-- Dot-Indikatoren: horizontale Reihe am unteren Bildrand (nur bei Hover + >1 Medium)
    |   +-- Medien-Badge (IMMER SICHTBAR)
    |       +-- Zähler-Badge: „N" wenn prompt mehr als 1 Medium hat
    |       +-- Video-Icon: kleines Icon wenn erstes Medium ein Video ist
    +-- Card-Body (UNVERÄNDERT: Titel, Beschreibung, Tags, Sterne)
```

### Datenhaltung

**Kein neues Datenbank-Schema erforderlich.**

Die bestehende `usePrompts`-Hook-Query wird erweitert:
- Bisher: lädt `prompts.*` (inkl. cover_image_url)
- Neu: lädt zusätzlich für jeden Prompt die ersten 6 `prompt_media`-Einträge (type + url), sortiert nach sort_order

Jeder Prompt im Frontend erhält dadurch:
```
preview_media: Array von max. 6 Einträgen, jeder mit:
  - type: 'image' oder 'video'
  - url: Öffentliche URL des Mediums
  - sort_order: Reihenfolge-Nummer
```

Daraus werden zwei weitere Werte abgeleitet (clientseitig, kein Extra-Query):
- `media_count`: Anzahl der geladenen preview_media-Einträge (0–6; Wert 6 wird als „6 oder mehr" behandelt)
- `first_media_type`: type des ersten Eintrags — bestimmt ob Video-Icon und Video-Preview angezeigt werden

### Hook-Logik: `use-card-carousel`

Dieser neue Hook kapselt die gesamte Carousel-Intelligenz einer Kachel:

| Eingabe | Beschreibung |
|---|---|
| `previewMedia[]` | Die max. 6 Medien-Einträge des Prompts |

| Ausgabe | Beschreibung |
|---|---|
| `currentIndex` | Welches Medium gerade angezeigt wird (0 = erstes) |
| `isCarouselActive` | Ob der Carousel-Modus aktiv ist (Maus über Kachel) |
| `onMouseEnter` | Handler für Kachel-Hover-Start — startet 200ms Debounce, dann Auto-Advance |
| `onMouseLeave` | Handler für Kachel-Verlassen — stoppt Auto-Advance, setzt Index zurück |

Interne Logik des Hooks:
1. **Debounce:** `onMouseEnter` startet einen 200ms-Timer. Erst wenn die Maus 200ms ununterbrochen auf der Kachel ist, wechselt `isCarouselActive` auf `true` und der Auto-Advance beginnt.
2. **Auto-Advance:** Ein Interval-Timer wechselt `currentIndex` alle 1.500ms. Läuft im Kreis (letztes Bild → erstes Bild).
3. **prefers-reduced-motion:** Beim Mounten prüft der Hook `window.matchMedia('(prefers-reduced-motion: reduce)')`. Ist diese Einstellung aktiv, läuft kein Auto-Advance.
4. **Aufräumen:** Beim `onMouseLeave` werden Debounce-Timer und Auto-Advance-Interval sofort gestoppt und alle Zustände zurückgesetzt.

### Render-Logik der Bildzone

Die 16:9-Bildzone enthält mehrere überlagerte Schichten:

```
Schicht 1 (unterste): Basis-Bild (cover_image_url oder Gradient) — immer opacity: 1
Schicht 2–7:          preview_media[0..5] — opacity: 1 wenn currentIndex übereinstimmt, sonst opacity: 0
                       Transition: opacity 0.4s ease (Crossfade-Effekt)
                       Bild-Einträge: <img> Element
                       Video-Einträge: <video muted loop autoPlay> Element
```

**Warum Overlay-Schichten statt Bild-Austausch:** Durch überlagerte Schichten mit opacity-Crossfade entstehen weiche Übergänge ohne Layout-Sprünge. Der Browser kann alle Bilder im Speicher halten sobald sie einmal geladen sind.

### Medien-Badge

Das Medien-Badge liegt oben links in der Bildzone (neben dem bestehenden Monospace-Tag-Badge oben links):

- **Zähler-Badge:** Icon `Images` + Zahl, z.B. „🖼 3". Sichtbar wenn `media_count > 1`.
- **Video-Icon-Badge:** Icon `Video`. Sichtbar wenn `first_media_type === 'video'`. Ersetzt den Zähler-Badge wenn das erste Medium ein Video ist.
- **Position:** Obere linke Ecke der Bildzone, als kleines Pill-Badge — konsistent mit dem bestehenden Monospace-Tag-Badge (der weicht nach rechts).

### Keine Backend-Arbeit erforderlich

| Aspekt | Entscheidung |
|---|---|
| Neue Tabellen | Keine |
| Migrationen | Keine |
| API Routes | Keine |
| RLS | Bereits vorhanden (PROJ-8) |

### Neue Pakete

Keine neuen Pakete erforderlich. Alle benötigten APIs sind in React und dem Browser nativ verfügbar:
- `useState`, `useEffect`, `useRef` für Carousel-Logik
- `window.matchMedia` für prefers-reduced-motion
- CSS `opacity` + `transition` für Crossfade

---

## Decision Log

### Product Decisions
| Entscheidung | Begründung | Datum |
|---|---|---|
| Carousel nur in Grid-View, nicht Listenansicht | Listenansicht hat zu wenig Platz für sinnvolle Medienvorschau; Grid-Kacheln haben 16:9-Bereich | 2026-06-12 |
| Crossfade statt Slide-Transition | Passt zum Glassmorphism-Stil; weniger ablenkend als Slide | 2026-06-12 |
| 1,5s Auto-Advance-Intervall | Schnell genug für visuelle Übersicht; langsam genug um nicht zu stören | 2026-06-12 |
| Medien-Zähler-Badge immer sichtbar (kein Hover nötig) | Discoverability: Nutzer soll wissen dass ein Prompt reich bebildert ist, bevor er hovered | 2026-06-12 |
| Video-Icon dauerhaft auf Kacheln mit Video | Nutzer soll Video-Prompts auf den ersten Blick erkennen | 2026-06-12 |
| Lazy Loading per Hover (nicht prefetch) | Performance: Viele Prompts auf der Seite würden bei prefetch zu vielen DB-Requests führen | 2026-06-12 |
| Debounce 200ms | Verhindert unnötige Fetches beim schnellen Durchscrollen der Galerie | 2026-06-12 |
| prefers-reduced-motion respektieren | Accessibility-Mindeststandard für auto-playing Animationen | 2026-06-12 |
| Mobile: kein Carousel (kein Hover) | Touch-Geräte haben kein hover-Event; Modal ist der primäre Weg für Medienansicht auf Mobile | 2026-06-12 |

### Technical Decisions
| Entscheidung | Begründung | Datum |
|---|---|---|
| Eager loading von max. 6 preview_media pro Prompt | Eliminiert lazy-load-Delay beim Hover; 6 Items × N Prompts ist vertretbar; Prompts mit >6 Items sind selten | 2026-06-12 |
| Kein neues DB-Schema / keine Migration | preview_media bereits in PROJ-8 vorhanden; COUNT + Typ über erweiterte SELECT-Query verfügbar | 2026-06-12 |
| useCardCarousel als separater Hook | Trennt Carousel-Logik von Render-Logik; ermöglicht Unit-Tests des Auto-Advance/Debounce-Verhaltens | 2026-06-12 |
| Overlay-Schichten statt Bild-Tausch für Crossfade | Kein Layout-Shift; weicher Übergang; Browser cached geladene Bilder in den inaktiven Schichten | 2026-06-12 |
| prefers-reduced-motion clientseitig via window.matchMedia | Standard-Accessibility-API; kein Server-State nötig; wird einmalig beim Hook-Mount geprüft | 2026-06-12 |
| Video-Element nur beim Hover gerendert | Verhindert gleichzeitiges Autoplay vieler Videos beim Seitenaufbau; spart Netzwerk und CPU | 2026-06-12 |

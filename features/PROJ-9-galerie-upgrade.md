# PROJ-9: Prompt-Galerie Upgrade (Hover-Carousel, Video-Preview)

## Status: Planned
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

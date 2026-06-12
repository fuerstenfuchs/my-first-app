# PROJ-8: Mehrere Medien pro Prompt (Bilder & Videos)

## Status: Planned
**Created:** 2026-06-12
**Last Updated:** 2026-06-12

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — geschützte Routes, user_id
- Requires: PROJ-2 (Prompt-Verwaltung) — Prompts als Basis-Entität
- Requires: PROJ-7 (Visuelles Redesign) — cover_image_url, Storage-Bucket, Kachelansicht

## User Stories

- Als KI-Power-User möchte ich einem Prompt mehrere Bilder zuweisen können, damit ich Screenshots, Referenzbilder und Ergebnisbilder alle an einem Ort speichern kann
- Als KI-Power-User möchte ich Videos zu einem Prompt hochladen können (z.B. Runway-Output, Suno-Video), damit der komplette Workflow-Output zusammen mit dem Prompt gespeichert ist
- Als KI-Power-User möchte ich per Drag & Drop mehrere Dateien gleichzeitig hochladen können, damit ich nicht jede Datei einzeln auswählen muss
- Als KI-Power-User möchte ich den Upload-Fortschritt sehen, damit ich weiß, wann meine Dateien fertig hochgeladen sind
- Als KI-Power-User möchte ich jedes Bild als Cover setzen können, damit das visuell passendste Bild in der Galerie angezeigt wird
- Als KI-Power-User möchte ich die Reihenfolge der Medien per Drag & Drop ändern können, damit die wichtigsten Medien zuerst erscheinen
- Als KI-Power-User möchte ich einzelne Medien löschen können, ohne den gesamten Prompt zu bearbeiten
- Als KI-Power-User möchte ich alle Medien eines Prompts in einer Vollbild-Galerie durchblättern können, damit ich die Bilder und Videos in voller Auflösung sehen kann

## Out of Scope

- Bildbearbeitung / Zuschneiden im Browser — deferred to PROJ-14 (Smart Features) oder nie
- KI-generierte Medien (DALL-E, Stable Diffusion direkt in App) — nicht geplant
- Medien-Sharing zwischen Nutzern — kein Multi-User in MVP (PRD Non-Goal)
- Automatisches Thumbnail-Generieren für Videos — zu komplex für MVP, Browser-native Video-Preview reicht
- Medien-Suche / Filter nach Medientyp — deferred to PROJ-14
- Bild-Komprimierung / Resizing im Browser — Supabase Storage übernimmt Speicherung as-is
- Hover-Carousel und Video-Preview auf Kacheln — das ist PROJ-9 (Galerie-Upgrade)
- GIF-Animation auf Karten — PROJ-9
- Maximale Anzahl Medien pro Prompt limitieren — kein Limit für MVP (Supabase Free Tier: 1 GB Storage gesamt)

## Acceptance Criteria

### Medien-Upload: Mehrere Bilder

- [ ] Angenommen der Nutzer öffnet das Prompt-Formular, wenn er mehrere Bilddateien per Drag & Drop auf die Upload-Zone zieht, dann werden alle Dateien gleichzeitig hochgeladen
- [ ] Angenommen der Nutzer zieht Dateien auf die Upload-Zone, wenn dabei eine Datei kein Bild ist (z.B. PDF), dann wird diese Datei übersprungen und eine Toast-Meldung erklärt welche Dateien abgelehnt wurden
- [ ] Angenommen der Nutzer wählt Dateien per Datei-Picker, wenn er mehrere Dateien auswählt, dann wird ein Upload-Fortschrittsbalken pro Datei angezeigt
- [ ] Angenommen eine Bilddatei ist größer als 20 MB, wenn der Nutzer sie hochladen möchte, dann erscheint ein Toast „Datei zu groß — maximal 20 MB pro Bild"
- [ ] Angenommen alle Uploads sind abgeschlossen, wenn der Nutzer speichert, dann sind alle Medien dem Prompt zugeordnet und bleiben nach Seitenneuladung erhalten

### Medien-Upload: Videos

- [ ] Angenommen der Nutzer öffnet das Prompt-Formular, wenn er eine Videodatei (mp4, webm, mov) hochlädt, dann wird sie als Medientyp „video" gespeichert
- [ ] Angenommen eine Videodatei ist größer als 100 MB, wenn der Nutzer sie hochladen möchte, dann erscheint ein Toast „Video zu groß — maximal 100 MB"
- [ ] Angenommen ein Video wurde hochgeladen, wenn der Nutzer das Prompt-Modal öffnet, dann wird das Video mit einem nativen HTML5-Player abgespielt (stumm, mit Controls)

### Cover-Bild

- [ ] Angenommen ein Prompt hat mehrere Bilder, wenn der Nutzer auf „Als Cover setzen" bei einem Bild klickt, dann wird dieses Bild als cover_image_url gespeichert und sofort auf der Kachel angezeigt
- [ ] Angenommen ein Prompt hat nur ein Bild, dann ist dieses automatisch das Cover-Bild
- [ ] Angenommen ein Prompt hat kein Bild, dann wird der Gradient-Platzhalter angezeigt (wie bisher)
- [ ] Angenommen ein Nutzer löscht das aktuelle Cover-Bild, dann wird automatisch das nächste Bild in der Liste zum Cover (oder Gradient wenn kein weiteres Bild vorhanden)

### Reihenfolge per Drag & Drop

- [ ] Angenommen der Nutzer ist im Bearbeitungs-Formular, wenn er ein Medium per Drag & Drop verschiebt, dann ändert sich die Reihenfolge sofort in der Vorschau
- [ ] Angenommen der Nutzer speichert nach dem Umordnen, dann bleibt die neue Reihenfolge nach Seitenneuladung erhalten (sort_order wird gespeichert)

### Medien löschen

- [ ] Angenommen der Nutzer bewegt die Maus über ein Medium im Formular, wenn er auf das Löschen-Icon klickt, dann wird das Medium sofort aus der Vorschau entfernt
- [ ] Angenommen der Nutzer speichert nach dem Löschen, dann ist das Medium dauerhaft gelöscht und die Datei wird aus dem Supabase Storage entfernt

### Galerie-Viewer (Vollbild)

- [ ] Angenommen ein Prompt hat mindestens ein Medium, wenn der Nutzer im Detail-Modal auf ein Bild oder Video klickt, dann öffnet sich ein Vollbild-Galerie-Viewer
- [ ] Angenommen der Galerie-Viewer ist geöffnet, wenn der Nutzer auf die Pfeil-Buttons klickt oder die Pfeiltasten drückt, dann wechselt das angezeigte Medium zum nächsten bzw. vorherigen
- [ ] Angenommen der Galerie-Viewer ist geöffnet, wenn der Nutzer auf Escape drückt oder außerhalb klickt, dann schließt sich der Viewer
- [ ] Angenommen der Galerie-Viewer zeigt ein Video, dann wird es mit einem eingebetteten Player dargestellt (stumm, mit Controls)
- [ ] Angenommen der Nutzer ist auf einem Mobilgerät, dann kann er durch Wischen (swipe) im Galerie-Viewer zwischen Medien wechseln

### Detail-Modal

- [ ] Angenommen ein Prompt hat mehrere Medien, wenn der Nutzer das Detail-Modal öffnet, dann werden alle Medien in einer horizontalen Scroll-Leiste angezeigt (Thumbnails)
- [ ] Angenommen der Nutzer klickt auf ein Thumbnail, dann wird das entsprechende Medium vergrößert im Modal angezeigt und der Galerie-Viewer öffnet sich

## Edge Cases

- **Gleichzeitiger Upload mehrerer großer Dateien:** Jede Datei hat einen eigenen Fortschrittsbalken; schlägt ein Upload fehl, werden die anderen fortgesetzt und der Fehler einzeln gemeldet
- **Offline während Upload:** Upload-Button wird deaktiviert; nach Verbindungsabbruch erscheint Toast „Upload unterbrochen — bitte erneut versuchen"
- **Prompt wird gelöscht während Medien noch hochgeladen werden:** Upload bricht ab; bereits hochgeladene Dateien werden aus Storage gelöscht (Cleanup)
- **Gleiche Datei zweimal hochgeladen:** Wird als zweites Medium gespeichert (kein Duplikat-Check auf Dateiebene — zu komplex für MVP)
- **Sehr viele Medien (>50 pro Prompt):** Galerie scrollt horizontal; keine Paginierung nötig für MVP
- **Nicht unterstütztes Videoformat (z.B. .avi, .mkv):** Toast „Format nicht unterstützt — bitte mp4, webm oder mov verwenden"
- **cover_image_url Rückwärtskompatibilität:** Bestehende Prompts mit cover_image_url behalten ihr Cover; die alte URL wird als erstes Element in prompt_media gespiegelt (Migration)
- **Löschen eines Mediums das nicht mehr in Storage existiert (404):** Eintrag aus DB wird trotzdem entfernt; kein Fehler geworfen

## Technical Requirements

- Neue Tabelle `prompt_media` in Supabase (id, prompt_id, user_id, type, url, sort_order, created_at)
- RLS: Nutzer kann nur eigene Medien lesen/schreiben (user_id = auth.uid())
- Supabase Storage Bucket `prompt-media` (public read, authenticated write, max 100 MB pro Datei)
- Pfad-Schema: `{user_id}/{prompt_id}/{uuid}.{ext}`
- Migration: bestehende cover_image_url-Werte in prompt_media übernehmen
- Drag & Drop: Browser-native HTML5 DnD API oder leichte Library (keine schwere Dependency)
- Reorder: Drag & Drop innerhalb der Medien-Liste im Formular

## Open Questions
- keine — Anforderungen aus Roadmap-Dokument vollständig spezifiziert

## Decision Log

### Product Decisions
| Entscheidung | Begründung | Datum |
|---|---|---|
| 20 MB Limit für Bilder, 100 MB für Videos | Großzügig genug für Praxis; Supabase Free Tier hat 1 GB Storage gesamt | 2026-06-12 |
| Kein Duplikat-Check auf Dateiebene | Zu komplex für MVP; Nutzer kann Duplikate manuell löschen | 2026-06-12 |
| Rückwärtskompatibilität mit cover_image_url per Migration | Bestehende Daten dürfen nicht verloren gehen | 2026-06-12 |
| Hover-Carousel & Video-Preview auf Kacheln in PROJ-9 | PROJ-8 liefert das Fundament; visuelle Gallery-Improvements sind eigenständig testbar und deploybar | 2026-06-12 |
| Kein Limit für Medien pro Prompt | KI-Power-User haben potenziell viele Output-Bilder pro Prompt | 2026-06-12 |
| Galerie-Viewer im Modal, nicht separate Seite | Behält den Kontext (Prompt-Titel, Tags sichtbar) | 2026-06-12 |

-- ACHTUNG: HISTORIE, kein wiederholbares Skript. NICHT erneut einspielen.
--
-- Was hier steht, war am 01.09.2026 richtig und ist seither zweimal ersetzt
-- worden. Wer diese Datei heute von oben bis unten laufen laesst, bricht die
-- Anwendung — die Schranken darin kennen nur den Stand von damals:
--
--   * `image_jobs_type_check` laesst hier nur 'generate' und 'upscale' zu.
--     Seit proj-43d gibt es 'bearbeitet'. Diese Fassung wuerde jede
--     bearbeitete Fassung ausschliessen — und die vorhandenen Zeilen lassen
--     sie ohnehin nicht mehr setzen.
--   * `image_jobs_scale_check` verlangt hier 2 bis 4. Seit proj-42 hat der
--     Gemini-Weg gar keinen Faktor, sondern eine Zielklasse (`ziel_klasse`),
--     und `scale` darf dort leer sein.
--   * Der Text unten spricht von „rechnerisch vergroessern". Ab proj-42 ist
--     das nur noch einer von mehreren Wegen; Lanczos ist seit dem 02.09.2026
--     aus dem Menue heraus (Mark: „werde ich nie nutzen").
--
-- Der gueltige Stand ergibt sich aus dieser Datei UND proj-42, proj-42b,
-- proj-42c, proj-43, proj-43b, proj-43c, proj-43d — in dieser Reihenfolge.
--
-- PROJ-39: Vorhandene Ergebnisbilder rechnerisch vergrößern.
--
-- Nutzt dieselbe Warteschlange wie die Erzeugung: ein zweiter Auftragstyp statt
-- einer zweiten Tabelle. Damit gelten Übernahme, Versuchszählung, Aufräumen und
-- die Seite /queue unverändert weiter.

alter table public.image_jobs
  add column if not exists job_type    text not null default 'generate',
  add column if not exists source_path text,
  add column if not exists scale       int;

alter table public.image_jobs drop constraint if exists image_jobs_type_check;
alter table public.image_jobs add constraint image_jobs_type_check
  check (job_type in ('generate', 'upscale'));

-- 2x bis 4x. Darüber wird aus 1536x1024 ein Bild jenseits von 6000 Pixeln
-- Kantenlänge, ohne dass ein einziges echtes Detail dazukäme.
alter table public.image_jobs drop constraint if exists image_jobs_scale_check;
alter table public.image_jobs add constraint image_jobs_scale_check
  check (scale is null or scale between 2 and 4);

-- Ein Vergrößerungsauftrag ohne Quellbild wäre ein Auftrag ins Leere: Der
-- Arbeiter würde ihn übernehmen, dreimal scheitern und als fehlgeschlagen
-- ablegen. Die Datenbank lehnt ihn lieber sofort ab.
alter table public.image_jobs drop constraint if exists image_jobs_upscale_needs_source;
alter table public.image_jobs add constraint image_jobs_upscale_needs_source
  check (job_type <> 'upscale' or (source_path is not null and scale is not null));

-- Zweite Ebene neben der Pruefung im Arbeiter: Ein Vergroesserungsauftrag darf
-- nur auf ein Bild im eigenen Ordner zeigen. Der Arbeiter holt es mit dem
-- Service-Key, also unter Umgehung aller Storage-Regeln — ein fremder Pfad
-- waere ein Weg, sich fremde Bilder in den eigenen Ordner kopieren zu lassen.
alter table public.image_jobs drop constraint if exists image_jobs_source_gehoert_nutzer;
alter table public.image_jobs add constraint image_jobs_source_gehoert_nutzer
  check (
    source_path is null
    or (source_path like user_id::text || '/%' and source_path not like '%..%')
  );

comment on column public.image_jobs.job_type is
  'generate = Bild erzeugen, upscale = vorhandenes Ergebnis rechnerisch vergrößern';
comment on column public.image_jobs.source_path is
  'Storage-Pfad des Ausgangsbildes, nur bei job_type = upscale';
comment on column public.image_jobs.scale is
  'Vergrößerungsfaktor 2 bis 4, nur bei job_type = upscale';

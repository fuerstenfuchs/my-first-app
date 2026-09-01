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

comment on column public.image_jobs.job_type is
  'generate = Bild erzeugen, upscale = vorhandenes Ergebnis rechnerisch vergrößern';
comment on column public.image_jobs.source_path is
  'Storage-Pfad des Ausgangsbildes, nur bei job_type = upscale';
comment on column public.image_jobs.scale is
  'Vergrößerungsfaktor 2 bis 4, nur bei job_type = upscale';

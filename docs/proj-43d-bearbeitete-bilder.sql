-- PROJ-43 Phase D: Bearbeitete Bilder als eigener Auftragstyp.
--
-- Zuschneiden und die sieben Regler rechnet der BROWSER, nicht der Arbeiter —
-- das Bild liegt dort ohnehin, und ein Umweg ueber die Warteschlange waere
-- Warten ohne Grund. Der Browser darf auch selbst ablegen: Die Speicherregel
-- `generated write own` erlaubt ihm den eigenen Ordner (nachgemessen).
--
-- Warum ueberhaupt eine Zeile: Ohne sie taucht das bearbeitete Bild im
-- Lichttisch nicht auf. Der liest `image_jobs`, nicht den Speicher.
--
-- Warum ein eigener Typ und nicht ans Original angehaengt: Ein Auftrag mit
-- vier Durchlaeufen bekaeme sonst ein fuenftes Bild, obwohl `variants` vier
-- sagt — und ein erneutes Einreihen wuerde es ueberschreiben. Die Bearbeitung
-- ist eine neue Fassung, kein weiteres Ergebnis desselben Auftrags.
alter table public.image_jobs drop constraint if exists image_jobs_type_check;
alter table public.image_jobs add constraint image_jobs_type_check
  check (job_type in ('generate', 'upscale', 'bearbeitet'));

-- Was am Bild geaendert wurde — Zuschnitt und Reglerstellungen.
-- Damit laesst sich spaeter nachvollziehen, wie eine Fassung entstanden ist,
-- ohne das Original mit dem Ergebnis vergleichen zu muessen.
alter table public.image_jobs
  add column if not exists bearbeitung jsonb;

alter table public.image_jobs drop constraint if exists image_jobs_bearbeitung_nur_bearbeitet;
alter table public.image_jobs add constraint image_jobs_bearbeitung_nur_bearbeitet
  check (bearbeitung is null or job_type = 'bearbeitet');

-- Eine Bearbeitung ohne Ausgangsbild waere eine Fassung von nichts.
alter table public.image_jobs drop constraint if exists image_jobs_bearbeitet_braucht_quelle;
alter table public.image_jobs add constraint image_jobs_bearbeitet_braucht_quelle
  check (job_type <> 'bearbeitet' or (source_path is not null and bearbeitung is not null));

comment on column public.image_jobs.bearbeitung is
  'Zuschnitt und Reglerstellungen einer bearbeiteten Fassung. Nur bei job_type = bearbeitet.';

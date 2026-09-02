-- ── Nachtrag: Gemini als viertes Verfahren ─────────────────────────────────
--
-- Gemini rechnet NICHT in Faktoren. Es kennt Seitenverhältnis plus
-- Größenklasse (1K/2K/4K) — aus 1122×1402 werden 3712×4608, das sind 3,31×
-- und keine glatte Zahl. Die vorhandene Spalte `scale` dafür zu benutzen wäre
-- eine Lüge in den Daten: Dort stünde „3" bei einem Bild, das 3,31× größer ist.
--
-- Deshalb eine eigene Spalte. Welche der beiden gefüllt sein muss, entscheidet
-- das Verfahren — und die Datenbank setzt es durch, statt sich darauf zu
-- verlassen, dass die Oberfläche es richtig macht.
alter table public.image_jobs
  add column if not exists ziel_klasse text;

alter table public.image_jobs drop constraint if exists image_jobs_ziel_klasse_check;
alter table public.image_jobs add constraint image_jobs_ziel_klasse_check
  check (ziel_klasse is null or ziel_klasse in ('1K', '2K', '4K'));

alter table public.image_jobs drop constraint if exists image_jobs_upscaler_check;
alter table public.image_jobs add constraint image_jobs_upscaler_check
  check (upscaler is null or upscaler in ('lanczos', 'seedvr2', 'crystal', 'gemini'));

-- Das Ausgangsbild braucht jeder Vergrößerungsauftrag. Der Faktor nicht mehr —
-- der steckte bisher in derselben Schranke und hätte Gemini ausgeschlossen.
alter table public.image_jobs drop constraint if exists image_jobs_upscale_needs_source;
alter table public.image_jobs add constraint image_jobs_upscale_needs_source
  check (job_type <> 'upscale' or source_path is not null);

-- Genau eine der beiden Zielangaben, passend zum Verfahren.
--
-- ACHTUNG: Diese Fassung traegt sich NICHT selbst — bei upscaler is null ergibt
-- sie NULL und gilt damit als erfuellt. Nachgezogen in proj-42c.
alter table public.image_jobs drop constraint if exists image_jobs_upscale_ziel;
alter table public.image_jobs add constraint image_jobs_upscale_ziel
  check (
    job_type <> 'upscale'
    or (upscaler =  'gemini' and ziel_klasse is not null and scale is null)
    or (upscaler <> 'gemini' and scale       is not null and ziel_klasse is null)
  );

comment on column public.image_jobs.ziel_klasse is
  'Größenklasse 1K/2K/4K — nur bei upscaler = gemini, das keine Faktoren kennt';

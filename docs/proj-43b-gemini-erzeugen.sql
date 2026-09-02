-- PROJ-43b: Gemini darf jetzt auch ERZEUGEN, nicht nur nachbauen.
--
-- Bis hierher galt: `ziel_klasse` nur bei Vergroesserungen. Das war richtig,
-- solange Gemini nur nachbaute. Beim freien Erzeugen braucht es die Klasse
-- aber genauso — Gemini kennt keine Pixelmasse, sondern Seitenverhaeltnis plus
-- Groessenklasse. Ein `size` wie '1536x1024' waere dort eine Angabe ohne
-- Wirkung.
--
-- Die Schranke wird deshalb NICHT einfach fallengelassen, sondern praeziser:
-- Eine Groessenklasse darf stehen, wenn sie auch etwas bedeutet — bei einer
-- Vergroesserung, oder bei einem Auftrag an ein Gemini-Modell.
alter table public.image_jobs drop constraint if exists image_jobs_ziel_klasse_nur_upscale;
alter table public.image_jobs add constraint image_jobs_ziel_klasse_sinnvoll
  check (
    ziel_klasse is null
    or job_type = 'upscale'
    or model like 'gemini%'
  );

comment on column public.image_jobs.ziel_klasse is
  'Groessenklasse 1K/2K/4K. Bei upscaler=gemini die Zielgroesse der Vergroesserung, bei model like gemini% die des erzeugten Bildes. Andere Modelle rechnen in Pixeln (Spalte size).';

-- NACHTRAG: Diese Schranke war nicht dicht — sie liess einen Gemini-Auftrag
-- OHNE Groessenklasse durch. Ersetzt durch proj-43c-gemini-erzeugen-nachgezogen.sql.

-- PROJ-43c: Die Schranke von 43b war nicht dicht.
--
-- Sie lautete: `ziel_klasse is null or job_type = 'upscale' or model like 'gemini%'`
--
-- Damit war ein Gemini-Erzeugungsauftrag OHNE Groessenklasse erlaubt — und der
-- Arbeiter fiel still auf '2K' zurueck. Das ist genau der Fall, der ueber den
-- Scene Builder sofort entsteht: dessen Einreih-Weg kennt `ziel_klasse` gar
-- nicht und schickt null. Jeder Gemini-Auftrag von dort haette in 2K
-- gerechnet, ohne dass jemand 2K gewaehlt haette.
--
-- Jetzt eine AEQUIVALENZ statt einer Oder-Kette: Bei einem Erzeugungsauftrag
-- muss die Groessenklasse genau dann gesetzt sein, wenn das Modell in Klassen
-- rechnet.
alter table public.image_jobs drop constraint if exists image_jobs_ziel_klasse_sinnvoll;
alter table public.image_jobs add constraint image_jobs_ziel_klasse_sinnvoll
  check (
    job_type = 'upscale'
    or ((model like 'gemini%') = (ziel_klasse is not null))
  );

comment on column public.image_jobs.ziel_klasse is
  'Groessenklasse 1K/2K/4K. Bei upscaler=gemini die Zielgroesse der Vergroesserung; bei model like gemini% PFLICHT, weil Gemini nicht in Pixeln rechnet. Andere Modelle: muss null sein.';

-- PROJ-52: Archetypen in die Hauptbereiche zusammenlegen
--
-- Ausgefuehrt am 03.09.2026 gegen die Produktivdatenbank.
-- ADDITIV: nur INSERT. Kein UPDATE, kein DELETE. Die Tabellen
-- character_archetypes, outfit_archetypes, location_archetypes und ihre
-- Bildtabellen bleiben unangetastet als Sicherheitsnetz stehen.
--
-- WIEDERHOLBAR: Jedes Statement ueberspringt, was ueber
-- metadata->>'archetyp_id' schon vorhanden ist.
--
-- UMKEHRBAR:
--   delete from characters where metadata->>'herkunft' = 'archetyp-umzug';
--   delete from outfits    where metadata->>'herkunft' = 'archetyp-umzug';
--   delete from locations  where metadata->>'herkunft' = 'archetyp-umzug';
--   (Varianten und Bilder haengen per ON DELETE daran.)
--
-- Ergebnis: 4 Eintraege, 8 Bilder.

with neu as (
  insert into characters (user_id, name, description, tags, cover_image_url, metadata)
  select a.user_id, a.name, a.long_description, a.tags, a.cover_image_url,
         jsonb_build_object(
           'prompt', a.prompt,
           'short_description', a.short_description,
           'attributes', a.attributes,
           'herkunft', 'archetyp-umzug',
           'archetyp_id', a.id::text
         )
  from character_archetypes a
  where not exists (
    select 1 from characters c where c.metadata->>'archetyp_id' = a.id::text
  )
  returning id, user_id, (metadata->>'archetyp_id')::uuid as alt_id
), var as (
  insert into character_variants (character_id, user_id, name, description, sort_order)
  select n.id, n.user_id, 'Sonstige', 'Aus dem Archetypen-Umzug (PROJ-52).', 0
  from neu n
  returning id as variant_id, character_id
)
insert into character_images (variant_id, user_id, url, storage_path, sort_order)
select v.variant_id, i.user_id, i.url, i.storage_path, i.sort_order
from character_archetype_images i
join neu n on n.alt_id = i.archetype_id
join var v on v.character_id = n.id
returning id;

with neu as (
  insert into outfits (user_id, name, description, tags, cover_image_url, metadata)
  select a.user_id, a.name, a.long_description, a.tags, a.cover_image_url,
         jsonb_build_object(
           'prompt', a.prompt,
           'short_description', a.short_description,
           'attributes', a.attributes,
           'herkunft', 'archetyp-umzug',
           'archetyp_id', a.id::text
         )
  from outfit_archetypes a
  where not exists (
    select 1 from outfits o where o.metadata->>'archetyp_id' = a.id::text
  )
  returning id, user_id, (metadata->>'archetyp_id')::uuid as alt_id
), var as (
  insert into outfit_variants (outfit_id, user_id, name, description, sort_order)
  select n.id, n.user_id, 'Sonstige', 'Aus dem Archetypen-Umzug (PROJ-52).', 0
  from neu n
  returning id as variant_id, outfit_id
)
insert into outfit_images (variant_id, user_id, url, storage_path, sort_order)
select v.variant_id, i.user_id, i.url, i.storage_path, i.sort_order
from outfit_archetype_images i
join neu n on n.alt_id = i.archetype_id
join var v on v.outfit_id = n.id
returning id;

with neu as (
  insert into locations (user_id, name, description, category, tags, cover_image_url, metadata)
  select a.user_id, a.name, a.long_description, a.category, a.tags, a.cover_image_url,
         jsonb_build_object(
           'prompt', a.prompt,
           'short_description', a.short_description,
           'herkunft', 'archetyp-umzug',
           'archetyp_id', a.id::text
         )
  from location_archetypes a
  where not exists (
    select 1 from locations l where l.metadata->>'archetyp_id' = a.id::text
  )
  returning id, user_id, (metadata->>'archetyp_id')::uuid as alt_id
), var as (
  insert into location_variants (location_id, user_id, name, description, sort_order)
  select n.id, n.user_id, 'Sonstige', 'Aus dem Archetypen-Umzug (PROJ-52).', 0
  from neu n
  returning id as variant_id, location_id
)
insert into location_images (variant_id, user_id, url, storage_path, sort_order)
select v.variant_id, i.user_id, i.url, i.storage_path, i.sort_order
from location_archetype_images i
join neu n on n.alt_id = i.archetype_id
join var v on v.location_id = n.id
returning id;

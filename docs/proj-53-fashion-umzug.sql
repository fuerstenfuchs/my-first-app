-- PROJ-53: Fashion Assets in Outfits zusammenlegen
--
-- Ausgefuehrt am 03.09.2026 gegen die Produktivdatenbank, in zwei Schritten.
-- ADDITIV: nur ALTER/INSERT plus ein einmaliges UPDATE zum Nachtragen der
-- Kategorie. Kein DELETE. fashion_assets, fashion_asset_variants und
-- fashion_asset_images bleiben als Sicherheitsnetz stehen.
--
-- ACHTUNG, WICHTIG: Der Speicher-Eimer `fashion-assets` ist NICHT stillgelegt.
-- Der Umzug hat Datenbankzeilen kopiert, KEINE Dateien. Nachgemessen am
-- 03.09.2026: 17 der 19 Titelbilder und alle 9 Variantenbilder der
-- umgezogenen Eintraege liegen weiterhin dort. Wer diesen Eimer loescht,
-- loescht Bilder aus der aktiven Bibliothek.
--
-- WIEDERHOLBAR: ueberspringt, was ueber metadata->>'fashion_id' schon da ist.
-- UMKEHRBAR:  delete from outfits where metadata->>'herkunft' = 'fashion-umzug';
--
-- Ergebnis: 19 Eintraege, 9 Varianten, 9 Bilder.

-- Schritt 1 — Schema (outfits fehlten vier Spalten, die fashion_assets hat)
alter table outfits
  add column if not exists category text,
  add column if not exists source_url text,
  add column if not exists source_title text,
  add column if not exists crop_image_url text;

update outfits set category = 'komplett' where category is null;

alter table outfits alter column category set default 'komplett';

-- Schritt 2 — Datenumzug
with neu as (
  insert into outfits (user_id, name, description, category, tags,
                       cover_image_url, crop_image_url, source_url, source_title, metadata)
  select f.user_id, f.name, f.description, f.category, f.tags,
         f.cover_image_url, f.crop_image_url, f.source_url, f.source_title,
         coalesce(f.metadata, '{}'::jsonb) || jsonb_build_object(
           'herkunft', 'fashion-umzug',
           'fashion_id', f.id::text
         )
  from fashion_assets f
  where not exists (
    select 1 from outfits o where o.metadata->>'fashion_id' = f.id::text
  )
  returning id, user_id, (metadata->>'fashion_id')::uuid as alt_id
), var as (
  insert into outfit_variants (outfit_id, user_id, name, description, sort_order)
  select n.id, fv.user_id, fv.name, fv.description, fv.sort_order
  from fashion_asset_variants fv
  join neu n on n.alt_id = fv.asset_id
  returning id as neue_variante, outfit_id, sort_order, name
)
insert into outfit_images (variant_id, user_id, url, storage_path, sort_order)
select v.neue_variante, fi.user_id, fi.url, fi.storage_path, fi.sort_order
from fashion_asset_images fi
join fashion_asset_variants fv on fv.id = fi.variant_id
join neu n on n.alt_id = fv.asset_id
join var v on v.outfit_id = n.id and v.sort_order = fv.sort_order and v.name = fv.name
returning id;

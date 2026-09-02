import { Users, Shirt, ShoppingBag, MapPin, Drama, type LucideIcon } from 'lucide-react'

/**
 * Die Bausteine als Daten — wohin ein fertiges Bild übernommen werden kann.
 *
 * WARUM ALS TABELLE UND NICHT ALS FÜNF FUNKTIONEN: Die fünf Bibliotheken sind
 * bis auf Namen identisch gebaut. Nachgemessen am 02.09.2026 — alle fünf
 * Bildtabellen haben exakt dieselben Spalten:
 *
 *     id, variant_id, user_id, url, storage_path, sort_order, created_at
 *
 * Im Projekt steht der Ablauf „hochladen → öffentliche Adresse holen →
 * Zeile einfügen" trotzdem acht- bis zehnmal da, jedes Mal leicht anders
 * (mal UUID, mal Zeitstempel im Dateinamen, mal `Promise.all`, mal Schleife).
 * Genau daraus entstehen die Unterschiede, die später niemand mehr erklären
 * kann. Ein sechster Baustein ist hier ein Eintrag, keine Kopie.
 */

export type BausteinSchluessel = 'charaktere' | 'outfits' | 'fashion' | 'locations' | 'posen'

export type Baustein = {
  schluessel: BausteinSchluessel
  /** Wie es im Menü heißt. */
  label: string
  /** Einzahl, für Sätze wie „Charakter suchen". */
  einzahl: string
  icon: LucideIcon
  /** Die Haupttabelle — daraus kommt die Auswahlliste. */
  tabelle: string
  /** Die Variantentabelle und ihr Fremdschlüssel auf die Haupttabelle. */
  variantenTabelle: string
  variantenFk: string
  /** Wohin die Bildzeile geschrieben wird. */
  bildTabelle: string
  /** In welchen Speicher-Eimer die Datei kommt. */
  bucket: string
  /** Wohin in der App, um das Ergebnis anzusehen. */
  href: string
}

export const BAUSTEINE: Baustein[] = [
  {
    schluessel: 'charaktere', label: 'Charaktere', einzahl: 'Charakter', icon: Users,
    tabelle: 'characters', variantenTabelle: 'character_variants', variantenFk: 'character_id',
    bildTabelle: 'character_images', bucket: 'character-images', href: '/characters',
  },
  {
    schluessel: 'outfits', label: 'Outfits', einzahl: 'Outfit', icon: Shirt,
    tabelle: 'outfits', variantenTabelle: 'outfit_variants', variantenFk: 'outfit_id',
    bildTabelle: 'outfit_images', bucket: 'outfit-images', href: '/outfits',
  },
  {
    schluessel: 'fashion', label: 'Fashion', einzahl: 'Fashion Asset', icon: ShoppingBag,
    tabelle: 'fashion_assets', variantenTabelle: 'fashion_asset_variants', variantenFk: 'asset_id',
    bildTabelle: 'fashion_asset_images', bucket: 'fashion-assets', href: '/fashion-assets',
  },
  {
    schluessel: 'locations', label: 'Locations', einzahl: 'Location', icon: MapPin,
    tabelle: 'locations', variantenTabelle: 'location_variants', variantenFk: 'location_id',
    bildTabelle: 'location_images', bucket: 'location-images', href: '/locations',
  },
  {
    schluessel: 'posen', label: 'Posen', einzahl: 'Pose', icon: Drama,
    tabelle: 'pose_actions', variantenTabelle: 'pose_action_variants', variantenFk: 'pose_action_id',
    bildTabelle: 'pose_action_images', bucket: 'pose-action-images', href: '/pose-actions',
  },
]

export function baustein(schluessel: BausteinSchluessel): Baustein {
  const b = BAUSTEINE.find(x => x.schluessel === schluessel)
  if (!b) throw new Error(`Unbekannter Baustein: ${schluessel}`)
  return b
}

/**
 * Der Ablagepfad einer übernommenen Datei.
 *
 * Einheitlich für alle fünf, obwohl die vorhandenen Wege sich unterscheiden.
 * Das ist gefahrlos: Gelöscht wird über die Spalte `storage_path`, nicht über
 * einen aus Kennungen zusammengebauten Pfad — nachgemessen in allen fünf Hooks.
 */
export function ablagepfad(
  userId: string, parentId: string, variantId: string, endung: string,
): string {
  const marke = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return `${userId}/${parentId}/${variantId}/${marke}.${endung}`
}

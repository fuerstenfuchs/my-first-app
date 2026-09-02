import {
  Users, Shirt, ShoppingBag, MapPin, Drama, FileText, Sparkles, type LucideIcon,
} from 'lucide-react'

/**
 * Die Bausteine als Daten — wohin ein fertiges Bild übernommen werden kann.
 *
 * WARUM ALS TABELLE UND NICHT ALS NEUN FUNKTIONEN: Die Bibliotheken sind bis
 * auf Namen fast gleich gebaut. Nachgemessen am 02.09.2026 haben alle
 * Bildtabellen dieselben Spalten — bis auf drei Unterschiede, die hier als
 * Felder stehen statt als `if` im Ablauf:
 *
 *  1. Die einen hängen an einer VARIANTE (`variant_id`), die Archetypen direkt
 *     am Eintrag (`archetype_id`), die Prompts am Prompt (`prompt_id`).
 *  2. `prompt_media` hat KEINE Spalte `storage_path` — dort merkt sich die App
 *     den Speicherpfad nicht.
 *  3. `prompt_media` verlangt ein `type` ('image' oder 'video', per Schranke).
 *
 * Im Projekt steht der Ablauf „hochladen → öffentliche Adresse holen → Zeile
 * einfügen" acht- bis zehnmal da, jedes Mal leicht anders. Genau daraus
 * entstehen die Unterschiede, die später niemand mehr erklären kann. Ein
 * zehnter Baustein ist hier ein Eintrag, keine Kopie.
 */

export type BausteinSchluessel =
  | 'charaktere' | 'outfits' | 'fashion' | 'locations' | 'posen'
  | 'charakter-archetypen' | 'outfit-archetypen' | 'location-archetypen'
  | 'prompts'

export type Baustein = {
  schluessel: BausteinSchluessel
  /** Wie es im Menü heißt. */
  label: string
  /** Einzahl, für Sätze wie „Charakter suchen". */
  einzahl: string
  icon: LucideIcon
  /** Die Haupttabelle — daraus kommt die Auswahlliste. */
  tabelle: string
  /**
   * Wie die Spalte mit dem Anzeigenamen heißt.
   * Bei `prompts` ist es `title`, überall sonst `name`.
   */
  namensSpalte: 'name' | 'title'
  /**
   * Variantentabelle und ihr Fremdschlüssel — fehlt bei Archetypen und
   * Prompts, dort hängen die Bilder direkt am Eintrag.
   */
  varianten?: { tabelle: string; fk: string }
  /** Wohin die Bildzeile geschrieben wird. */
  bildTabelle: string
  /** Der Fremdschlüssel in der Bildtabelle. */
  bildFk: 'variant_id' | 'archetype_id' | 'prompt_id'
  /** In welchen Speicher-Eimer die Datei kommt. */
  bucket: string
  /** Hat die Bildtabelle eine Spalte `storage_path`? prompt_media nicht. */
  hatStoragePath: boolean
  /** Feste Zusatzfelder beim Einfügen — `prompt_media` verlangt `type`. */
  zusatz?: Record<string, unknown>
  /** Wohin in der App, um das Ergebnis anzusehen. */
  href: string
}

export const BAUSTEINE: Baustein[] = [
  {
    schluessel: 'charaktere', label: 'Charaktere', einzahl: 'Charakter', icon: Users,
    tabelle: 'characters', namensSpalte: 'name',
    varianten: { tabelle: 'character_variants', fk: 'character_id' },
    bildTabelle: 'character_images', bildFk: 'variant_id',
    bucket: 'character-images', hatStoragePath: true, href: '/characters',
  },
  {
    schluessel: 'outfits', label: 'Outfits', einzahl: 'Outfit', icon: Shirt,
    tabelle: 'outfits', namensSpalte: 'name',
    varianten: { tabelle: 'outfit_variants', fk: 'outfit_id' },
    bildTabelle: 'outfit_images', bildFk: 'variant_id',
    bucket: 'outfit-images', hatStoragePath: true, href: '/outfits',
  },
  {
    schluessel: 'fashion', label: 'Fashion', einzahl: 'Fashion Asset', icon: ShoppingBag,
    tabelle: 'fashion_assets', namensSpalte: 'name',
    varianten: { tabelle: 'fashion_asset_variants', fk: 'asset_id' },
    bildTabelle: 'fashion_asset_images', bildFk: 'variant_id',
    bucket: 'fashion-assets', hatStoragePath: true, href: '/fashion-assets',
  },
  {
    schluessel: 'locations', label: 'Locations', einzahl: 'Location', icon: MapPin,
    tabelle: 'locations', namensSpalte: 'name',
    varianten: { tabelle: 'location_variants', fk: 'location_id' },
    bildTabelle: 'location_images', bildFk: 'variant_id',
    bucket: 'location-images', hatStoragePath: true, href: '/locations',
  },
  {
    schluessel: 'posen', label: 'Posen', einzahl: 'Pose', icon: Drama,
    tabelle: 'pose_actions', namensSpalte: 'name',
    varianten: { tabelle: 'pose_action_variants', fk: 'pose_action_id' },
    bildTabelle: 'pose_action_images', bildFk: 'variant_id',
    bucket: 'pose-action-images', hatStoragePath: true, href: '/pose-actions',
  },

  // Prompts: Bilder hängen am Prompt, die Tabelle kennt keinen Speicherpfad
  // und verlangt ein `type` — beides steht hier, nicht als Sonderfall im Code.
  {
    schluessel: 'prompts', label: 'Prompts', einzahl: 'Prompt', icon: FileText,
    tabelle: 'prompts', namensSpalte: 'title',
    bildTabelle: 'prompt_media', bildFk: 'prompt_id',
    bucket: 'prompt-media', hatStoragePath: false,
    zusatz: { type: 'image' },
    href: '/',
  },

  // Die Archetypen haben keine Varianten — die Bilder hängen direkt am Eintrag.
  {
    schluessel: 'charakter-archetypen', label: 'Charakter-Arch.', einzahl: 'Archetyp',
    icon: Sparkles, tabelle: 'character_archetypes', namensSpalte: 'name',
    bildTabelle: 'character_archetype_images', bildFk: 'archetype_id',
    bucket: 'character-archetype-images', hatStoragePath: true,
    href: '/character-archetypes',
  },
  {
    schluessel: 'outfit-archetypen', label: 'Outfit-Arch.', einzahl: 'Archetyp',
    icon: Sparkles, tabelle: 'outfit_archetypes', namensSpalte: 'name',
    bildTabelle: 'outfit_archetype_images', bildFk: 'archetype_id',
    bucket: 'outfit-archetype-images', hatStoragePath: true,
    href: '/outfit-archetypes',
  },
  {
    schluessel: 'location-archetypen', label: 'Location-Arch.', einzahl: 'Archetyp',
    icon: Sparkles, tabelle: 'location_archetypes', namensSpalte: 'name',
    bildTabelle: 'location_archetype_images', bildFk: 'archetype_id',
    bucket: 'location-archetype-images', hatStoragePath: true,
    href: '/location-archetypes',
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
 * Einheitlich, obwohl die vorhandenen Wege sich unterscheiden. Gefahrlos, weil
 * über die Spalte `storage_path` gelöscht wird und nicht über einen aus
 * Kennungen zusammengebauten Pfad — nachgemessen in allen Hooks.
 *
 * Der erste Ordner MUSS die Nutzerkennung sein: Genau darauf prüfen die
 * Speicherregeln (`storage.foldername(name)[1] = auth.uid()`).
 */
export function ablagepfad(
  userId: string, parentId: string, variantId: string | null, endung: string,
): string {
  const marke = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const mitte = variantId ? `${parentId}/${variantId}` : parentId
  return `${userId}/${mitte}/${marke}.${endung}`
}

/**
 * Die Kategorien eines Outfit-Eintrags (PROJ-53).
 *
 * WARUM EIGENE DATEI UND NICHT IM HOOK: Diese Liste wird von der Seite, dem
 * Formular, dem Sheet-Dialog und dem Hook gebraucht. Stünde sie in
 * `use-outfits.ts`, zöge jede dieser Stellen ein `'use client'`-Modul mit
 * React-Zustand nach sich, nur um an acht Zeilen Text zu kommen. Als reine
 * Daten ist sie überall importierbar — auch aus einem Server-Modul.
 *
 * WARUM „komplett" AN ERSTER STELLE: Das ist, was die 17 vorhandenen Outfits
 * sind, und der ursprüngliche Zweck des Bereichs. Die acht folgenden Schlüssel
 * stammen unverändert aus `FASHION_CATEGORIES` (PROJ-21) — sie stehen SO in
 * der Datenbank und dürfen sich nicht ändern.
 */
export const OUTFIT_KATEGORIEN = [
  { key: 'komplett',        label: 'Komplett-Look',    emoji: '🧍' },
  { key: 'oberteile',       label: 'Oberteile',        emoji: '👕' },
  { key: 'unterteile',      label: 'Unterteile',       emoji: '👖' },
  { key: 'kleider',         label: 'Kleider',          emoji: '👗' },
  { key: 'jacken',          label: 'Jacken',           emoji: '🧥' },
  { key: 'schuhe',          label: 'Schuhe',           emoji: '👞' },
  { key: 'accessoires',     label: 'Accessoires',      emoji: '🕶️' },
  { key: 'kopfbedeckungen', label: 'Kopfbedeckungen',  emoji: '🎩' },
  { key: 'sonstiges',       label: 'Sonstiges',        emoji: '🛍️' },
] as const

export type OutfitKategorie = typeof OUTFIT_KATEGORIEN[number]['key']

/** Die Vorgabe — dieselbe wie der Spaltenstandard in der Datenbank. */
export const OUTFIT_KATEGORIE_STANDARD: OutfitKategorie = 'komplett'

/**
 * Die acht Kleidungsstück-Kategorien — alles außer `komplett`.
 *
 * Für sie gibt es das Sheet-Erzeugen (`FashionSheetDialog`); ein
 * Komplett-Look bekommt stattdessen das Ghost-Mannequin-Sheet je Variante.
 */
export function istKleidungsstueck(kategorie: string | null | undefined): boolean {
  return !!kategorie && kategorie !== 'komplett'
}

/** Ein Kategoriewert, der wirklich in der Liste steht — sonst die Vorgabe. */
export function alsKategorie(wert: unknown): OutfitKategorie {
  return OUTFIT_KATEGORIEN.some(k => k.key === wert)
    ? wert as OutfitKategorie
    : OUTFIT_KATEGORIE_STANDARD
}

export function kategorieEintrag(kategorie: string | null | undefined) {
  return OUTFIT_KATEGORIEN.find(k => k.key === kategorie) ?? OUTFIT_KATEGORIEN[0]
}

/**
 * Die englische Bezeichnung fürs Sheet-Erzeugen.
 *
 * Unverändert aus `fashion-sheet-dialog.tsx` übernommen; `komplett` ist neu
 * hinzugekommen, damit der Datensatz vollständig ist — angeboten wird der
 * Dialog für Komplett-Looks aber nicht.
 */
export const KATEGORIE_EN: Record<OutfitKategorie, string> = {
  komplett:        'complete outfit / full look',
  oberteile:       'top / shirt',
  unterteile:      'pants / trousers',
  kleider:         'dress',
  jacken:          'jacket / coat',
  schuhe:          'shoes',
  accessoires:     'accessory',
  kopfbedeckungen: 'hat / headwear',
  sonstiges:       'garment',
}

/**
 * Dieselben Beschriftungen als Nachschlagetabelle.
 *
 * WARUM: Bis PROJ-46 stand „komplett" an drei Stellen in drei Schreibweisen —
 * roh im Scene Builder, „Komplett" im Übernehmen-Dialog (dort leitet
 * `kategorieLabel()` den Text aus dem technischen Schlüssel ab) und
 * „Komplett-Look" auf der Outfit-Seite. Ein unabhängiger Prüfdurchgang hat das
 * am 03.09.2026 als Befund gemeldet.
 *
 * Die Tabelle wird HIER aus `OUTFIT_KATEGORIEN` abgeleitet und nicht daneben
 * getippt: eine zweite Liste wäre genau die zweite Quelle, aus der die drei
 * Schreibweisen überhaupt erst entstanden sind.
 */
export const OUTFIT_KATEGORIE_LABELS: Record<string, string> =
  Object.fromEntries(OUTFIT_KATEGORIEN.map(k => [k.key, k.label]))

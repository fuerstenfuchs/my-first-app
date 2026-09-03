import {
  LayoutGrid, Users, Shirt, MapPin, Drama, Camera, Palette,
  Clapperboard, Images, Aperture, type LucideIcon,
} from 'lucide-react'

/**
 * Die Navigation als Daten statt als dreizehnmal kopiertes JSX.
 *
 * Jeder neue Bereich hieß bisher: vierzehn Zeilen Markup mit vier eingebauten
 * Farbwerten kopieren und anpassen. So ist die Leiste von sechs auf vierzehn
 * Einträge und 2008 Pixel Höhe gewachsen — über zwei Bildschirmhöhen.
 *
 * Die Farben sind unverändert aus dem alten Markup übernommen.
 */

export type NavFarben = {
  /** Grundfläche der Kachel, zwei Stufen. */
  grund: [string, string]
  /** Randverlauf, wenn die Seite offen ist. */
  aktiv: [string, string]
  /** Randverlauf sonst. */
  ruhe: [string, string]
  /** Der Schein außen herum. */
  schein: string
  /** Tailwind-Klasse für das Symbol. */
  symbol: string
}

export type NavEintrag = {
  href: string
  label: string
  /** Kurzform fürs zweispaltige Raster, wo die Breite knapp ist. */
  kurz?: string
  icon: LucideIcon
  farben: NavFarben
}

const f = (
  grund: [string, string], aktiv: [string, string], ruhe: [string, string],
  schein: string, symbol: string,
): NavFarben => ({ grund, aktiv, ruhe, schein, symbol })

/** Ganz oben, in voller Breite: der Einstieg in die Prompts. */
export const PROMPTS: NavEintrag = {
  href: '/', label: 'Alle Prompts', icon: LayoutGrid,
  farben: f(['#0d1a0e', '#111810'], ['#22c55e', '#ea580c'], ['#22c55e', '#ea580c'],
    '0 0 18px rgba(34,197,94,0.25), 0 0 18px rgba(234,88,12,0.15)', 'text-orange-400'),
}

/**
 * Die Bibliotheken — zweispaltig als Raster.
 *
 * Die Archetypen standen hier einmal als drei eigene Einträge, dann als Reiter
 * auf der jeweiligen Seite. Seit PROJ-52 gibt es sie gar nicht mehr: Charaktere,
 * Outfits und Locations sind je EIN Bereich.
 *
 * „Fashion Assets" stand hier bis PROJ-53 als eigener Eintrag. Die einzelnen
 * Kleidungsstücke sind seither Einträge unter „Outfits" mit einer Kategorie —
 * ein Bereich weniger in einer Leiste, die genau daran krankte.
 */
export const BAUSTEINE: NavEintrag[] = [
  {
    href: '/characters', label: 'Charaktere', icon: Users,
    farben: f(['#0d0d1f', '#111018'], ['#818cf8', '#c084fc'], ['#4f46e5', '#7c3aed'],
      '0 0 18px rgba(99,102,241,0.2), 0 0 18px rgba(139,92,246,0.15)', 'text-violet-400'),
  },
  {
    href: '/outfits', label: 'Outfits', icon: Shirt,
    farben: f(['#1a0e06', '#181108'], ['#fb923c', '#f97316'], ['#ea580c', '#c2410c'],
      '0 0 18px rgba(234,88,12,0.2), 0 0 18px rgba(194,65,12,0.15)', 'text-orange-400'),
  },
  {
    href: '/locations', label: 'Locations', icon: MapPin,
    farben: f(['#061a1a', '#061818'], ['#2dd4bf', '#0891b2'], ['#0d9488', '#0e7490'],
      '0 0 18px rgba(13,148,136,0.2), 0 0 18px rgba(14,116,144,0.15)', 'text-teal-400'),
  },
  {
    href: '/pose-actions', label: 'Posen & Aktionen', kurz: 'Posen', icon: Drama,
    farben: f(['#0f0614', '#0d0512'], ['#c084fc', '#a855f7'], ['#9333ea', '#7e22ce'],
      '0 0 18px rgba(147,51,234,0.2), 0 0 18px rgba(126,34,206,0.15)', 'text-purple-400'),
  },
  {
    href: '/visual-assets', label: 'Kamera, Licht & Mimik', kurz: 'Kamera & Licht', icon: Camera,
    farben: f(['#061318', '#061116'], ['#38bdf8', '#0284c7'], ['#0ea5e9', '#0369a1'],
      '0 0 18px rgba(14,165,233,0.2), 0 0 18px rgba(3,105,161,0.15)', 'text-sky-400'),
  },
  {
    href: '/look-grading', label: 'Look & Grading', kurz: 'Look & Grading', icon: Palette,
    farben: f(['#1a0617', '#170614'], ['#f0abfc', '#d946ef'], ['#c026d3', '#a21caf'],
      '0 0 18px rgba(192,38,211,0.2), 0 0 18px rgba(162,28,175,0.15)', 'text-fuchsia-400'),
  },
]

/**
 * Statistiken gehören nicht zu den Bausteinen — sie sind eine Auswertung, kein
 * Material. Sie standen dort nur, damit acht Kacheln ein sauberes Raster
 * ergeben; das ist ein Grund aus der Gestaltung, keiner aus der Sache. Jetzt in
 * der Fußzeile bei Einstellungen und Abmelden.
 */

/** Die Werkbank — steht jetzt oben statt auf Platz zwölf. */
export const PRODUKTION: NavEintrag[] = [
  {
    // Der Lichttisch: alle Bilder als Raster. Steht VOR der Warteschlange,
    // weil er die Oberfläche für den Normalfall ist — die Warteschlange ist
    // der Maschinenraum für den Ausnahmefall.
    href: '/bildstudio', label: 'Bildstudio', icon: Aperture,
    farben: f(['#160a1a', '#130918'], ['#c084fc', '#7c3aed'], ['#a855f7', '#6d28d9'],
      '0 0 18px rgba(168,85,247,0.22), 0 0 18px rgba(109,40,217,0.15)', 'text-purple-400'),
  },
  {
    href: '/scene-builder', label: 'Scene Builder', icon: Clapperboard,
    farben: f(['#1a1206', '#181006'], ['#fbbf24', '#d97706'], ['#f59e0b', '#b45309'],
      '0 0 18px rgba(245,158,11,0.2), 0 0 18px rgba(180,83,9,0.15)', 'text-amber-400'),
  },
  {
    href: '/queue', label: 'Warteschlange', icon: Images,
    farben: f(['#04150f', '#03120d'], ['#34d399', '#059669'], ['#10b981', '#047857'],
      '0 0 18px rgba(16,185,129,0.2), 0 0 18px rgba(4,120,87,0.15)', 'text-emerald-400'),
  },
]

/** Der Farbaufbau einer Kachel — eine Stelle für alle. */
export function kachelStil(farben: NavFarben, aktiv: boolean): React.CSSProperties {
  const rand = aktiv ? farben.aktiv : farben.ruhe
  return {
    background:
      `linear-gradient(${farben.grund[0]}, ${farben.grund[1]}) padding-box, ` +
      `linear-gradient(135deg, ${rand[0]} 0%, ${rand[1]} 100%) border-box`,
    border: '2px solid transparent',
    boxShadow: farben.schein,
  }
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * Umschalter zwischen einer Bibliothek und ihren Archetypen.
 *
 * Vorher standen beide als eigene Punkte in der Seitenleiste — sechs Einträge
 * für drei Themen. Inhaltlich gehören sie zusammen: Ein Archetyp ist die
 * Alternative zum echten Asset, und der Scene Builder behandelt sie auch so
 * (echtes Asset schlägt Archetyp). Als Reiter auf der Seite selbst sind sie
 * einen Klick entfernt statt einen Menüpunkt.
 */

type Paar = {
  echt:      { href: string; label: string }
  archetyp:  { href: string; label: string }
}

/**
 * Kurze Beschriftungen: Die Reiter stehen teils in sehr schmalen Kopfzeilen —
 * die Locations-Spalte ist 192px breit, die Charakter-Spalte 288px. Mit
 * „Meine Locations | Archetypen" waere die Zeile breiter als die Spalte gewesen
 * und haette den Knopf zum Anlegen hinausgedrueckt.
 */
const PAARE: Paar[] = [
  {
    echt:     { href: '/characters',           label: 'Meine' },
    archetyp: { href: '/character-archetypes', label: 'Archetypen' },
  },
  {
    echt:     { href: '/outfits',              label: 'Meine' },
    archetyp: { href: '/outfit-archetypes',    label: 'Archetypen' },
  },
  {
    echt:     { href: '/locations',            label: 'Meine' },
    archetyp: { href: '/location-archetypes',  label: 'Archetypen' },
  },
]

export function LibraryTabs() {
  const pathname = usePathname()
  const paar = PAARE.find(p => p.echt.href === pathname || p.archetyp.href === pathname)
  if (!paar) return null

  return (
    <div className="flex min-w-0 shrink items-center gap-0.5 rounded-md bg-muted/40 p-0.5">
      {[paar.echt, paar.archetyp].map(reiter => {
        const aktiv = pathname === reiter.href
        return (
          <Link
            key={reiter.href}
            href={reiter.href}
            aria-current={aktiv ? 'page' : undefined}
            className={cn(
              'truncate rounded px-1.5 py-1 text-[11px] font-medium transition',
              aktiv
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {reiter.label}
          </Link>
        )
      })}
    </div>
  )
}

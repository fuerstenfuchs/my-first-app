'use client'

import { useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Library, BarChart2, LogOut, Settings } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { PROMPTS, BAUSTEINE, PRODUKTION } from '@/lib/sidebar-nav'
import './sidebar-glas.css'


export function AppSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  /*
    KEINE SAMMLUNGSDATEN MEHR IN DER LEISTE (05.09.2026).

    Mit der aufklappbaren Liste sind auch die Abfragen weg. Sie liefen bisher
    auf JEDER Seite der App mit — zwei Abfragen plus eine Uebersicht, nur um
    eine zugeklappte Liste zu fuellen, die Mark nach eigener Aussage kaum
    anklicken konnte. Die Sammlungen selbst bleiben; sie haben eine eigene
    Seite, und der Weg dorthin steht unten in der Fusszeile.
  */

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  /**
   * Der Lichtschein folgt dem Zeiger (PROJ-60).
   *
   * Er wird als CSS-Variable auf das Element geschrieben, nicht als React-
   * Zustand: Bei Mausbewegung würde ein `setState` die ganze Leiste bei jedem
   * Pixel neu zeichnen. So fasst der Browser nur zwei Zahlen an.
   *
   * DREI EINSCHRÄNKUNGEN, ALLE DREI AUS DEM GLEICHEN GRUND — es soll nichts
   * rechnen, was niemand sieht (gefunden von Critic am 05.09.2026):
   *
   * 1. NUR MAUS. Beim Wischen über das Telefon feuert `pointermove` für den
   *    Finger, der auf einer Kachel liegt — ausgerechnet während des Rollens,
   *    wo am wenigsten Luft ist. Sichtbar wird der Schein aber nur bei `:hover`,
   *    und Hover gibt es dort nicht. Der Aufwand wäre reiner Verlust.
   * 2. NICHT BEI ABGESCHALTETER BEWEGUNG. Ein Licht, das der Maus hinterher-
   *    läuft, ist genau die Art Bewegung, die jemand abgestellt hat. Das CSS
   *    nimmt schon Hub und Einsinken zurück; hier fehlte die Entsprechung.
   * 3. EINMAL MESSEN STATT BEI JEDEM PIXEL. `getBoundingClientRect` zwingt den
   *    Browser, das Layout sofort durchzurechnen; direkt danach wurde derselbe
   *    Kasten wieder beschrieben. Bei 120 Hz also 120-mal je Sekunde hin und
   *    her. Das Rechteck ändert sich zwischen zwei Bewegungen nicht — außer
   *    beim Rollen, und genau das fängt die Prüfung unten ab.
   */
  const rahmen = useRef<DOMRect | null>(null)
  const ruhig = useRef(false)

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    const merken = () => { ruhig.current = m.matches }
    merken()
    m.addEventListener('change', merken)
    return () => m.removeEventListener('change', merken)
  }, [])

  function scheinBeginnen(e: React.PointerEvent<HTMLElement>) {
    if (e.pointerType !== 'mouse' || ruhig.current) { rahmen.current = null; return }
    rahmen.current = e.currentTarget.getBoundingClientRect()
  }

  function scheinFolgen(e: React.PointerEvent<HTMLElement>) {
    let r = rahmen.current
    if (!r) return
    const el = e.currentTarget
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    // Nach einem Rollvorgang steht die Kachel woanders; dann — und nur dann —
    // wird neu gemessen. Erkennbar daran, dass der Zeiger rechnerisch
    // ausserhalb der gemerkten Kachel liegt, obwohl er auf ihr steht.
    if (x < 0 || y < 0 || x > r.width || y > r.height) {
      r = rahmen.current = el.getBoundingClientRect()
    }
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  return (
    <Sidebar className="leiste-stein font-[family-name:var(--font-leiste)]">
      {/*
        Hoehe begrenzt: Das Logo ist quadratisch angelegt und wurde in voller
        Breite 205px hoch — nach dem Verkuerzen der Leiste war es mit 40 Prozent
        der groesste Block darin. Auf Marks Wunsch wieder auf 192px — die 96px
        des ersten Versuchs waren ihm zu klein.
      */}
      <SidebarHeader className="p-3 pb-1">
        <div className="glas-marke rounded-xl px-3 py-2">
          <img
            src="/logo-leiste.png"
            alt="Prompt Trésor"
            className="mx-auto max-h-44 w-auto object-contain"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/*
          In eine SidebarGroup wie die anderen Bloecke: Die Group bringt p-2
          mit. Ohne sie war diese Kachel 16px breiter als Scene Builder und
          Warteschlange und lief rechts ueber den Rand — der Farbrand war dort
          abgeschnitten.
        */}
        <SidebarGroup className="py-1">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem className="px-2 py-1.5">
            <a
              href={PROMPTS.href}
              aria-current={pathname === '/' ? 'page' : undefined}
              className="glas-kachel flex w-full items-center rounded-xl"
              data-aktiv={pathname === '/' ? 'ja' : 'nein'}
              onPointerEnter={scheinBeginnen}
              onPointerMove={scheinFolgen}
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center">
                <PROMPTS.icon className={cn('h-6 w-6', pathname === '/' ? 'text-orange-300' : 'text-white/80')} />
              </div>
              <span className="px-3 text-base font-semibold text-white">{PROMPTS.label}</span>
            </a>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/*
          Die Werkbank steht oben, nicht auf Platz zwölf: Scene Builder und
          Warteschlange braucht Mark täglich, die Bibliotheken seltener.
        */}
        <SidebarGroup className="py-1">
          <SidebarGroupLabel>Produktion</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {PRODUKTION.map(e => (
                <SidebarMenuItem key={e.href} className="px-2 py-1.5">
                  <a
                    href={e.href}
                    aria-current={pathname.startsWith(e.href) ? 'page' : undefined}
                    className="glas-kachel flex w-full items-center rounded-xl"
                    data-aktiv={pathname.startsWith(e.href) ? 'ja' : 'nein'}
                    onPointerEnter={scheinBeginnen}
                    onPointerMove={scheinFolgen}
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center">
                      <e.icon className={cn('h-6 w-6',
                        pathname.startsWith(e.href) ? 'text-orange-300' : 'text-white/80')} />
                    </div>
                    <span className="px-3 text-base font-semibold text-white">{e.label}</span>
                  </a>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/*
          Bibliotheken zweispaltig. Sieben Kacheln in vier Reihen statt sieben —
          die Farbigkeit bleibt, die Höhe halbiert sich.
        */}
        <SidebarGroup className="py-1">
          <SidebarGroupLabel>Bausteine</SidebarGroupLabel>
          <SidebarGroupContent className="px-2">
            {/*
              Der Abstand ist groesser als er aussehen muesste (PROJ-60): Der
              Sockel unter jeder Kachel ist 3px + 6px hoch und wird beim Zeigen
              noch tiefer. Bei 6px Luft haette die untere Kachelreihe den Sockel
              der oberen ueberdeckt — ausgerechnet dort, wo sechs Kacheln
              beieinander stehen, waere die Tiefe verschwunden.
            */}
            <div className="grid grid-cols-2 gap-2.5">
              {BAUSTEINE.map((e, i) => {
                // Bis PROJ-52 zaehlten hier auch die drei Archetyp-Seiten mit.
                // Es gibt sie nicht mehr; je Bereich bleibt eine Adresse.
                const aktiv = pathname.startsWith(e.href)
                // Bei ungerader Anzahl die letzte Kachel ueber beide Spalten —
                // eine halb leere Reihe sieht aus wie ein Fehler.
                const letzteAllein = i === BAUSTEINE.length - 1 && BAUSTEINE.length % 2 === 1
                return (
                  <a
                    key={e.href}
                    href={e.href}
                    title={e.label}
                    aria-current={aktiv ? 'page' : undefined}
                    className={cn(
                      'glas-kachel flex h-[52px] flex-col items-center justify-center gap-1 rounded-lg',
                      letzteAllein && 'col-span-2 flex-row gap-2',
                    )}
                    data-aktiv={aktiv ? 'ja' : 'nein'}
                    onPointerEnter={scheinBeginnen}
                    onPointerMove={scheinFolgen}
                  >
                    <e.icon className={cn('shrink-0', letzteAllein ? 'h-5 w-5' : 'h-4 w-4',
                      aktiv ? 'text-orange-300' : 'text-white/80')} />
                    <span className={cn(
                      'font-semibold text-white leading-tight truncate',
                      letzteAllein ? 'text-xs' : 'text-[10px] text-center px-1 w-full',
                    )}>
                      {letzteAllein ? e.label : (e.kurz ?? e.label)}
                    </span>
                  </a>
                )
              })}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/*
          HIER STAND DIE AUFKLAPPBARE SAMMLUNGSLISTE (bis 05.09.2026).

          Mark: „In der Seitenleiste steht noch irgendwo ganz kleine
          Sammlungen. Man kann es kaum anklicken, die können ja dann auch weg."
          Er hat recht — die Zeile war eine Gruppenueberschrift, also 12px
          graue Schrift mit einem 14px-Pfeil daneben, und sie stand zwischen
          zwei ganz anders gebauten Bloecken.

          Die Sammlungen selbst BLEIBEN: 17 Stueck mit 30 Prompts. Sie stehen
          jetzt als normale Zeile in der Fusszeile, in derselben Groesse wie
          Statistiken und Einstellungen. Waere der Verweis ganz verschwunden,
          waeren dreissig Prompts nur noch ueber die Adresszeile erreichbar —
          das ist kein Aufraeumen mehr, das ist Verlust.

          Seit PROJ-63 ordnen ohnehin die Themen die Uebersicht; die
          Sammlungen sind die Auswahl, die er selbst getroffen hat.
        */}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={pathname.startsWith('/collections')} asChild>
              <a href="/collections">
                <Library className="h-4 w-4" />
                Sammlungen
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={pathname === '/stats'} asChild>
              <a href="/stats">
                <BarChart2 className="h-4 w-4" />
                Statistiken
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={pathname === '/einstellungen'} asChild>
              <a href="/einstellungen">
                <Settings className="h-4 w-4" />
                Einstellungen
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Abmelden
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

    </Sidebar>
  )
}

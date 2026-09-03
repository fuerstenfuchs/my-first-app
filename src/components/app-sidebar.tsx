'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  BarChart2, LogOut, Plus, MoreHorizontal, Pencil, Settings, Trash2,
  GripVertical, ChevronRight,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useCollections, useCollectionsOverview, type Collection } from '@/hooks/use-collections'
import { PROMPTS, BAUSTEINE, PRODUKTION, kachelStil } from '@/lib/sidebar-nav'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const ORDER_KEY = 'sidebar-collection-order'
const SAMMLUNGEN_KEY = 'sidebar-collections-open'

interface SortableItemProps {
  col: Collection
  thumbnailUrl: string | null
  promptCount: number
  isActive: boolean
  isRenaming: boolean
  renameValue: string
  renameRef: React.RefObject<HTMLInputElement>
  onRenameChange: (v: string) => void
  onRenameBlur: () => void
  onRenameKeyDown: (e: React.KeyboardEvent) => void
  onStartRename: () => void
  onDelete: () => void
}

function SortableCollectionItem({
  col, thumbnailUrl, promptCount, isActive, isRenaming,
  renameValue, renameRef, onRenameChange, onRenameBlur, onRenameKeyDown,
  onStartRename, onDelete,
}: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <SidebarMenuItem ref={setNodeRef} style={style}>
      {isRenaming ? (
        <div className="px-2 py-1">
          <Input
            ref={renameRef}
            value={renameValue}
            onChange={e => onRenameChange(e.target.value)}
            onBlur={onRenameBlur}
            onKeyDown={onRenameKeyDown}
            className="h-7 text-sm"
          />
        </div>
      ) : (
        <>
          <SidebarMenuButton isActive={isActive} asChild className="h-auto py-2">
            <a href={`/collections/${col.id}`} className="flex items-center gap-3">
              {/* Drag handle */}
              <span
                className="shrink-0 text-sidebar-foreground/30 hover:text-sidebar-foreground/60 cursor-grab active:cursor-grabbing touch-none"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-4 w-4" />
              </span>

              {/* Thumbnail */}
              <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-white/10 bg-sidebar-accent">
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-base font-bold text-sidebar-foreground/50">
                    {col.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Name + count */}
              <div className="flex flex-col min-w-0">
                <span className="truncate text-sm font-medium leading-snug">{col.name}</span>
                <span className="text-xs text-sidebar-foreground/50 leading-snug">
                  {promptCount} {promptCount === 1 ? 'Prompt' : 'Prompts'}
                </span>
              </div>
            </a>
          </SidebarMenuButton>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuAction showOnHover>
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Menü</span>
              </SidebarMenuAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start">
              <DropdownMenuItem onClick={onStartRename}>
                <Pencil className="mr-2 h-4 w-4" />
                Umbenennen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </SidebarMenuItem>
  )
}

export function AppSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { collections, createCollection, renameCollection, deleteCollection } = useCollections()
  const { collections: collectionsOverview } = useCollectionsOverview()

  const collectionImageMap = new Map(collectionsOverview.map(c => [c.id, c.collage_images[0] ?? null]))
  const collectionCountMap = new Map(collectionsOverview.map(c => [c.id, c.prompt_count]))

  // usePrompts entfernt: Seit die Tag-Leiste weg ist, wurde das Ergebnis
  // nirgends mehr benutzt — die Abfrage lief auf jeder Seite der App mit.

  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  // Zugeklappt als Vorgabe; die Wahl bleibt im Browser gespeichert.
  const [sammlungenOffen, setSammlungenOffen] = useState(false)

  useEffect(() => {
    try {
      setSammlungenOffen(localStorage.getItem(SAMMLUNGEN_KEY) === 'offen')
    } catch { /* privater Modus, dann bleibt es zugeklappt */ }
  }, [])

  function sammlungenUmschalten() {
    setSammlungenOffen(offen => {
      const neu = !offen
      try { localStorage.setItem(SAMMLUNGEN_KEY, neu ? 'offen' : 'zu') } catch { /* egal */ }
      return neu
    })
  }
  const inputRef = useRef<HTMLInputElement>(null)
  const renameRef = useRef<HTMLInputElement>(null)

  // Sync ordered IDs when collections load, respecting saved order
  useEffect(() => {
    if (collections.length === 0) return
    const currentIds = collections.map(c => c.id)
    try {
      const saved = localStorage.getItem(ORDER_KEY)
      if (saved) {
        const savedIds = JSON.parse(saved) as string[]
        const merged = [
          ...savedIds.filter(id => currentIds.includes(id)),
          ...currentIds.filter(id => !savedIds.includes(id)),
        ]
        setOrderedIds(merged)
        return
      }
    } catch { /* ignore */ }
    setOrderedIds(currentIds)
  }, [collections])

  const orderedCollections = orderedIds
    .map(id => collections.find(c => c.id === id))
    .filter(Boolean) as Collection[]

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrderedIds(prev => {
      const oldIndex = prev.indexOf(active.id as string)
      const newIndex = prev.indexOf(over.id as string)
      const next = arrayMove(prev, oldIndex, newIndex)
      localStorage.setItem(ORDER_KEY, JSON.stringify(next))
      return next
    })
  }

  useEffect(() => { if (isCreating) inputRef.current?.focus() }, [isCreating])
  useEffect(() => { if (renamingId) renameRef.current?.focus() }, [renamingId])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleCreate() {
    const name = newName.trim()
    setIsCreating(false)
    setNewName('')
    if (!name) { toast.error('Name darf nicht leer sein'); return }
    const col = await createCollection(name)
    if (col) router.push(`/collections/${col.id}`)
  }

  async function handleRename() {
    const name = renameValue.trim()
    const id = renamingId
    setRenamingId(null)
    if (!id || !name) return
    await renameCollection(id, name)
  }

  async function handleDeleteConfirm() {
    if (!deleteId) return
    await deleteCollection(deleteId)
    setDeleteId(null)
    if (pathname.startsWith('/collections/')) router.push('/')
  }

  return (
    <Sidebar>
      {/*
        Hoehe begrenzt: Das Logo ist quadratisch angelegt und wurde in voller
        Breite 205px hoch — nach dem Verkuerzen der Leiste war es mit 40 Prozent
        der groesste Block darin. Auf Marks Wunsch wieder auf 192px — die 96px
        des ersten Versuchs waren ihm zu klein.
      */}
      <SidebarHeader className="p-3 pb-1">
        <img
          src="/logo.png"
          alt="Prompt Trésor"
          className="mx-auto max-h-48 w-auto object-contain"
        />
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
              <SidebarMenuItem className="px-2 py-1">
            <a
              href={PROMPTS.href}
              aria-current={pathname === '/' ? 'page' : undefined}
              className="flex items-center rounded-xl w-full overflow-hidden transition-opacity hover:opacity-90"
              style={kachelStil(PROMPTS.farben, pathname === '/')}
            >
              <div className="flex items-center justify-center w-14 h-14 shrink-0">
                <PROMPTS.icon className={cn('h-6 w-6', PROMPTS.farben.symbol)} />
              </div>
              <div className="w-px self-stretch bg-white/15 shrink-0" />
              <span className="text-base font-semibold text-white px-4">{PROMPTS.label}</span>
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
                <SidebarMenuItem key={e.href} className="px-2 py-1">
                  <a
                    href={e.href}
                    aria-current={pathname.startsWith(e.href) ? 'page' : undefined}
                    className="flex items-center rounded-xl w-full overflow-hidden transition-opacity hover:opacity-90"
                    style={kachelStil(e.farben, pathname.startsWith(e.href))}
                  >
                    <div className="flex items-center justify-center w-14 h-14 shrink-0">
                      <e.icon className={cn('h-6 w-6', e.farben.symbol)} />
                    </div>
                    <div className="w-px self-stretch bg-white/15 shrink-0" />
                    <span className="text-base font-semibold text-white px-4">{e.label}</span>
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
            <div className="grid grid-cols-2 gap-1.5">
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
                      'flex flex-col items-center justify-center gap-1 rounded-lg h-[52px] overflow-hidden transition-opacity hover:opacity-90',
                      letzteAllein && 'col-span-2 flex-row gap-2',
                    )}
                    style={kachelStil(e.farben, aktiv)}
                  >
                    <e.icon className={cn('shrink-0', letzteAllein ? 'h-5 w-5' : 'h-4 w-4', e.farben.symbol)} />
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

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between pr-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                onClick={sammlungenUmschalten}
                className="text-muted-foreground hover:text-foreground transition-colors rounded"
                aria-expanded={sammlungenOffen}
                aria-label={sammlungenOffen ? 'Sammlungen zuklappen' : 'Sammlungen aufklappen'}
              >
                <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', sammlungenOffen && 'rotate-90')} />
              </button>
              <a
                href="/collections"
                className={`hover:text-foreground transition-colors ${pathname.startsWith('/collections') ? 'text-foreground' : ''}`}
              >
                Sammlungen
              </a>
              <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                {orderedCollections.length}
              </span>
            </div>
            <button
              onClick={() => { setIsCreating(true); setNewName('') }}
              className="text-muted-foreground hover:text-foreground transition-colors rounded p-0.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="sr-only">Neue Sammlung</span>
            </button>
          </SidebarGroupLabel>

          {/*
            Zugeklappt als Vorgabe: Marks siebzehn Sammlungen brauchten 952px —
            mehr als das gesamte Menue darueber. Die Wahl bleibt im Browser
            gespeichert, wer sie taeglich offen braucht, klappt sie einmal auf.
          */}
          <SidebarGroupContent hidden={!sammlungenOffen}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
                <SidebarMenu>
                  {orderedCollections.map(col => (
                    <SortableCollectionItem
                      key={col.id}
                      col={col}
                      thumbnailUrl={collectionImageMap.get(col.id) ?? col.cover_image_url}
                      promptCount={collectionCountMap.get(col.id) ?? 0}
                      isActive={pathname === `/collections/${col.id}`}
                      isRenaming={renamingId === col.id}
                      renameValue={renameValue}
                      renameRef={renameRef as React.RefObject<HTMLInputElement>}
                      onRenameChange={setRenameValue}
                      onRenameBlur={handleRename}
                      onRenameKeyDown={e => {
                        if (e.key === 'Enter') handleRename()
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      onStartRename={() => { setRenamingId(col.id); setRenameValue(col.name) }}
                      onDelete={() => setDeleteId(col.id)}
                    />
                  ))}
                  {isCreating && (
                    <SidebarMenuItem>
                      <div className="px-2 py-1">
                        <Input
                          ref={inputRef}
                          value={newName}
                          onChange={e => setNewName(e.target.value)}
                          onBlur={handleCreate}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleCreate()
                            if (e.key === 'Escape') { setIsCreating(false); setNewName('') }
                          }}
                          placeholder="Sammlungsname"
                          className="h-7 text-sm"
                        />
                      </div>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SortableContext>
            </DndContext>
          </SidebarGroupContent>
        </SidebarGroup>

        {/*
          Die Tag-Leiste stand hier UND ueber der Prompt-Galerie — dieselbe
          Funktion doppelt. In der Galerie ist sie am Inhalt, hier kostete sie
          nur Hoehe.
        */}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
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

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sammlung wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Prompts bleiben unter „Alle Prompts" erhalten — nur die Sammlung wird entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  )
}

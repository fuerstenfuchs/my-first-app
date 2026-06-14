'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { BarChart2, LogOut, Plus, MoreHorizontal, Pencil, Settings, Trash2, GripVertical, LayoutGrid } from 'lucide-react'
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
import { useCollections, useCollectionsOverview, type Collection } from '@/hooks/use-collections'
import { usePrompts } from '@/hooks/use-prompts'
import { tagColorClass } from '@/lib/tag-colors'
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

  const { prompts } = usePrompts()

  const topTags = Object.entries(
    prompts.flatMap(p => p.tags).reduce<Record<string, number>>((acc, tag) => {
      acc[tag] = (acc[tag] ?? 0) + 1
      return acc
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([tag]) => tag)

  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [orderedIds, setOrderedIds] = useState<string[]>([])
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
      <SidebarHeader className="p-3">
        <img src="/logo.png" alt="Prompt Trésor" className="w-full mx-auto object-contain" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={pathname === '/'} asChild className="h-auto py-3">
              <a href="/" className="flex items-center gap-3">
                <div className="shrink-0 w-12 h-12 rounded-lg border border-white/10 bg-sidebar-accent flex items-center justify-center">
                  <LayoutGrid className="h-5 w-5 text-sidebar-foreground/70" />
                </div>
                <span className="text-sm font-medium">Alle Prompts</span>
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
        </SidebarMenu>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between pr-1">
            <a
              href="/collections"
              className={`hover:text-foreground transition-colors ${pathname.startsWith('/collections') ? 'text-foreground' : ''}`}
            >
              Sammlungen
            </a>
            <button
              onClick={() => { setIsCreating(true); setNewName('') }}
              className="text-muted-foreground hover:text-foreground transition-colors rounded p-0.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="sr-only">Neue Sammlung</span>
            </button>
          </SidebarGroupLabel>

          <SidebarGroupContent>
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

        {topTags.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Beliebte Tags</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="flex flex-wrap gap-1.5 px-2 pb-2">
                {topTags.map(tag => (
                  <a
                    key={tag}
                    href={`/?tag=${encodeURIComponent(tag)}`}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono leading-4 transition-opacity hover:opacity-75 ${tagColorClass(tag)}`}
                  >
                    #{tag}
                  </a>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
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

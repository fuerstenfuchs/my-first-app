'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { BarChart2, LogOut, Plus, MoreHorizontal, Pencil, Settings, Trash2 } from 'lucide-react'
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
import { useCollections } from '@/hooks/use-collections'
import { usePrompts } from '@/hooks/use-prompts'
import { tagColorClass } from '@/lib/tag-colors'

export function AppSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { collections, createCollection, renameCollection, deleteCollection } = useCollections()
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
  const inputRef = useRef<HTMLInputElement>(null)
  const renameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isCreating) inputRef.current?.focus()
  }, [isCreating])

  useEffect(() => {
    if (renamingId) renameRef.current?.focus()
  }, [renamingId])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleCreate() {
    const name = newName.trim()
    setIsCreating(false)
    setNewName('')
    if (!name) {
      toast.error('Name darf nicht leer sein')
      return
    }
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
        <img
          src="/logo.png"
          alt="Prompt Trésor"
          className="w-full mx-auto object-contain"
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={pathname === '/'} asChild>
              <a href="/">Alle Prompts</a>
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
            <SidebarMenu>
              {collections.map(col => (
                <SidebarMenuItem key={col.id}>
                  {renamingId === col.id ? (
                    <div className="px-2 py-1">
                      <Input
                        ref={renameRef}
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={handleRename}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRename()
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        className="h-7 text-sm"
                      />
                    </div>
                  ) : (
                    <>
                      <SidebarMenuButton
                        isActive={pathname === `/collections/${col.id}`}
                        asChild
                        className="h-auto py-1.5"
                      >
                        <a href={`/collections/${col.id}`} className="flex items-center gap-2.5">
                          {/* Thumbnail */}
                          <div className="shrink-0 w-9 h-9 rounded-md overflow-hidden border border-white/10 bg-sidebar-accent">
                            {col.cover_image_url ? (
                              <img src={col.cover_image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-sidebar-foreground/60">
                                {col.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <span className="truncate text-sm">{col.name}</span>
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
                          <DropdownMenuItem
                            onClick={() => {
                              setRenamingId(col.id)
                              setRenameValue(col.name)
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Umbenennen
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteId(col.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </SidebarMenuItem>
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

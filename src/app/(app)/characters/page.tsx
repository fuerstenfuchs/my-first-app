'use client'

import { useState } from 'react'
import { Plus, Search, User, Pencil, Trash2, X, ChevronRight, Users } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { CharacterForm } from '@/components/characters/character-form'
import { VariantForm } from '@/components/characters/variant-form'
import { VariantCard } from '@/components/characters/variant-card'
import { CharacterMediaManager } from '@/components/characters/character-media-manager'
import {
  useCharacters,
  useCharacterDetail,
  type Character,
  type CharacterVariant,
  type CharacterInput,
  type VariantInput,
} from '@/hooks/use-characters'

export default function CharactersPage() {
  const { characters, loading, createCharacter, updateCharacter, deleteCharacter } = useCharacters()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [charFormOpen, setCharFormOpen] = useState(false)
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null)
  const [deleteCharId, setDeleteCharId] = useState<string | null>(null)

  const {
    character,
    variants,
    loading: detailLoading,
    uploading,
    createVariant,
    updateVariant,
    deleteVariant,
    uploadImages,
    addImageUrl,
    deleteImage,
    reorderImages,
  } = useCharacterDetail(selectedId)

  const [variantFormOpen, setVariantFormOpen] = useState(false)
  const [editingVariant, setEditingVariant] = useState<CharacterVariant | null>(null)
  const [deleteVariantId, setDeleteVariantId] = useState<string | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)

  const filtered = characters.filter(c =>
    !search.trim() || c.name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleCharSave(input: CharacterInput, firstVariantName?: string): Promise<boolean | Character | null> {
    if (editingCharacter) return updateCharacter(editingCharacter.id, input)
    const char = await createCharacter(input, firstVariantName)
    if (char) setSelectedId(char.id)
    return char
  }

  async function handleVariantSave(input: VariantInput, files: File[]): Promise<boolean | CharacterVariant | null> {
    if (editingVariant) return updateVariant(editingVariant.id, input)
    const v = await createVariant(input)
    if (v) {
      setSelectedVariantId(v.id)
      if (files.length > 0) await uploadImages(v.id, files)
    }
    return v
  }

  async function handleDeleteChar() {
    if (!deleteCharId) return
    await deleteCharacter(deleteCharId)
    if (selectedId === deleteCharId) setSelectedId(null)
    setDeleteCharId(null)
  }

  async function handleDeleteVariant() {
    if (!deleteVariantId) return
    await deleteVariant(deleteVariantId)
    if (selectedVariantId === deleteVariantId) setSelectedVariantId(null)
    setDeleteVariantId(null)
  }

  const selectedVariant = selectedVariantId
    ? variants.find(v => v.id === selectedVariantId) ?? null
    : null

  return (
    <div className="flex h-svh min-w-0">

      {/* ── Left: character list ─────────────────────────────────────── */}
      <div className="flex flex-col w-72 shrink-0 border-r border-border">
        <header className="border-b shrink-0 px-4 py-3 flex items-center gap-3">
          <SidebarTrigger />
          <h1 className="text-base font-semibold flex-1 truncate">Charaktere</h1>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={() => { setEditingCharacter(null); setCharFormOpen(true) }}
            title="Neuer Charakter"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </header>

        <div className="px-3 py-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Suchen…"
              className="pl-8 h-8 text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden" style={{ right: '-17px' }}>
            {loading ? (
              <div className="p-2 space-y-1">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-2 text-center px-4">
                <Users className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {search ? 'Kein Charakter gefunden' : 'Noch keine Charaktere'}
                </p>
                {!search && (
                  <Button size="sm" variant="outline" onClick={() => { setEditingCharacter(null); setCharFormOpen(true) }}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Erstellen
                  </Button>
                )}
              </div>
            ) : (
              <ul className="p-2 space-y-1">
                {filtered.map(char => (
                  <li key={char.id}>
                    <button
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors group ${
                        selectedId === char.id
                          ? 'bg-violet-500/10 text-violet-400'
                          : 'hover:bg-accent/60'
                      }`}
                      onClick={() => { setSelectedId(char.id); setSelectedVariantId(null) }}
                    >
                      <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-muted border border-border/50">
                        {char.cover_image_url ? (
                          <img src={char.cover_image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="h-5 w-5 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{char.name}</p>
                        {char.description && (
                          <p className="text-xs text-muted-foreground truncate">{char.description}</p>
                        )}
                      </div>
                      <ChevronRight className={`h-4 w-4 shrink-0 transition-opacity ${selectedId === char.id ? 'opacity-100 text-violet-400' : 'opacity-0 group-hover:opacity-40'}`} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: character detail ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedId ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <div className="w-20 h-20 rounded-full bg-muted/40 flex items-center justify-center">
              <Users className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Character Vault</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Wähle einen Charakter aus der Liste oder lege einen neuen an.
                Jeder Charakter enthält Varianten mit Referenzbildern und Prompts.
              </p>
            </div>
            <Button onClick={() => { setEditingCharacter(null); setCharFormOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />
              Neuer Charakter
            </Button>
          </div>

        ) : detailLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[4/3] rounded-xl" />)}
            </div>
          </div>

        ) : character ? (
          <>
            {/* Character header */}
            <header className="border-b shrink-0 px-6 py-4">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-muted border border-border/50">
                  {character.cover_image_url ? (
                    <img src={character.cover_image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold leading-tight">{character.name}</h2>
                  {character.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{character.description}</p>
                  )}
                  {character.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {character.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8"
                    onClick={() => { setEditingCharacter(character); setCharFormOpen(true) }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteCharId(character.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </header>

            {/* Variants + detail */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full flex flex-col lg:flex-row min-w-0">

                {/* Variant grid */}
                <div className={`flex-1 min-w-0 overflow-hidden relative ${selectedVariant ? 'lg:flex-none lg:w-[55%]' : ''}`}>
                  <div className="absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden p-6" style={{ right: '-20px' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Varianten ({variants.length})
                      </h3>
                      <Button size="sm" variant="outline" onClick={() => { setEditingVariant(null); setVariantFormOpen(true) }}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Neue Variante
                      </Button>
                    </div>

                    {variants.length === 0 ? (
                      <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 text-center">
                        <p className="text-sm text-muted-foreground">Noch keine Varianten</p>
                        <Button size="sm" onClick={() => { setEditingVariant(null); setVariantFormOpen(true) }}>
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          Erste Variante anlegen
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {variants.map(v => (
                          <VariantCard
                            key={v.id}
                            variant={v}
                            isSelected={selectedVariantId === v.id}
                            onClick={() => setSelectedVariantId(prev => prev === v.id ? null : v.id)}
                            onEdit={() => { setEditingVariant(v); setVariantFormOpen(true) }}
                            onDelete={() => setDeleteVariantId(v.id)}
                            onUploadImages={files => uploadImages(v.id, files)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Variant detail panel */}
                {selectedVariant && (
                  <div className="lg:w-[45%] shrink-0 border-t lg:border-t-0 lg:border-l border-border overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden p-5" style={{ right: '-20px' }}>
                      {/* Panel header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate">{selectedVariant.name}</h4>
                          {selectedVariant.description && (
                            <p className="text-sm text-muted-foreground">{selectedVariant.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => { setEditingVariant(selectedVariant); setVariantFormOpen(true) }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => setSelectedVariantId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Prompt */}
                      {selectedVariant.prompt && (
                        <div className="mb-5">
                          <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Prompt</p>
                          <pre className="text-xs bg-muted/40 rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto max-h-40">
                            {selectedVariant.prompt}
                          </pre>
                        </div>
                      )}

                      {/* Media manager */}
                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                        Referenzbilder
                      </p>
                      <CharacterMediaManager
                        variantId={selectedVariant.id}
                        images={selectedVariant.images}
                        uploading={uploading}
                        onUpload={files => uploadImages(selectedVariant.id, files)}
                        onAddUrl={url => addImageUrl(selectedVariant.id, url)}
                        onDelete={(imgId, path) => deleteImage(selectedVariant.id, imgId, path)}
                        onReorder={orderedIds => reorderImages(selectedVariant.id, orderedIds)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      <CharacterForm
        open={charFormOpen}
        onClose={() => { setCharFormOpen(false); setEditingCharacter(null) }}
        character={editingCharacter}
        onSave={handleCharSave}
      />

      <VariantForm
        open={variantFormOpen}
        onClose={() => { setVariantFormOpen(false); setEditingVariant(null) }}
        variant={editingVariant}
        onSave={handleVariantSave}
      />

      <AlertDialog open={!!deleteCharId} onOpenChange={open => !open && setDeleteCharId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Charakter löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle Varianten und Bilder dieses Charakters werden unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteChar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteVariantId} onOpenChange={open => !open && setDeleteVariantId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Variante löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle Bilder dieser Variante werden ebenfalls gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVariant} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

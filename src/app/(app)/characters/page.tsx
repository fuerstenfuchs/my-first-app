'use client'

import { useState } from 'react'
import { Plus, Search, User, Pencil, Trash2, X, ChevronRight, Users, Sparkles, ExternalLink, Link2 } from 'lucide-react'
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
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { SidebarTrigger } from '@/components/ui/sidebar'
/*
  Ohne diese Einfuhr gibt es die Klassen `lt`, `lt-kopf`, `lt-feld` und
  `lt-haupt` auf dieser Seite gar nicht — sie stehen dann im Markup und tun
  nichts. Genau das ist beim ersten Anlauf passiert: Die Seite blieb schwarz,
  obwohl alle Klassen gesetzt waren.
*/
import '../bildstudio/lichttisch.css'
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
import { AlleVariantenBilder } from '@/components/characters/alle-varianten-bilder'
import { CharacterMediaManager } from '@/components/characters/character-media-manager'
import { CharacterSheetDialog } from '@/components/characters/character-sheet-dialog'
import { ReferenzketteDialog } from '@/components/characters/referenzkette-dialog'
import { TitelbildKnopf } from '@/components/characters/titelbild-knopf'
import {
  useCharacters,
  useCharacterDetail,
  type Character,
  type CharacterVariant,
  type CharacterInput,
  type VariantInput,
  type InitialSlot,
} from '@/hooks/use-characters'
import { passtZurSuche } from '@/lib/bausteine'

export default function CharactersPage() {
  const { characters, loading, createCharacterWithSlots, updateCharacter, deleteCharacter, patchCharacterCover } = useCharacters()
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
    reorderVariants,
    updateCharacterCover,
    refetch: refetchDetail,
  } = useCharacterDetail(selectedId)

  const [variantFormOpen, setVariantFormOpen] = useState(false)
  const [editingVariant, setEditingVariant] = useState<CharacterVariant | null>(null)
  const [deleteVariantId, setDeleteVariantId] = useState<string | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [sheetDialogOpen, setSheetDialogOpen] = useState(false)
  const [kettenDialogOffen, setKettenDialogOffen] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // PROJ-46: wortweise und über Name, Beschreibung und Schlagworte — dieselbe
  // Funktion wie im Übernehmen-Dialog und im Scene Builder. Charaktere haben
  // keine Kategoriespalte, deshalb hier nur die Suche und keine Chips.
  const filtered = characters.filter(c => passtZurSuche(c, search))

  async function handleCharSave(input: CharacterInput, slots: InitialSlot[]): Promise<boolean | Character | null> {
    if (editingCharacter) return updateCharacter(editingCharacter.id, input)
    const char = await createCharacterWithSlots(input, slots)
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

  function handleVariantDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = variants.findIndex(v => v.id === active.id)
    const newIndex = variants.findIndex(v => v.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = [...variants]
    const [moved] = newOrder.splice(oldIndex, 1)
    newOrder.splice(newIndex, 0, moved)
    reorderVariants(newOrder.map(v => v.id))
  }

  const selectedVariant = selectedVariantId
    ? variants.find(v => v.id === selectedVariantId) ?? null
    : null

  return (
    /*
      DIE CHARAKTERSEITE AUF DEM BELEUCHTETEN TISCH (PROJ-66).

      `lt` an der Wurzel ist hier geprueft: Die beiden direkten Kinder (Liste
      links, Detail rechts) sind statisch. Die `absolute`-Rollbereiche darin
      sind ENKEL — `.lt > *` erreicht sie nicht, und `.lt` selbst traegt seit
      dem Fehler auf der Prompt-Seite ohnehin einen Waechter.
    */
    <div className="lt flex h-svh min-w-0">

      {/* ── Left: character list ─────────────────────────────────────── */}
      <div className="flex w-72 shrink-0 flex-col border-r border-[rgba(150,185,220,0.14)]">
        <header className="lt-kopf flex shrink-0 items-center gap-3 px-4 py-3">
          <SidebarTrigger />
          <h1 className="lt-titel flex-1 truncate">Charaktere</h1>
          <Button
            size="icon"
            variant="ghost"
            className="lt-feld h-10 w-10 shrink-0 border-0"
            onClick={() => { setEditingCharacter(null); setCharFormOpen(true) }}
            title="Neuer Charakter"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </header>

        <div className="border-b border-[rgba(150,185,220,0.12)] px-3 py-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Suchen…"
              className="lt-feld h-10 border-0 pl-9 text-[15px]"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 right-0 ohne-rollbalken overflow-y-auto overflow-x-hidden">
            {loading ? (
              <div className="p-2 space-y-1">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-[12px] bg-white/[0.06]" />)}
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
                      /* Orange heisst in dieser App „ausgewaehlt" — ueberall.
                         Hier stand Violett, die alte Kennfarbe dieser Seite. */
                      className={`group flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors ${
                        selectedId === char.id
                          ? 'bg-[rgba(249,115,22,0.16)] text-[#ffb066]'
                          : 'hover:bg-[rgba(160,195,225,0.09)]'
                      }`}
                      onClick={() => { setSelectedId(char.id); setSelectedVariantId(null) }}
                    >
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-[10px] border border-[rgba(150,185,220,0.22)] bg-black/25">
                        {char.cover_image_url ? (
                          <img src={char.cover_image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="h-5 w-5 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-[15px] font-semibold">{char.name}</p>
                        {char.description && (
                          <p className="truncate text-[13px] text-muted-foreground">{char.description}</p>
                        )}
                      </div>
                      <ChevronRight className={`h-4 w-4 shrink-0 transition-opacity ${selectedId === char.id ? 'text-[#ffb066] opacity-100' : 'opacity-0 group-hover:opacity-40'}`} />
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
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.06]">
              <Users className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <div className="space-y-1">
              <h2 className="text-[22px] font-bold">Character Vault</h2>
              <p className="max-w-sm text-[15px] text-muted-foreground">
                Wähle einen Charakter aus der Liste oder lege einen neuen an.
                Jeder Charakter enthält Varianten mit Referenzbildern und Prompts.
              </p>
            </div>
            <Button className="lt-haupt h-11 px-6 text-[15px] font-bold hover:bg-transparent"
                    onClick={() => { setEditingCharacter(null); setCharFormOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />
              Neuer Charakter
            </Button>
          </div>

        ) : detailLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
            <div className="grid grid-cols-3 gap-3 mt-6">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-[12px] bg-white/[0.06]" />)}
            </div>
          </div>

        ) : character ? (
          <>
            {/* Character header */}
            <header className="lt-kopf shrink-0 px-6 py-4">
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
                  {character.source_url && (
                    <a href={character.source_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-1.5">
                      <ExternalLink className="h-3 w-3" />
                      {character.source_title || (() => { try { return new URL(character.source_url).hostname.replace('www.', '') } catch { return character.source_url } })()}
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Der häufigste Handgriff zuerst (PROJ-48): Kopf, Körper und
                      Referenzsheet in einem Durchlauf, statt dreimal einzeln
                      erzeugen, herunterladen und wieder hochladen. */}
                  <Button size="sm" className="h-8 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => setKettenDialogOffen(true)}>
                    <Link2 className="h-3.5 w-3.5" />
                    Referenzkette
                  </Button>
                  {/* Der Schritt DANACH (PROJ-51): aus dem fertigen
                      Referenzsheet und Marks Preset „Calvanize Studio" ein
                      Titelbild — ein Klick statt fünf Handgriffen. Gesperrt,
                      solange kein Referenzsheet vorliegt. */}
                  <TitelbildKnopf
                    character={character}
                    varianten={variants}
                    // `stillLeise`: Der Knopf fasst am Ende selbst zusammen —
                    // sonst stünden zwei Meldungen zum selben Vorgang
                    // untereinander.
                    titelbildSetzen={url =>
                      updateCharacterCover(url, newUrl => selectedId && patchCharacterCover(selectedId, newUrl), true)
                    }
                    onAenderung={() => { void refetchDetail() }}
                  />
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 border-primary/40 text-[#ffb066] hover:bg-primary/10 hover:text-[#ffd0a8]"
                    onClick={() => setSheetDialogOpen(true)}>
                    <Sparkles className="h-3.5 w-3.5" />
                    Sheets
                  </Button>
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
                  <div className="absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden p-4" style={{ right: '-20px' }}>
                    <div className="flex items-center justify-between mb-3">
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
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleVariantDragEnd}
                      >
                        <SortableContext items={variants.map(v => v.id)} strategy={rectSortingStrategy}>
                          <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
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
                        </SortableContext>
                      </DndContext>
                    )}

                    {/*
                      Alle Bilder des Charakters, über alle Varianten hinweg.
                      Steht UNTER den Varianten und ersetzt sie nicht: Die
                      Varianten tragen Prompt und Beschreibung, das ist ihr
                      Zweck. Was fehlte, war die Übersicht darüber — wer wissen
                      wollte, welche Bilder es zu einem Charakter gibt, musste
                      jede Variante einzeln anklicken.
                    */}
                    <AlleVariantenBilder
                      varianten={variants.map(v => ({
                        id: v.id,
                        name: v.name,
                        images: (v.images ?? []).map(b => ({ id: b.id, url: b.url })),
                      }))}
                      onVariante={id => setSelectedVariantId(id)}
                    />
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
                        characterCoverUrl={character?.cover_image_url}
                        onUpload={files => uploadImages(selectedVariant.id, files)}
                        onAddUrl={url => addImageUrl(selectedVariant.id, url)}
                        onDelete={(imgId, path) => deleteImage(selectedVariant.id, imgId, path)}
                        onReorder={orderedIds => reorderImages(selectedVariant.id, orderedIds)}
                        onSetCharacterCover={url =>
                          updateCharacterCover(url, newUrl => selectedId && patchCharacterCover(selectedId, newUrl))
                        }
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

      {character && (
        <CharacterSheetDialog
          open={sheetDialogOpen}
          onClose={() => setSheetDialogOpen(false)}
          character={character}
        />
      )}

      {/* Erst mounten, wenn gebraucht: Der Dialog fragt beim Öffnen den Stand
          der drei Varianten ab — das soll nur geschehen, wenn er auch aufgeht. */}
      {character && kettenDialogOffen && (
        <ReferenzketteDialog
          offen
          onClose={() => setKettenDialogOffen(false)}
          character={character}
          onAenderung={() => { void refetchDetail() }}
        />
      )}

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

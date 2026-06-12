'use client'

import { useState, useRef } from 'react'
import { Check, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CollectionPromptItem } from '@/hooks/use-collections'

interface CollectionCoverModalProps {
  open: boolean
  onClose: () => void
  collectionId: string
  currentCoverUrl: string | null
  items: CollectionPromptItem[]
  onCoverChange: (url: string | null) => Promise<boolean>
}

function getAllImages(items: CollectionPromptItem[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    const urls = [
      item.prompt.cover_image_url,
      ...item.prompt.preview_media
        .filter(m => m.type === 'image')
        .map(m => m.url),
    ].filter((u): u is string => Boolean(u))
    for (const url of urls) {
      if (!seen.has(url)) {
        seen.add(url)
        result.push(url)
      }
    }
  }
  return result
}

export function CollectionCoverModal({
  open,
  onClose,
  collectionId,
  currentCoverUrl,
  items,
  onCoverChange,
}: CollectionCoverModalProps) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(currentCoverUrl)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const availableImages = getAllImages(items)
  const defaultTab = currentCoverUrl ? 'manual' : 'auto'

  async function handleSave(url: string | null) {
    const success = await onCoverChange(url)
    if (success) onClose()
  }

  async function handleFileSelect(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Datei zu groß (max. 20 MB)')
      return
    }
    setUploading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${user!.id}/${collectionId}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('collection-covers')
      .upload(path, file)
    if (uploadError) {
      toast.error('Upload fehlgeschlagen')
      setUploading(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage
      .from('collection-covers')
      .getPublicUrl(path)
    setUploading(false)
    await handleSave(publicUrl)
  }

  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cover bearbeiten</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue={defaultTab}>
          <TabsList className="w-full">
            <TabsTrigger value="auto" className="flex-1">
              Automatisch
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex-1">
              Individuell
            </TabsTrigger>
          </TabsList>

          <TabsContent value="auto" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Das Cover wird automatisch aus den Bildern der enthaltenen Prompts berechnet.
            </p>
            {currentCoverUrl && (
              <Button className="w-full" onClick={() => handleSave(null)}>
                Zurück zu automatisch wechseln
              </Button>
            )}
          </TabsContent>

          <TabsContent value="manual" className="mt-4 space-y-4">
            {availableImages.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Wähle ein Bild aus deinen Prompts:
                </p>
                <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                  {availableImages.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedUrl(url)}
                      className={cn(
                        'relative aspect-square rounded-lg overflow-hidden border-2 transition-colors',
                        selectedUrl === url
                          ? 'border-primary'
                          : 'border-transparent hover:border-muted-foreground/30'
                      )}
                    >
                      <img
                        src={url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {selectedUrl === url && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <Check className="h-5 w-5 text-primary drop-shadow" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {selectedUrl && selectedUrl !== currentCoverUrl && (
                  <Button
                    className="w-full"
                    onClick={() => handleSave(selectedUrl)}
                  >
                    Dieses Cover verwenden
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Diese Sammlung hat noch keine Bilder. Lade ein eigenes Bild hoch.
              </p>
            )}

            <div className={cn(availableImages.length > 0 && 'border-t pt-4')}>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleFileSelect(file)
                  e.target.value = ''
                }}
              />
              <Button
                variant="outline"
                className="w-full"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? 'Wird hochgeladen…' : 'Eigenes Bild hochladen'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

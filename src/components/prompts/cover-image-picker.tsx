'use client'

import { useRef, useState } from 'react'
import { Link2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'

interface CoverImagePickerProps {
  value: string | null
  onChange: (url: string | null) => void
}

export function CoverImagePicker({ value, onChange }: CoverImagePickerProps) {
  const [urlInput, setUrlInput] = useState(value ?? '')
  const [uploading, setUploading] = useState(false)
  const [previewError, setPreviewError] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleUrlCommit() {
    const trimmed = urlInput.trim()
    onChange(trimmed || null)
    setPreviewError(false)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Bild zu groß — maximal 5 MB')
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${user!.id}/${crypto.randomUUID()}.${ext}`

      if (value && value.includes('prompt-covers')) {
        const parts = value.split('/prompt-covers/')
        if (parts[1]) await supabase.storage.from('prompt-covers').remove([parts[1]])
      }

      const { error } = await supabase.storage.from('prompt-covers').upload(path, file)
      if (error) {
        toast.error('Upload fehlgeschlagen — bitte erneut versuchen')
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('prompt-covers').getPublicUrl(path)
      onChange(publicUrl)
      setUrlInput(publicUrl)
    } finally {
      setUploading(false)
    }
  }

  function handleRemove() {
    onChange(null)
    setUrlInput('')
    setPreviewError(false)
  }

  return (
    <div className="space-y-3">
      <Label>
        Cover-Bild{' '}
        <span className="text-muted-foreground font-normal">(optional)</span>
      </Label>

      {value && !previewError && (
        <div className="relative w-full rounded-md overflow-hidden border border-border bg-black/40" style={{ paddingBottom: '56.25%' }}>
          <img
            src={value}
            alt="Vorschau"
            className="absolute inset-0 w-full h-full object-contain"
            onError={() => setPreviewError(true)}
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Bild entfernen</span>
          </button>
        </div>
      )}

      <Tabs defaultValue="url">
        <TabsList className="h-8">
          <TabsTrigger value="url" className="text-xs gap-1.5 h-6 px-2">
            <Link2 className="h-3 w-3" />
            URL
          </TabsTrigger>
          <TabsTrigger value="upload" className="text-xs gap-1.5 h-6 px-2">
            <Upload className="h-3 w-3" />
            Hochladen
          </TabsTrigger>
        </TabsList>
        <TabsContent value="url" className="mt-2">
          <Input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onBlur={handleUrlCommit}
            onKeyDown={e => e.key === 'Enter' && handleUrlCommit()}
            placeholder="https://example.com/bild.jpg"
            className="text-xs"
          />
        </TabsContent>
        <TabsContent value="upload" className="mt-2 space-y-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Lädt hoch…' : 'Bild auswählen'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.gif"
            className="hidden"
            onChange={handleFileChange}
          />
          <p className="text-xs text-muted-foreground">JPG, PNG, WebP oder GIF · max. 5 MB</p>
        </TabsContent>
      </Tabs>

      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground h-7 px-2"
          onClick={handleRemove}
        >
          Bild entfernen
        </Button>
      )}
    </div>
  )
}

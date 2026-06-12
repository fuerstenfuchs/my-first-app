'use client'

import { useRef } from 'react'
import { ImageIcon } from 'lucide-react'

interface DropItem {
  id: string
  url?: string
  status: 'uploading' | 'done' | 'error'
}

interface QuickImageDropProps {
  items: DropItem[]
  accept: string
  onFiles: (files: File[]) => void
}

export function QuickImageDrop({ items, accept, onFiles }: QuickImageDropProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    onFiles(Array.from(e.dataTransfer.files))
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    onFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
        aria-label="Bilder per Drag & Drop oder Klick hinzufügen"
      >
        <ImageIcon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Bilder hier ablegen oder{' '}
          <span className="text-primary underline underline-offset-2">auswählen</span>
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map(item => (
            <div
              key={item.id}
              className="relative w-16 h-16 rounded-md overflow-hidden border border-border bg-muted shrink-0"
            >
              {item.status === 'uploading' ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : item.url ? (
                <img src={item.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-destructive text-xs">✕</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

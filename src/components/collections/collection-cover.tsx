import { FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CollectionCoverProps {
  images: string[]
  name: string
  mode?: 'collage' | 'single'
  totalCount?: number
  className?: string
}

export function CollectionCover({
  images,
  name,
  mode = 'single',
  totalCount,
  className,
}: CollectionCoverProps) {
  if (images.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center bg-muted gap-2 text-muted-foreground',
          className
        )}
      >
        <FolderOpen className="h-8 w-8" />
        <span className="text-xs font-medium px-2 text-center line-clamp-2">{name}</span>
      </div>
    )
  }

  if (mode === 'single' || images.length === 1) {
    return (
      <div className={cn('overflow-hidden', className)}>
        <img src={images[0]} alt={name} className="w-full h-full object-cover" />
      </div>
    )
  }

  if (images.length === 2) {
    return (
      <div className={cn('grid grid-cols-2 gap-px overflow-hidden', className)}>
        {images.map((url, i) => (
          <img key={i} src={url} alt="" className="w-full h-full object-cover" />
        ))}
      </div>
    )
  }

  if (images.length === 3) {
    return (
      <div
        className={cn('grid gap-px overflow-hidden', className)}
        style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}
      >
        <img src={images[0]} alt="" className="row-span-2 w-full h-full object-cover" />
        <img src={images[1]} alt="" className="w-full h-full object-cover" />
        <img src={images[2]} alt="" className="w-full h-full object-cover" />
      </div>
    )
  }

  const extra = (totalCount ?? images.length) - 4
  return (
    <div className={cn('grid grid-cols-2 grid-rows-2 gap-px overflow-hidden relative', className)}>
      {images.slice(0, 4).map((url, i) => (
        <img key={i} src={url} alt="" className="w-full h-full object-cover" />
      ))}
      {extra > 0 && (
        <div className="absolute bottom-2 right-2">
          <span className="bg-black/60 text-white text-xs font-medium px-1.5 py-0.5 rounded">
            +{extra}
          </span>
        </div>
      )}
    </div>
  )
}

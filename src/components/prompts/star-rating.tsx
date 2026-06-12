'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  value: number | null
  onChange?: (rating: number | null) => void
  readonly?: boolean
  size?: 'sm' | 'md'
}

export function StarRating({ value, onChange, readonly = false, size = 'sm' }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'
  const active = hovered ?? value ?? 0

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => !readonly && setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={cn(
            'transition-colors',
            readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110',
          )}
          onMouseEnter={() => !readonly && setHovered(star)}
          onClick={() => {
            if (readonly || !onChange) return
            // clicking the current rating again → clear it
            onChange(star === value ? null : star)
          }}
        >
          <Star
            className={cn(
              iconSize,
              'transition-colors',
              star <= active
                ? 'fill-amber-400 text-amber-400'
                : 'fill-transparent text-muted-foreground/40',
            )}
          />
        </button>
      ))}
    </div>
  )
}

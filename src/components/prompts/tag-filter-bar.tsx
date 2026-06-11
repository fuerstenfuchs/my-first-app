import { Badge } from '@/components/ui/badge'

interface TagFilterBarProps {
  tags: string[]
  activeTag: string | null
  onTagClick: (tag: string) => void
}

export function TagFilterBar({ tags, activeTag, onTagClick }: TagFilterBarProps) {
  return (
    <div className="flex gap-2 px-4 pb-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {tags.map(tag => (
        <button key={tag} onClick={() => onTagClick(tag)} className="shrink-0">
          <Badge
            variant={activeTag === tag ? 'default' : 'secondary'}
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            {tag}
          </Badge>
        </button>
      ))}
    </div>
  )
}

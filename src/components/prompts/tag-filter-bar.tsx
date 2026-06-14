import { tagColorClass } from '@/lib/tag-colors'

interface TagFilterBarProps {
  tags: string[]
  activeTag: string | null
  onTagClick: (tag: string) => void
}

export function TagFilterBar({ tags, activeTag, onTagClick }: TagFilterBarProps) {
  return (
    <div className="flex gap-2 px-4 pb-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {tags.map(tag => (
        <button
          key={tag}
          onClick={() => onTagClick(tag)}
          className={`shrink-0 text-xs px-2 py-0.5 rounded font-mono transition-all
            ${activeTag === tag
              ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-background ' + tagColorClass(tag)
              : tagColorClass(tag) + ' hover:opacity-80'
            }`}
        >
          #{tag}
        </button>
      ))}
    </div>
  )
}

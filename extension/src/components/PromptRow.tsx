import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import type { Prompt } from '../types'

interface Props {
  prompt: Prompt
  onCopy: (prompt: Prompt) => void
}

const TAG_COLORS = [
  'bg-violet-950 text-violet-400',
  'bg-blue-950 text-blue-400',
  'bg-emerald-950 text-emerald-400',
  'bg-amber-950 text-amber-400',
  'bg-rose-950 text-rose-400',
]

function tagColor(tag: string): string {
  let hash = 0
  for (const c of tag) hash = (hash * 31 + c.charCodeAt(0)) & 0x7fffffff
  return TAG_COLORS[hash % TAG_COLORS.length]
}

function relativeTime(iso: string | null): string | null {
  if (!iso) return null
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: de })
  } catch {
    return null
  }
}

export function PromptRow({ prompt, onCopy }: Props) {
  const tags = (prompt.tags ?? []).slice(0, 2)
  const time = relativeTime(prompt.last_used_at)
  const isEmpty = !prompt.content?.trim()

  return (
    <div
      className="group flex items-start gap-2 px-3 py-2.5 hover:bg-zinc-800/60 cursor-pointer transition-colors border-b border-zinc-800/50 last:border-0"
      onClick={() => !isEmpty && onCopy(prompt)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-zinc-100 truncate max-w-[200px]">
            {prompt.title}
          </span>
          {prompt.is_favorite && (
            <svg className="h-3 w-3 text-rose-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {tags.map(tag => (
            <span key={tag} className={`text-[10px] px-1.5 py-0 rounded font-mono leading-5 ${tagColor(tag)}`}>
              #{tag}
            </span>
          ))}
          {time && (
            <span className="text-[10px] text-zinc-600">{time}</span>
          )}
        </div>
      </div>
      <button
        className={`shrink-0 mt-0.5 p-1.5 rounded-md transition-all ${
          isEmpty
            ? 'text-zinc-700 cursor-not-allowed'
            : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 opacity-0 group-hover:opacity-100'
        }`}
        title={isEmpty ? 'Kein Inhalt' : 'Kopieren'}
        onClick={e => { e.stopPropagation(); if (!isEmpty) onCopy(prompt) }}
        disabled={isEmpty}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>
    </div>
  )
}

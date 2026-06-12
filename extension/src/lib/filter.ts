import type { Prompt } from '../types'

export type Tab = 'recent' | 'favorites'

export function filterPrompts(
  prompts: Prompt[],
  query: string,
  tab: Tab,
): Prompt[] {
  const q = query.trim().toLowerCase()

  if (q) {
    return prompts.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.description ?? '').toLowerCase().includes(q)
    )
  }

  if (tab === 'favorites') {
    return prompts.filter(p => p.is_favorite)
  }

  const used = prompts.filter(p => p.last_used_at != null)
  if (used.length > 0) return used.slice(0, 10)
  return prompts.slice(0, 10)
}

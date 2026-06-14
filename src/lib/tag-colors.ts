const COLORS = [
  'bg-green-500/20 text-green-300 border border-green-500/30',
  'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  'bg-pink-500/20 text-pink-300 border border-pink-500/30',
  'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
  'bg-rose-500/20 text-rose-300 border border-rose-500/30',
]

export function tagColorClass(tag: string): string {
  let hash = 0
  for (const char of tag) hash = (hash * 31 + char.charCodeAt(0)) & 0x7fffffff
  return COLORS[hash % COLORS.length]
}

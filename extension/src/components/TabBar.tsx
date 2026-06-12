export type Tab = 'recent' | 'favorites'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

export function TabBar({ active, onChange }: Props) {
  return (
    <div className="flex border-b border-zinc-800">
      {(['recent', 'favorites'] as Tab[]).map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            active === tab
              ? 'text-violet-400 border-b-2 border-violet-500 -mb-px'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {tab === 'recent' ? 'Zuletzt verwendet' : 'Favoriten'}
        </button>
      ))}
    </div>
  )
}

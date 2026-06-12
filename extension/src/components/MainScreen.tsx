import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { filterPrompts } from '../lib/filter'
import type { Prompt } from '../types'
import { Header } from './Header'
import { SearchBar } from './SearchBar'
import { TabBar, type Tab } from './TabBar'
import { EmptyState } from './EmptyState'
import { PromptRow } from './PromptRow'
import { CopyToast } from './CopyToast'

interface Props {
  onLogout: () => void
}

export function MainScreen({ onLogout }: Props) {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('recent')
  const [toast, setToast] = useState(false)

  useEffect(() => {
    loadPrompts()
  }, [])

  async function loadPrompts() {
    setLoading(true)
    setError(false)
    const { data, error } = await supabase
      .from('prompts')
      .select('id, title, description, content, tags, is_favorite, last_used_at, usage_count, created_at')
      .order('last_used_at', { ascending: false, nullsFirst: false })
    if (error) {
      setError(true)
    } else {
      setPrompts(data ?? [])
    }
    setLoading(false)
  }

  const filtered = useMemo(() => filterPrompts(prompts, query, tab), [prompts, query, tab])

  async function handleCopy(prompt: Prompt) {
    try {
      await navigator.clipboard.writeText(prompt.content)
    } catch {
      return
    }

    setToast(true)

    supabase
      .from('prompts')
      .update({ usage_count: (prompt.usage_count ?? 0) + 1, last_used_at: new Date().toISOString() })
      .eq('id', prompt.id)
      .then(() => {
        setPrompts(prev => prev.map(p =>
          p.id === prompt.id
            ? { ...p, usage_count: (p.usage_count ?? 0) + 1, last_used_at: new Date().toISOString() }
            : p
        ))
      })

    setTimeout(() => {
      setToast(false)
      setTimeout(() => window.close(), 100)
    }, 1500)
  }

  const isSearching = query.trim().length > 0

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header onLogout={onLogout} />
      <SearchBar value={query} onChange={setQuery} />

      {!isSearching && <TabBar active={tab} onChange={setTab} />}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-2 p-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 rounded-lg bg-zinc-800/50 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <EmptyState type="error" />
        ) : filtered.length === 0 ? (
          <EmptyState type={isSearching ? 'search' : tab} />
        ) : (
          filtered.map(p => (
            <PromptRow key={p.id} prompt={p} onCopy={handleCopy} />
          ))
        )}
      </div>

      <CopyToast visible={toast} />
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart2, Copy, Hash, Layers, TrendingUp } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiCard } from '@/components/stats/kpi-card'
import { PromptModal } from '@/components/prompts/prompt-modal'
import { useStats } from '@/hooks/use-stats'
import { usePrompts, type Prompt, type PromptInput } from '@/hooks/use-prompts'

export default function StatsPage() {
  const { prompts, loading, updatePrompt, copyPrompt } = usePrompts()
  const { totalCopies, totalPrompts, topTag, topTen } = useStats(prompts)

  const router = useRouter()
  const [modalPrompt, setModalPrompt] = useState<Prompt | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  function openDetail(prompt: Prompt) {
    setModalPrompt(prompt)
    setModalOpen(true)
  }

  async function handleSave(input: PromptInput): Promise<boolean> {
    if (!modalPrompt) return false
    return updatePrompt(modalPrompt.id, input)
  }

  const maxCount = topTen[0]?.usage_count ?? 1

  return (
    <div className="flex flex-col h-svh">
      <header className="border-b shrink-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <SidebarTrigger />
          <BarChart2 className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Statistiken</h1>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : totalCopies === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center gap-4 px-4">
            <TrendingUp className="h-12 w-12 text-muted-foreground/40" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Noch keine Nutzungsdaten</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Kopiere Prompts auf der Hauptansicht, um Statistiken zu sehen.
              </p>
            </div>
            <Button onClick={() => router.push('/')}>Zur Hauptansicht</Button>
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard
                label="Gesamt-Kopiervorgänge"
                value={totalCopies}
                icon={<Copy className="h-5 w-5" />}
              />
              <KpiCard
                label="Prompts gesamt"
                value={totalPrompts}
                icon={<Layers className="h-5 w-5" />}
              />
              <KpiCard
                label="Meistgenutzter Tag"
                value={topTag ?? '—'}
                icon={<Hash className="h-5 w-5" />}
              />
            </div>

            {/* Top-10 Ranking */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Top {topTen.length} Prompts
              </h2>
              <div className="space-y-2">
                {topTen.map((prompt, i) => {
                  const pct = Math.round((prompt.usage_count / maxCount) * 100)
                  return (
                    <button
                      key={prompt.id}
                      onClick={() => openDetail(prompt)}
                      className="w-full text-left rounded-lg border bg-card hover:bg-accent transition-colors px-4 py-3 group"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          i === 0 ? 'bg-yellow-400/20 text-yellow-600 dark:text-yellow-400' :
                          i === 1 ? 'bg-slate-400/20 text-slate-600 dark:text-slate-400' :
                          i === 2 ? 'bg-orange-400/20 text-orange-600 dark:text-orange-400' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {i + 1}
                        </span>
                        <span className="flex-1 font-medium truncate group-hover:text-foreground">
                          {prompt.title}
                        </span>
                        <Badge variant="secondary" className="shrink-0 tabular-nums">
                          {prompt.usage_count}×
                        </Badge>
                      </div>
                      <div className="mt-2 ml-10 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      <PromptModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        prompt={modalPrompt}
        mode="view"
        onSave={handleSave}
        onCopy={modalPrompt ? () => copyPrompt(modalPrompt) : undefined}
      />
    </div>
  )
}

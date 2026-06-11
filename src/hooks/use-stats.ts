'use client'

import { useMemo } from 'react'
import type { Prompt } from '@/hooks/use-prompts'

export interface StatsData {
  totalCopies: number
  totalPrompts: number
  topTag: string | null
  topTen: Prompt[]
}

export function useStats(prompts: Prompt[]): StatsData {
  return useMemo(() => {
    const totalCopies = prompts.reduce((sum, p) => sum + p.usage_count, 0)
    const totalPrompts = prompts.length

    const tagScores = new Map<string, number>()
    for (const p of prompts) {
      for (const tag of p.tags) {
        tagScores.set(tag, (tagScores.get(tag) ?? 0) + p.usage_count)
      }
    }
    let topTag: string | null = null
    let topScore = -1
    for (const [tag, score] of tagScores) {
      if (score > topScore) {
        topScore = score
        topTag = tag
      }
    }

    const topTen = prompts
      .filter(p => p.usage_count > 0)
      .sort((a, b) => b.usage_count - a.usage_count || a.title.localeCompare(b.title))
      .slice(0, 10)

    return { totalCopies, totalPrompts, topTag, topTen }
  }, [prompts])
}

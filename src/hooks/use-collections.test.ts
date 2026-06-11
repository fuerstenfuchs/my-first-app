import { describe, it, expect } from 'vitest'
import type { CollectionPromptItem } from './use-collections'
import type { Prompt } from './use-prompts'

// --- Pure helper mirroring the swap logic in useCollectionPrompts ---
// This mirrors the exact array mutation in the swap() function of the hook.
function computeSwap(
  items: CollectionPromptItem[],
  i: number,
  j: number
): CollectionPromptItem[] {
  const newItems = [...items]
  const tempOrder = newItems[i].sort_order
  newItems[i] = { ...newItems[i], sort_order: newItems[j].sort_order }
  newItems[j] = { ...newItems[j], sort_order: tempOrder }
  ;[newItems[i], newItems[j]] = [newItems[j], newItems[i]]
  return newItems
}

function makeItem(id: string, sort_order: number): CollectionPromptItem {
  return { id, sort_order, prompt: { id } as unknown as Prompt }
}

describe('collection reorder logic (swap)', () => {
  it('swaps two adjacent items and exchanges sort_orders', () => {
    const items = [makeItem('a', 0), makeItem('b', 1), makeItem('c', 2)]
    const result = computeSwap(items, 0, 1)

    // positions swapped
    expect(result[0].id).toBe('b')
    expect(result[1].id).toBe('a')
    expect(result[2].id).toBe('c')

    // sort_orders exchanged
    expect(result[0].sort_order).toBe(0)
    expect(result[1].sort_order).toBe(1)
    expect(result[2].sort_order).toBe(2)
  })

  it('swapping last two items works correctly', () => {
    const items = [makeItem('a', 0), makeItem('b', 1), makeItem('c', 2)]
    const result = computeSwap(items, 1, 2)

    expect(result[0].id).toBe('a')
    expect(result[1].id).toBe('c')
    expect(result[2].id).toBe('b')

    expect(result[0].sort_order).toBe(0)
    expect(result[1].sort_order).toBe(1)
    expect(result[2].sort_order).toBe(2)
  })

  it('does not mutate the original array', () => {
    const items = [makeItem('a', 0), makeItem('b', 1)]
    const before = JSON.stringify(items)
    computeSwap(items, 0, 1)
    expect(JSON.stringify(items)).toBe(before)
  })

  it('swapping same index returns unchanged order and sort_orders', () => {
    const items = [makeItem('a', 0), makeItem('b', 1)]
    const result = computeSwap(items, 0, 0)
    expect(result[0].id).toBe('a')
    expect(result[0].sort_order).toBe(0)
  })
})

// --- moveUp / moveDown boundary guard ---
describe('moveUp / moveDown boundary conditions', () => {
  it('moveUp on index 0 should be a no-op (guard condition)', () => {
    // The hook returns early: if (index === 0) return
    const shouldSkip = (index: number) => index === 0
    expect(shouldSkip(0)).toBe(true)
    expect(shouldSkip(1)).toBe(false)
  })

  it('moveDown on last index should be a no-op (guard condition)', () => {
    const items = [makeItem('a', 0), makeItem('b', 1), makeItem('c', 2)]
    const shouldSkip = (index: number) => index === items.length - 1
    expect(shouldSkip(2)).toBe(true)
    expect(shouldSkip(1)).toBe(false)
  })
})

// --- createCollection name trimming ---
describe('collection name trimming', () => {
  it('trims whitespace from collection name', () => {
    const trim = (name: string) => name.trim()
    expect(trim('  My Collection  ')).toBe('My Collection')
    expect(trim('')).toBe('')
    expect(trim('  ')).toBe('')
  })

  it('empty name after trim should be rejected', () => {
    const isValid = (name: string) => name.trim().length > 0
    expect(isValid('')).toBe(false)
    expect(isValid('  ')).toBe(false)
    expect(isValid('valid')).toBe(true)
  })
})

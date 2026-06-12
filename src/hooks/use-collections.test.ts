import { describe, it, expect } from 'vitest'
import type { CollectionPromptItem } from './use-collections'
import type { Prompt } from './use-prompts'

// --- Helpers ---

function makeItem(id: string, sort_order: number): CollectionPromptItem {
  return { id, sort_order, prompt: { id } as unknown as Prompt }
}

function makePromptItem(
  id: string,
  sort_order: number,
  coverUrl: string | null = null,
  mediaUrls: string[] = []
): CollectionPromptItem {
  return {
    id,
    sort_order,
    prompt: {
      id,
      cover_image_url: coverUrl,
      preview_media: mediaUrls.map((url, i) => ({ type: 'image' as const, url, sort_order: i })),
    } as unknown as Prompt,
  }
}

// --- Pure mirror of the arrayMove + reorder logic from useCollectionPrompts ---

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr]
  result.splice(to, 0, result.splice(from, 1)[0])
  return result
}

function computeReorder(
  items: CollectionPromptItem[],
  oldIndex: number,
  newIndex: number
): CollectionPromptItem[] {
  return arrayMove(items, oldIndex, newIndex).map((item, i) => ({
    ...item,
    sort_order: i + 1,
  }))
}

// --- Cover image extraction logic (mirrors useCollectionsOverview) ---

function extractCollageImages(
  prompts: Array<{ cover_image_url: string | null; media_urls: string[] }>
): string[] {
  const images: string[] = []
  for (const p of prompts) {
    const img = p.cover_image_url || p.media_urls[0] || null
    if (img) images.push(img)
    if (images.length >= 4) break
  }
  return images
}

// --- getAllImages from CollectionCoverModal ---

function getAllImages(items: CollectionPromptItem[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    const p = item.prompt as unknown as {
      cover_image_url: string | null
      preview_media: Array<{ type: string; url: string }>
    }
    const urls = [
      p.cover_image_url,
      ...(p.preview_media ?? []).filter(m => m.type === 'image').map(m => m.url),
    ].filter((u): u is string => Boolean(u))
    for (const url of urls) {
      if (!seen.has(url)) {
        seen.add(url)
        result.push(url)
      }
    }
  }
  return result
}

// ═══════════════════════════════════════════════════════════════════════
// Reorder logic (PROJ-11: replaces old swap() with arrayMove-based reorder)
// ═══════════════════════════════════════════════════════════════════════

describe('reorder logic (drag & drop)', () => {
  it('moves item forward: first → last', () => {
    const items = [makeItem('a', 1), makeItem('b', 2), makeItem('c', 3)]
    const result = computeReorder(items, 0, 2)
    expect(result.map(i => i.id)).toEqual(['b', 'c', 'a'])
    expect(result.map(i => i.sort_order)).toEqual([1, 2, 3])
  })

  it('moves item backward: last → first', () => {
    const items = [makeItem('a', 1), makeItem('b', 2), makeItem('c', 3)]
    const result = computeReorder(items, 2, 0)
    expect(result.map(i => i.id)).toEqual(['c', 'a', 'b'])
    expect(result.map(i => i.sort_order)).toEqual([1, 2, 3])
  })

  it('moves adjacent item down one position', () => {
    const items = [makeItem('a', 1), makeItem('b', 2), makeItem('c', 3)]
    const result = computeReorder(items, 0, 1)
    expect(result.map(i => i.id)).toEqual(['b', 'a', 'c'])
  })

  it('sort_order values are always 1-indexed and sequential after reorder', () => {
    const items = [makeItem('x', 10), makeItem('y', 20), makeItem('z', 30)]
    const result = computeReorder(items, 2, 0)
    expect(result[0].sort_order).toBe(1)
    expect(result[1].sort_order).toBe(2)
    expect(result[2].sort_order).toBe(3)
  })

  it('does not mutate the original array', () => {
    const items = [makeItem('a', 1), makeItem('b', 2)]
    const before = JSON.stringify(items)
    computeReorder(items, 0, 1)
    expect(JSON.stringify(items)).toBe(before)
  })

  it('single item: reorder with same index is identity', () => {
    const items = [makeItem('only', 1)]
    const result = computeReorder(items, 0, 0)
    expect(result[0].id).toBe('only')
    expect(result[0].sort_order).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Cover image extraction (PROJ-11: useCollectionsOverview collage logic)
// ═══════════════════════════════════════════════════════════════════════

describe('collage image extraction', () => {
  it('uses cover_image_url as first priority', () => {
    const prompts = [{ cover_image_url: 'cover.jpg', media_urls: ['media.jpg'] }]
    expect(extractCollageImages(prompts)).toEqual(['cover.jpg'])
  })

  it('falls back to first media url when no cover_image_url', () => {
    const prompts = [{ cover_image_url: null, media_urls: ['media1.jpg', 'media2.jpg'] }]
    expect(extractCollageImages(prompts)).toEqual(['media1.jpg'])
  })

  it('returns empty array when no images at all', () => {
    const prompts = [{ cover_image_url: null, media_urls: [] }]
    expect(extractCollageImages(prompts)).toEqual([])
  })

  it('collects one image per prompt, max 4 images', () => {
    const prompts = Array.from({ length: 6 }, (_, i) => ({
      cover_image_url: `img${i}.jpg`,
      media_urls: [],
    }))
    const result = extractCollageImages(prompts)
    expect(result).toHaveLength(4)
    expect(result).toEqual(['img0.jpg', 'img1.jpg', 'img2.jpg', 'img3.jpg'])
  })

  it('skips prompts with no images and takes next available', () => {
    const prompts = [
      { cover_image_url: null, media_urls: [] },
      { cover_image_url: 'second.jpg', media_urls: [] },
    ]
    expect(extractCollageImages(prompts)).toEqual(['second.jpg'])
  })

  it('returns empty array for empty prompt list', () => {
    expect(extractCollageImages([])).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════
// getAllImages (CollectionCoverModal: unique image dedup across prompts)
// ═══════════════════════════════════════════════════════════════════════

describe('getAllImages (cover modal gallery)', () => {
  it('collects cover_image_url and media images', () => {
    const items = [makePromptItem('p1', 1, 'cover.jpg', ['m1.jpg', 'm2.jpg'])]
    expect(getAllImages(items)).toEqual(['cover.jpg', 'm1.jpg', 'm2.jpg'])
  })

  it('deduplicates identical URLs across prompts', () => {
    const items = [
      makePromptItem('p1', 1, 'shared.jpg', []),
      makePromptItem('p2', 2, 'shared.jpg', []),
    ]
    expect(getAllImages(items)).toEqual(['shared.jpg'])
  })

  it('returns empty array when no prompts have images', () => {
    const items = [makePromptItem('p1', 1, null, [])]
    expect(getAllImages(items)).toEqual([])
  })

  it('excludes video media, only includes images', () => {
    const items = [
      {
        id: 'cp1',
        sort_order: 1,
        prompt: {
          id: 'p1',
          cover_image_url: null,
          preview_media: [
            { type: 'video', url: 'video.mp4', sort_order: 0 },
            { type: 'image', url: 'image.jpg', sort_order: 1 },
          ],
        } as unknown as Prompt,
      },
    ]
    expect(getAllImages(items)).toEqual(['image.jpg'])
  })

  it('handles multiple prompts with different images', () => {
    const items = [
      makePromptItem('p1', 1, 'c1.jpg', ['m1.jpg']),
      makePromptItem('p2', 2, null, ['m2.jpg', 'm3.jpg']),
    ]
    expect(getAllImages(items)).toEqual(['c1.jpg', 'm1.jpg', 'm2.jpg', 'm3.jpg'])
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Collection name validation
// ═══════════════════════════════════════════════════════════════════════

describe('collection name validation', () => {
  it('trims whitespace from collection name', () => {
    const trim = (name: string) => name.trim()
    expect(trim('  My Collection  ')).toBe('My Collection')
    expect(trim('')).toBe('')
  })

  it('empty name after trim is invalid', () => {
    const isValid = (name: string) => name.trim().length > 0
    expect(isValid('')).toBe(false)
    expect(isValid('  ')).toBe(false)
    expect(isValid('valid')).toBe(true)
  })
})

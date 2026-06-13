// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockEmbeddingsCreate } = vi.hoisted(() => ({
  mockEmbeddingsCreate: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [], set: vi.fn() })),
}))

vi.mock('openai', () => ({
  default: class MockOpenAI {
    embeddings = { create: mockEmbeddingsCreate }
  },
}))

let authUser: { id: string } | null = { id: 'user-123' }
const mockRpc = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn(() => Promise.resolve({
    auth: {
      getUser: () => Promise.resolve({ data: { user: authUser } }),
    },
    rpc: mockRpc,
  })),
}))

vi.stubEnv('OPENAI_API_KEY', 'sk-test-key')

const { POST } = await import('./route')

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/search', () => {
  beforeEach(() => {
    authUser = { id: 'user-123' }
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: Array(1536).fill(0.05) }],
    })
    mockRpc.mockResolvedValue({
      data: [
        { id: '00000000-0000-4000-8000-000000000001', score: 0.92 },
        { id: '00000000-0000-4000-8000-000000000002', score: 0.85 },
      ],
      error: null,
    })
  })

  it('returns 401 when not authenticated', async () => {
    authUser = null
    const res = await POST(makeRequest({ query: 'portrait photo' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when query is too short (< 2 chars)', async () => {
    const res = await POST(makeRequest({ query: 'a' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing query field', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns sorted ids on success', async () => {
    const res = await POST(makeRequest({ query: 'portrait photo' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ids).toEqual([
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
    ])
  })

  it('passes activeTag and favoritesOnly to hybrid_search rpc', async () => {
    await POST(makeRequest({ query: 'portrait', activeTag: 'comfyui', favoritesOnly: true }))
    expect(mockRpc).toHaveBeenCalledWith('hybrid_search', expect.objectContaining({
      tag_filter: 'comfyui',
      p_favorites_only: true,
    }))
  })

  it('returns empty ids when OpenAI fails (silent fallback)', async () => {
    mockEmbeddingsCreate.mockRejectedValue(new Error('API error'))
    const res = await POST(makeRequest({ query: 'portrait photo' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ids).toEqual([])
  })

  it('returns empty ids when hybrid_search rpc errors (silent fallback)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } })
    const res = await POST(makeRequest({ query: 'portrait photo' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ids).toEqual([])
  })
})

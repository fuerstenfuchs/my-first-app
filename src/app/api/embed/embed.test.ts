// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// vi.hoisted ensures the mock fn is defined before vi.mock() factories run
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

// Mutable state lets each test control behaviour without complex chains
let authUser: { id: string } | null = { id: 'user-123' }
let fetchedPrompts: unknown[] = [
  { id: '00000000-0000-4000-8000-000000000001', title: 'Test', content: 'Content', description: null },
]
let fetchError: unknown = null

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn(() => Promise.resolve({
    auth: {
      getUser: () => Promise.resolve({ data: { user: authUser } }),
    },
    from: () => ({
      select: () => ({
        in: () => ({
          eq: () => Promise.resolve({ data: fetchedPrompts, error: fetchError }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
    }),
  })),
}))

vi.stubEnv('OPENAI_API_KEY', 'sk-test-key')

const { POST } = await import('./route')

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID_UUID = '00000000-0000-4000-8000-000000000001'

describe('POST /api/embed', () => {
  beforeEach(() => {
    authUser = { id: 'user-123' }
    fetchedPrompts = [{ id: VALID_UUID, title: 'Test', content: 'Content', description: null }]
    fetchError = null
    mockEmbeddingsCreate.mockClear()
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: Array(1536).fill(0.1) }],
    })
  })

  it('returns 401 when not authenticated', async () => {
    authUser = null
    const res = await POST(makeRequest({ ids: [VALID_UUID] }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for empty ids array', async () => {
    const res = await POST(makeRequest({ ids: [] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid UUID', async () => {
    const res = await POST(makeRequest({ ids: ['not-a-uuid'] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for more than 25 ids', async () => {
    const ids = Array.from({ length: 26 }, (_, i) =>
      `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
    const res = await POST(makeRequest({ ids }))
    expect(res.status).toBe(400)
  })

  it('returns indexed count on success', async () => {
    const res = await POST(makeRequest({ ids: [VALID_UUID] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.indexed).toBe(1)
    expect(mockEmbeddingsCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'text-embedding-3-small',
    }))
  })

  it('returns 502 when OpenAI embedding fails', async () => {
    mockEmbeddingsCreate.mockRejectedValue(new Error('API error'))
    const res = await POST(makeRequest({ ids: [VALID_UUID] }))
    expect(res.status).toBe(502)
  })

  it('returns indexed 0 when no prompts found for user', async () => {
    fetchedPrompts = []
    const res = await POST(makeRequest({ ids: [VALID_UUID] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.indexed).toBe(0)
    expect(mockEmbeddingsCreate).not.toHaveBeenCalled()
  })
})

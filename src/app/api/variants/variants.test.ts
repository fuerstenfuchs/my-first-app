// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [], set: vi.fn() })),
}))

vi.mock('openai', () => ({
  default: class MockOpenAI {
    embeddings = {
      create: vi.fn().mockResolvedValue({ data: [{ embedding: Array(1536).fill(0.1) }] }),
    }
  },
}))

const PROMPT_ID = '00000000-0000-4000-8000-000000000001'
const VARIANT_ID = '00000000-0000-4000-8000-000000000002'
const USER_ID    = 'user-123'

let authUser: { id: string } | null = { id: USER_ID }
let mockPrompt: unknown = { id: PROMPT_ID, content: 'Original prompt text' }
let variantCount = 0
let insertError: unknown = null
let deleteError: unknown = null

// Minimal chainable Supabase mock
function makeSupabase() {
  const variant = { id: VARIANT_ID, prompt_id: PROMPT_ID, name: 'Variante 2', content: 'New variant', sort_order: 2, created_at: new Date().toISOString() }
  const remaining = variantCount > 1
    ? [{ id: VARIANT_ID, content: 'Survivor', sort_order: 1 }, { id: 'other', content: 'Other', sort_order: 2 }]
    : [{ id: VARIANT_ID, content: 'Survivor', sort_order: 1 }]

  return {
    auth: { getUser: () => Promise.resolve({ data: { user: authUser } }) },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve(
              table === 'prompts'
                ? { data: mockPrompt, error: mockPrompt ? null : { message: 'not found' } }
                : { data: { id: VARIANT_ID, prompt_id: PROMPT_ID, sort_order: 1, content: 'Old' }, error: null }
            ),
          }),
          neq: () => ({ order: () => Promise.resolve({ data: remaining, error: null }) }),
        }),
        in: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        head: true,
        count: 'exact',
      }),
      insert: () => ({
        select: () => ({ single: () => Promise.resolve({ data: variant, error: insertError }) }),
        then: undefined,
      }),
      update: () => ({
        eq: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: variant, error: null }) }) }) }),
      }),
      delete: () => ({
        eq: () => ({ eq: () => Promise.resolve({ error: deleteError }) }),
      }),
    }),
  }
}

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn(() => Promise.resolve(makeSupabase())),
}))

vi.stubEnv('OPENAI_API_KEY', 'sk-test')

// Lazy import AFTER mocks are set up
const { POST } = await import('./route')

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/variants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('POST /api/variants', () => {
  beforeEach(() => {
    authUser = { id: USER_ID }
    mockPrompt = { id: PROMPT_ID, content: 'Original prompt text' }
    variantCount = 0
    insertError = null
    deleteError = null
  })

  it('returns 401 when not authenticated', async () => {
    authUser = null
    const res = await POST(makeRequest({ prompt_id: PROMPT_ID, content: 'test' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing prompt_id', async () => {
    const res = await POST(makeRequest({ content: 'test' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid UUID', async () => {
    const res = await POST(makeRequest({ prompt_id: 'not-a-uuid', content: 'test' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty content', async () => {
    const res = await POST(makeRequest({ prompt_id: PROMPT_ID, content: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when prompt not found', async () => {
    mockPrompt = null
    const res = await POST(makeRequest({ prompt_id: PROMPT_ID, content: 'some content' }))
    expect(res.status).toBe(404)
  })

  it('creates variant successfully', async () => {
    const res = await POST(makeRequest({ prompt_id: PROMPT_ID, content: 'New variant text', name: 'Mit [Person]' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.variant).toBeDefined()
    expect(body.variant.id).toBe(VARIANT_ID)
  })
})

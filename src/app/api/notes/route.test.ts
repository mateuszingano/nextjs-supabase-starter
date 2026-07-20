import { describe, it, expect, vi, beforeEach } from 'vitest'
import { queryBuilder, supabaseStub } from '@/lib/test/supabase-stub'

// The handler pulls its client from this module — mock it so we control auth and
// capture what the handler tries to write, without a database.
const stub = vi.hoisted(() => ({ current: null as ReturnType<typeof supabaseStub> | null }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => stub.current!.client),
}))

import { GET, POST } from './route'

const USER = { id: 'user-a-uuid' }

function postRequest(payload: unknown) {
  return new Request('https://app.test/api/notes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/notes', () => {
  it('401s when signed out (never reaches the table)', async () => {
    stub.current = supabaseStub({ user: null })
    const res = await GET()
    expect(res.status).toBe(401)
    expect(stub.current.client.from).not.toHaveBeenCalled()
  })

  it('lists the caller notes when signed in', async () => {
    stub.current = supabaseStub({ user: USER, builder: queryBuilder({ data: [{ id: 'n1' }] }) })
    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ notes: [{ id: 'n1' }] })
  })
})

describe('POST /api/notes', () => {
  it('401s when signed out', async () => {
    stub.current = supabaseStub({ user: null })
    const res = await POST(postRequest({ title: 'x' }))
    expect(res.status).toBe(401)
    expect(stub.current.client.from).not.toHaveBeenCalled()
  })

  // Regression (IDOR): a client-supplied author_id must NEVER reach the row. The
  // handler derives author_id from the authenticated session. Deleting that and
  // trusting the body left this suite green before — this is the test that fails.
  it('ignores a forged author_id in the body and uses the session user', async () => {
    stub.current = supabaseStub({ user: USER, builder: queryBuilder({ data: { id: 'n1' } }) })
    const res = await POST(postRequest({ title: 'mine', body: 'b', author_id: 'victim-uuid' }))
    expect(res.status).toBe(201)
    const inserted = stub.current.builder.captured.insert as { author_id: string }
    expect(inserted.author_id).toBe(USER.id)
    expect(inserted.author_id).not.toBe('victim-uuid')
  })

  it('400s on invalid input (blank title)', async () => {
    stub.current = supabaseStub({ user: USER })
    const res = await POST(postRequest({ title: '   ' }))
    expect(res.status).toBe(400)
    expect(stub.current.client.from).not.toHaveBeenCalled()
  })

  // Regression: the body-size guard must run BEFORE we touch the database.
  it('413s an oversized body before hitting the table', async () => {
    stub.current = supabaseStub({ user: USER })
    const req = new Request('https://app.test/api/notes', {
      method: 'POST',
      headers: { 'content-length': String(64 * 1024 + 1), 'content-type': 'application/json' },
      body: 'x',
    })
    const res = await POST(req)
    expect(res.status).toBe(413)
    expect(stub.current.client.from).not.toHaveBeenCalled()
  })
})

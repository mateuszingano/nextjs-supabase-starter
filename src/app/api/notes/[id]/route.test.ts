import { describe, it, expect, vi, beforeEach } from 'vitest'
import { queryBuilder, supabaseStub } from '@/lib/test/supabase-stub'

const stub = vi.hoisted(() => ({ current: null as ReturnType<typeof supabaseStub> | null }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => stub.current!.client),
}))

import { PATCH, DELETE } from './route'

const USER = { id: 'user-a-uuid' }
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

function patchRequest(payload: unknown) {
  return new Request('https://app.test/api/notes/n1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/notes/:id', () => {
  it('401s when signed out', async () => {
    stub.current = supabaseStub({ user: null })
    const res = await PATCH(patchRequest({ title: 'x' }), ctx('n1'))
    expect(res.status).toBe(401)
    expect(stub.current.client.from).not.toHaveBeenCalled()
  })

  // Regression: a title-only patch must update ONLY the title. Sharing the
  // create schema fabricated body:'' and wiped the column.
  it('updates only the fields sent (does not fabricate a body)', async () => {
    stub.current = supabaseStub({ user: USER, builder: queryBuilder({ data: { id: 'n1', title: 'v2' } }) })
    const res = await PATCH(patchRequest({ title: 'v2' }), ctx('n1'))
    expect(res.status).toBe(200)
    const updated = stub.current.builder.captured.update as Record<string, unknown>
    expect(updated).toEqual({ title: 'v2' })
    expect(updated).not.toHaveProperty('body')
  })

  it('400s an empty patch (the "No fields to update" guard is reachable)', async () => {
    stub.current = supabaseStub({ user: USER })
    const res = await PATCH(patchRequest({}), ctx('n1'))
    expect(res.status).toBe(400)
    expect(stub.current.client.from).not.toHaveBeenCalled()
  })

  // Regression (IDOR): author_id is not a patchable field; a forged one is dropped.
  it('drops a forged author_id from the patch', async () => {
    stub.current = supabaseStub({ user: USER, builder: queryBuilder({ data: { id: 'n1' } }) })
    await PATCH(patchRequest({ title: 'v2', author_id: 'victim-uuid' }), ctx('n1'))
    const updated = stub.current.builder.captured.update as Record<string, unknown>
    expect(updated).not.toHaveProperty('author_id')
  })

  it('404s when the row is not owned by the caller (0 rows → null)', async () => {
    stub.current = supabaseStub({ user: USER, builder: queryBuilder({ data: null }) })
    const res = await PATCH(patchRequest({ title: 'v2' }), ctx('someone-elses-id'))
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/notes/:id', () => {
  it('401s when signed out', async () => {
    stub.current = supabaseStub({ user: null })
    const res = await DELETE(new Request('https://app.test/api/notes/n1', { method: 'DELETE' }), ctx('n1'))
    expect(res.status).toBe(401)
  })

  it('404s when the row is not the caller\'s', async () => {
    stub.current = supabaseStub({ user: USER, builder: queryBuilder({ data: null }) })
    const res = await DELETE(new Request('https://app.test/api/notes/x', { method: 'DELETE' }), ctx('x'))
    expect(res.status).toBe(404)
  })

  it('confirms deletion of an owned row', async () => {
    stub.current = supabaseStub({ user: USER, builder: queryBuilder({ data: { id: 'n1' } }) })
    const res = await DELETE(new Request('https://app.test/api/notes/n1', { method: 'DELETE' }), ctx('n1'))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })
})

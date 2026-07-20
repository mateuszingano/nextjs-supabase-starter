import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabaseStub } from '@/lib/test/supabase-stub'

const stub = vi.hoisted(() => ({ current: null as ReturnType<typeof supabaseStub> | null }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => stub.current!.client),
}))

import { POST } from './route'

beforeEach(() => {
  stub.current = supabaseStub({ user: { id: 'u1' } })
})

describe('POST /auth/logout', () => {
  it('signs the user out and redirects to /login (303)', async () => {
    const res = await POST(new Request('https://app.test/auth/logout', { method: 'POST' }))
    expect(stub.current!.signOut).toHaveBeenCalledOnce()
    expect(res.status).toBe(303)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabaseStub } from '@/lib/test/supabase-stub'

const stub = vi.hoisted(() => ({ current: null as ReturnType<typeof supabaseStub> | null }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => stub.current!.client),
}))

// next/navigation's redirect() throws a special signal to halt rendering. Mock
// it as a throwing spy so we can assert it fired with the right path.
const redirect = vi.hoisted(() => vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`) }))
vi.mock('next/navigation', () => ({ redirect }))

import { requireAccess } from './require-access'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requireAccess', () => {
  // Regression: removing the redirect left a signed-out visitor with access.
  it('redirects to /login when signed out', async () => {
    stub.current = supabaseStub({ user: null })
    await expect(requireAccess()).rejects.toThrow('REDIRECT:/login')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('returns the user and client when signed in', async () => {
    stub.current = supabaseStub({ user: { id: 'u1' } })
    const result = await requireAccess()
    expect(result.user).toEqual({ id: 'u1' })
    expect(result.supabase).toBe(stub.current.client)
    expect(redirect).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabaseStub } from '@/lib/test/supabase-stub'

const stub = vi.hoisted(() => ({ current: null as ReturnType<typeof supabaseStub> | null }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => stub.current!.client),
}))

import { GET } from './route'

const call = (url: string) => GET(new Request(url))
const location = (res: Response) => new URL(res.headers.get('location')!)

beforeEach(() => {
  stub.current = supabaseStub({ user: { id: 'u1' } })
})

describe('GET /auth/callback — open redirect defense', () => {
  // Regression: `next` is attacker-controlled. Removing the sanitizer let the
  // callback bounce to an external host after establishing a session.
  const hostile = [
    '//evil.com',
    '///evil.com',
    '/\\evil.com',
    'https://evil.com',
    '@evil.com',
    'http://evil.com/path',
  ]
  for (const next of hostile) {
    it(`sends hostile next=${next} to /notes, never off-origin`, async () => {
      const res = await call(`https://app.test/auth/callback?code=abc&next=${encodeURIComponent(next)}`)
      const loc = location(res)
      expect(loc.origin).toBe('https://app.test')
      expect(loc.pathname).toBe('/notes')
    })
  }

  it('honors a safe relative next', async () => {
    const res = await call('https://app.test/auth/callback?code=abc&next=/settings')
    const loc = location(res)
    expect(loc.origin).toBe('https://app.test')
    expect(loc.pathname).toBe('/settings')
  })

  it('defaults to /notes when next is absent', async () => {
    const res = await call('https://app.test/auth/callback?code=abc')
    expect(location(res).pathname).toBe('/notes')
  })

  it('redirects to /login?error=auth when there is no code', async () => {
    const res = await call('https://app.test/auth/callback')
    const loc = location(res)
    expect(loc.pathname).toBe('/login')
    expect(loc.searchParams.get('error')).toBe('auth')
  })

  it('redirects to /login?error=auth when the code exchange fails', async () => {
    stub.current = supabaseStub({ exchangeError: new Error('bad code') })
    const res = await call('https://app.test/auth/callback?code=bad&next=/settings')
    expect(location(res).pathname).toBe('/login')
  })
})

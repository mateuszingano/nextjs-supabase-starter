import { describe, it, expect } from 'vitest'
import { isPublicPath, unauthenticatedResponse } from './proxy'

// The edge auth check skips public routes and static assets. These tests pin down
// the two footguns the old `pathname.includes('.')` + prefix `startsWith` had:
// a protected path with a dot must NOT be treated as static, and a prefix like
// `/login-evil` must NOT be treated as the public `/login`.
describe('isPublicPath', () => {
  it('treats real public routes (and their subpaths) as public', () => {
    expect(isPublicPath('/login')).toBe(true)
    expect(isPublicPath('/signup')).toBe(true)
    expect(isPublicPath('/auth/callback')).toBe(true)
    expect(isPublicPath('/auth/callback/google')).toBe(true)
  })

  it('does NOT treat a prefix lookalike as public', () => {
    expect(isPublicPath('/login-evil')).toBe(false)
    expect(isPublicPath('/signup-admin')).toBe(false)
    expect(isPublicPath('/loginsomething')).toBe(false)
  })

  it('skips genuine static assets by extension', () => {
    expect(isPublicPath('/robots.txt')).toBe(true)
    expect(isPublicPath('/sitemap.xml')).toBe(true)
    expect(isPublicPath('/favicon.ico')).toBe(true)
    expect(isPublicPath('/fonts/inter.woff2')).toBe(true)
    expect(isPublicPath('/_next/static/chunk.js')).toBe(true)
  })

  it('does NOT skip a protected route just because it contains a dot', () => {
    expect(isPublicPath('/dashboard/report.2024')).toBe(false)
    expect(isPublicPath('/notes/v1.2')).toBe(false)
    expect(isPublicPath('/api/notes')).toBe(false)
    expect(isPublicPath('/dashboard')).toBe(false)
  })
})

// An unauthenticated API call used to be redirected (307) to the HTML login
// page, so the 401 that `authenticate()` builds was unreachable for a request
// with no session — and any non-browser caller (mobile app, CLI, fetch) got
// markup where it expected JSON.
describe('unauthenticatedResponse', () => {
  it('answers API routes with a machine-readable 401', async () => {
    for (const p of ['/api', '/api/notes', '/api/notes/123', '/api/export/report.csv']) {
      const res = unauthenticatedResponse(p, 'https://app.test' + p)
      expect(res.status, `${p} should be 401`).toBe(401)
      await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' })
    }
  })

  it('still redirects page navigations to /login', () => {
    for (const p of ['/notes', '/settings', '/dashboard/report.2024']) {
      const res = unauthenticatedResponse(p, 'https://app.test' + p)
      expect(res.status, `${p} should redirect`).toBe(307)
      expect(res.headers.get('location')).toBe('https://app.test/login')
    }
  })

  it('does not mistake a lookalike prefix for an API route', () => {
    const res = unauthenticatedResponse('/apifoo', 'https://app.test/apifoo')
    expect(res.status).toBe(307)
  })
})

// `/_next` was matched with a bare startsWith, so `/_nextevil/...` counted as a
// framework asset and skipped the edge auth check — the same prefix-lookalike
// class this function already guards against for `/login`.
describe('_next boundary', () => {
  it('treats real framework assets as public', () => {
    expect(isPublicPath('/_next')).toBe(true)
    expect(isPublicPath('/_next/static/chunk.js')).toBe(true)
    expect(isPublicPath('/_next/image')).toBe(true)
  })

  it('does NOT treat a prefix lookalike as a framework asset', () => {
    expect(isPublicPath('/_nextevil/admin')).toBe(false)
    expect(isPublicPath('/_nextadmin')).toBe(false)
  })
})

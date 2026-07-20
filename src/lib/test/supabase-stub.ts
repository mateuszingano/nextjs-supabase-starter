import { vi } from 'vitest'

/**
 * A chainable Supabase query-builder stub for handler unit tests.
 *
 * The real client returns `this` from every filter/modifier and resolves at the
 * end of the chain (or when awaited). This stub mirrors that: each method
 * records its argument and returns the builder, and the builder is thenable so a
 * chain ending in `.order()` (or awaited directly) resolves to the configured
 * `{ data, error }`. Terminal `.single()` / `.maybeSingle()` resolve the same.
 *
 * These are TEST DOUBLES, not a database. They exist to prove handler behaviour
 * that has no test today — e.g. that a client-supplied `author_id` never reaches
 * the row we insert. The real isolation guarantees are proven against a live
 * Postgres in rls.test.ts.
 */
export function queryBuilder(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const captured: { insert?: unknown; update?: unknown; eq?: unknown[] } = { eq: [] }
  const resolved = { data: result.data ?? null, error: result.error ?? null }
  const b: Record<string, unknown> = {}
  const ret = () => b
  Object.assign(b, {
    select: vi.fn(ret),
    order: vi.fn(() => Promise.resolve(resolved)),
    eq: vi.fn((_col: string, val: unknown) => {
      captured.eq!.push(val)
      return b
    }),
    insert: vi.fn((v: unknown) => {
      captured.insert = v
      return b
    }),
    update: vi.fn((v: unknown) => {
      captured.update = v
      return b
    }),
    delete: vi.fn(ret),
    single: vi.fn(() => Promise.resolve(resolved)),
    maybeSingle: vi.fn(() => Promise.resolve(resolved)),
    then: (onFulfilled: (v: typeof resolved) => unknown) => Promise.resolve(resolved).then(onFulfilled),
    captured,
  })
  return b as typeof b & { captured: typeof captured }
}

/**
 * A fake Supabase client. `user` is what `auth.getUser()` resolves to (null =
 * signed out). `builder` is returned from `.from()`, so the caller inspects
 * `builder.captured` afterwards. `getUser`/`getSession`/`signOut`/
 * `exchangeCodeForSession` are spies so a test can assert which was called —
 * the getUser-vs-getSession footgun turns on exactly that.
 */
export function supabaseStub(opts: {
  user?: { id: string } | null
  builder?: ReturnType<typeof queryBuilder>
  exchangeError?: unknown
} = {}) {
  const builder = opts.builder ?? queryBuilder()
  const getUser = vi.fn(async () => ({ data: { user: opts.user ?? null }, error: null }))
  const getSession = vi.fn(async () => ({ data: { session: null }, error: null }))
  const signOut = vi.fn(async () => ({ error: null }))
  const exchangeCodeForSession = vi.fn(async () => ({ error: opts.exchangeError ?? null }))
  const client = {
    auth: { getUser, getSession, signOut, exchangeCodeForSession },
    from: vi.fn(() => builder),
  }
  return { client, builder, getUser, getSession, signOut, exchangeCodeForSession }
}

/**
 * RLS ISOLATION TEST — proves Row-Level Security keeps users apart: user A can
 * NEVER read or write user B's notes.
 *
 * HOW TO RUN:
 *   1. `supabase start` (local Supabase on 127.0.0.1).
 *   2. `.env.test` with SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
 *      pointing at LOCAL (gitignored).
 *   3. `npm run test:rls`
 *
 * Without `.env.test` — OR when it's set but Supabase isn't actually running —
 * the tests are SKIPPED (not failed), so `npm test` on a fresh clone stays green
 * and the unit suite still runs. The local DB is disposable: `supabase db reset`
 * wipes it. See docs/testing.md.
 *
 * CI: set `RLS_TESTS_REQUIRED=1` to turn a silent skip into a hard failure — the
 * proof must actually run there. Locally the var is unset, so the clean-skip
 * behavior above is preserved.
 *
 * SAFETY: only runs against 127.0.0.1/localhost; a non-local URL ABORTS.
 * A failing test means A read or wrote B's data — a REAL security hole. Do NOT
 * "fix" the test; fix the policy.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: resolve(process.cwd(), '.env.test') })

const URL = process.env.SUPABASE_URL || ''
const ANON = process.env.SUPABASE_ANON_KEY || ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const IS_LOCAL = /127\.0\.0\.1|localhost/.test(URL)
if (URL && !IS_LOCAL) {
  throw new Error(`[rls.test] ABORTED: SUPABASE_URL is not local (${URL}). RLS tests only run against 127.0.0.1.`)
}
const CONFIGURED = !!URL && !!ANON && !!SERVICE && IS_LOCAL

/**
 * Is a local Supabase actually LISTENING? `.env.test` being present makes the
 * suite CONFIGURED, but the DB may still be down (`supabase start` not run).
 * Probe the REST endpoint so we SKIP cleanly instead of crashing beforeAll with
 * ECONNREFUSED — a stopped Supabase is "not configured", not a test failure.
 * Any HTTP answer (even 401/404) proves something is listening.
 */
async function supabaseReachable(): Promise<boolean> {
  if (!CONFIGURED) return false
  try {
    const res = await fetch(`${URL.replace(/\/$/, '')}/rest/v1/`, {
      headers: { apikey: ANON },
      signal: AbortSignal.timeout(2000),
    })
    return res.status > 0
  } catch {
    return false
  }
}

// Decided once, before the suite is defined, so `describe.skipIf` can skip the
// whole thing without ever touching a dead socket. (Top-level await runs under
// Vitest's ESM loader.)
const ENABLED = await supabaseReachable()

// CI guard: when RLS_TESTS_REQUIRED=1 the isolation proof MUST run. If it would
// be skipped (no local Supabase reachable), fail loudly instead of passing green
// on a false "safe". Local runs leave this unset and keep the clean-skip.
if (process.env.RLS_TESTS_REQUIRED === '1' && !ENABLED) {
  throw new Error(
    '[rls.test] RLS_TESTS_REQUIRED=1 but no local Supabase is reachable — the ' +
      'isolation proof would be skipped. Run `supabase start` and set .env.test ' +
      '(SUPABASE_URL/ANON/SERVICE pointing at 127.0.0.1).'
  )
}

const service: SupabaseClient = ENABLED
  ? createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  : (null as unknown as SupabaseClient)

// Unique suffix per run → repeatable (running twice in a row won't collide).
const RUN = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

interface World {
  email: string
  password: string
  userId: string
  noteId: string
}

let A: World
let B: World
let clientA: SupabaseClient

// Builds an isolated world (1 user + 1 note) via service_role, which bypasses RLS.
async function createWorld(tag: string): Promise<World> {
  const email = `rls-${tag}-${RUN}@local.test`
  const password = `Pw-${RUN}-${tag}!aZ9`

  const { data: u, error: ue } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (ue || !u?.user) throw new Error(`createUser(${tag}): ${ue?.message}`)
  const userId = u.user.id

  const { data: note, error: ne } = await service
    .from('notes')
    .insert({ author_id: userId, title: `Note ${tag} ${RUN}`, body: 'secret' })
    .select('id')
    .single()
  if (ne || !note) throw new Error(`note(${tag}): ${ne?.message}`)

  return { email, password, userId, noteId: note.id as string }
}

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`login(${email}): ${error.message}`)
  return c
}

describe.skipIf(!ENABLED)('RLS — user isolation (local Supabase)', () => {
  beforeAll(async () => {
    A = await createWorld('a')
    B = await createWorld('b')
    clientA = await signIn(A.email, A.password) // signed in as A → RLS ACTIVE
  }, 60_000)

  afterAll(async () => {
    for (const w of [A, B]) {
      if (!w) continue
      await service.from('notes').delete().eq('author_id', w.userId)
      await service.auth.admin.deleteUser(w.userId)
    }
  }, 60_000)

  it('cross-user read blocked (A cannot see B\'s note)', async () => {
    const { data, error } = await clientA.from('notes').select('id').eq('id', B.noteId)
    expect(error, 'notes: unexpected error on cross-read').toBeNull()
    expect(data ?? [], "RLS HOLE: A READ B's note").toHaveLength(0)
  })

  it('own read works (A sees A\'s note)', async () => {
    const { data } = await clientA.from('notes').select('id').eq('id', A.noteId)
    expect(data ?? [], 'RLS blocked A from reading its OWN note (false positive)').toHaveLength(1)
  })

  it('cross-user write blocked (update + delete, verified via service_role)', async () => {
    const { data: upd } = await clientA.from('notes').update({ title: 'HACKED' }).eq('id', B.noteId).select('id')
    expect(upd ?? [], "RLS HOLE: A UPDATED B's note").toHaveLength(0)

    const { data: del } = await clientA.from('notes').delete().eq('id', B.noteId).select('id')
    expect(del ?? [], "RLS HOLE: A DELETED B's note").toHaveLength(0)

    // Final proof: B's note is still intact as seen by the service_role.
    const { data: check } = await service.from('notes').select('title').eq('id', B.noteId)
    expect(check ?? [], "RLS HOLE: B's note vanished after A's write").toHaveLength(1)
    expect(check?.[0]?.title, "RLS HOLE: B's note was altered by A").not.toBe('HACKED')
  })

  it('cross-user insert blocked (A cannot create a note owned by B)', async () => {
    const marker = `INTRUDER-${RUN}`
    const { data, error } = await clientA
      .from('notes')
      .insert({ author_id: B.userId, title: marker, body: 'x' })
      .select('id')
    // RLS must block via WITH CHECK: either an error or zero rows returned.
    expect(!error && (data ?? []).length > 0, "RLS HOLE: A INSERTED a note owned by B").toBe(false)

    const { data: check } = await service.from('notes').select('id').eq('title', marker)
    expect(check ?? [], "RLS HOLE: A's intruder note persisted in the database").toHaveLength(0)
  })

  it('anon (logged out) cannot read notes', async () => {
    const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
    // A's and B's notes exist (seeded via service_role), so an empty result proves
    // RLS blocks the anonymous role — not that the table is simply empty.
    const { data } = await anon.from('notes').select('*').limit(1)
    expect(data ?? [], 'RLS HOLE: anon (logged out) READ notes').toHaveLength(0)
  })
})

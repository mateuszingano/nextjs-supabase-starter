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
import { Client } from 'pg'
import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: resolve(process.cwd(), '.env.test') })

const URL = process.env.SUPABASE_URL || ''
const ANON = process.env.SUPABASE_ANON_KEY || ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
// Direct Postgres connection — needed only by the "write policies stand on
// their own" block below, which has to run DDL (PostgREST cannot).
const DB_URL = process.env.SUPABASE_DB_URL || ''

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

/**
 * Is the reachable Supabase actually THIS PROJECT'S database?
 *
 * The Supabase CLI serves every project on the same default ports (54321/54322),
 * so "something answered on 127.0.0.1" does not mean it is ours. With another
 * project's stack up, this suite would run against ITS schema — creating and
 * deleting auth users there with the service_role key, and either failing with a
 * baffling "table not found" or, worse, proving the isolation of a database that
 * isn't the one we ship.
 *
 * A wrong database is a usage ERROR, not an absence: we throw instead of
 * skipping, because skipping is how "I never tested it" gets to look like "it
 * passed".
 */
/**
 * The table this suite proves isolation for. Rename it together with your own
 * entity when you replace the `notes` example — this is the fingerprint, not a
 * hidden dependency. (The starter tells you to copy the notes pattern for every
 * new table; if the fingerprint stayed hardcoded to `notes`, renaming it would
 * make this abort claim you are on the wrong database, which is a confidently
 * wrong diagnosis.)
 */
const FINGERPRINT_TABLE = 'notes'

async function assertOurDatabase(): Promise<void> {
  // Probe with the ANON key, never the service key.
  //
  // The whole premise here is "something answered on this port, but we have not
  // established that it is ours" — so handing that unidentified host a bearer
  // token that bypasses RLS contradicts the check itself. The anon key produces
  // an identical signal (the table is granted to anon), and if the host is not
  // ours we have leaked nothing.
  const res = await fetch(`${URL.replace(/\/$/, '')}/rest/v1/${FINGERPRINT_TABLE}?select=id&limit=0`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    signal: AbortSignal.timeout(2000),
  })
  if (res.ok) return
  throw new Error(
    `[rls.test] ABORTED: a Supabase is listening at ${URL}, but it has no "${FINGERPRINT_TABLE}" table ` +
      `(HTTP ${res.status}).\n` +
      `  · If another project's Supabase is up, this is its database, not ours — the CLI uses the same ` +
      `ports for every project. Run \`supabase stop\` there, then \`supabase start\` here.\n` +
      `  · If you renamed or removed the "${FINGERPRINT_TABLE}" table in your own copy of this starter, ` +
      `update FINGERPRINT_TABLE in this file to match.`
  )
}

// Decided once, before the suite is defined, so `describe.skipIf` can skip the
// whole thing without ever touching a dead socket. (Top-level await runs under
// Vitest's ESM loader.)
const ENABLED = await supabaseReachable()
if (ENABLED) await assertOurDatabase()

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

// Same discipline for the write-policy proof: it needs a direct DB connection,
// and a missing SUPABASE_DB_URL must not quietly downgrade the suite to the
// weaker guarantee. Locally it skips; in CI it fails loudly.
const DB_ENABLED = ENABLED && !!DB_URL
if (process.env.RLS_TESTS_REQUIRED === '1' && ENABLED && !DB_URL) {
  throw new Error(
    '[rls.test] RLS_TESTS_REQUIRED=1 but SUPABASE_DB_URL is unset — the ' +
      'write-policy proof would be skipped, leaving UPDATE/DELETE/INSERT ' +
      'policies untested. Add SUPABASE_DB_URL to .env.test ' +
      '(postgresql://postgres:postgres@127.0.0.1:54322/postgres).'
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

/**
 * WRITE POLICIES STAND ON THEIR OWN — the test the block above cannot be.
 *
 * PostgreSQL applies the SELECT policy when it locates rows for an UPDATE or a
 * DELETE. With an owner-scoped SELECT policy, a wide-open write policy is
 * therefore INVISIBLE: set `using (true)` on the DELETE policy and A's delete
 * still removes 0 rows, so every assertion above stays green. Verifying the
 * final state via service_role does not help — there is no effect to detect.
 *
 * That is safe for THIS schema, but the starter is a pattern to copy. The
 * moment a table reads wider than it writes — "the whole team reads it, only
 * the owner edits it", the normal shape once you have teams — the SELECT policy
 * stops shadowing the write policies, they become the only guard, and nothing
 * above would notice if one of them were `true`.
 *
 * So this block widens SELECT to `using (true)` for its duration and proves
 * each write policy blocks A on its own. The original expression is read from
 * the catalog and restored in `finally`, so a rename or an edit to the policy
 * survives this test.
 */
async function withWideOpenSelect<T>(fn: () => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: DB_URL })
  await db.connect()
  const { rows } = await db.query(
    `select polname, pg_get_expr(polqual, polrelid) as expr
       from pg_policy
      where polrelid = 'public.notes'::regclass and polcmd = 'r'`
  )
  if (rows.length !== 1) {
    await db.end()
    throw new Error(
      `[rls.test] expected exactly 1 SELECT policy on public.notes, found ${rows.length}. ` +
        `Adjust this fixture to match your schema.`
    )
  }
  const { polname, expr } = rows[0] as { polname: string; expr: string }
  const ident = `"${polname.replace(/"/g, '""')}"`
  try {
    await db.query(`alter policy ${ident} on public.notes using (true)`)
    return await fn()
  } finally {
    await db.query(`alter policy ${ident} on public.notes using (${expr})`)
    await db.end()
  }
}

describe.skipIf(!DB_ENABLED)('RLS — write policies stand on their own (SELECT widened)', () => {
  beforeAll(async () => {
    A = await createWorld('wa')
    B = await createWorld('wb')
    clientA = await signIn(A.email, A.password)
  }, 60_000)

  afterAll(async () => {
    for (const w of [A, B]) {
      if (!w) continue
      await service.from('notes').delete().eq('author_id', w.userId)
      await service.auth.admin.deleteUser(w.userId)
    }
  }, 60_000)

  it('A cannot update, delete or forge B\'s note even when it can SEE it', async () => {
    await withWideOpenSelect(async () => {
      // The fixture must actually be in effect. Without this, a silently failed
      // ALTER would make every assertion below pass for the wrong reason —
      // which is exactly the failure mode this whole block exists to prevent.
      const { data: seen } = await clientA.from('notes').select('id').eq('id', B.noteId)
      expect(seen ?? [], 'FIXTURE INERT: widening SELECT did not take effect').toHaveLength(1)

      await clientA.from('notes').update({ title: 'HACKED-WIDE' }).eq('id', B.noteId)
      const { data: upd } = await service.from('notes').select('title').eq('id', B.noteId)
      expect(upd?.[0]?.title, "RLS HOLE: A UPDATED B's note once SELECT stopped hiding it").not.toBe('HACKED-WIDE')

      await clientA.from('notes').delete().eq('id', B.noteId)
      const { data: del } = await service.from('notes').select('id').eq('id', B.noteId)
      expect(del ?? [], "RLS HOLE: A DELETED B's note once SELECT stopped hiding it").toHaveLength(1)

      const marker = `INTRUDER-WIDE-${RUN}`
      await clientA.from('notes').insert({ author_id: B.userId, title: marker, body: 'x' })
      const { data: ins } = await service.from('notes').select('id').eq('title', marker)
      expect(ins ?? [], 'RLS HOLE: A INSERTED a note owned by B').toHaveLength(0)
    })
  })
})

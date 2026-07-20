# Testing

This starter ships a small, layered test suite. Two layers, different needs:

| Layer | Command | Needs Supabase? | Runs in CI? |
|---|---|---|---|
| Unit (validation, pure logic) | `npm test` | No | Yes |
| RLS isolation (`src/lib/auth/rls.test.ts`) | `npm run test:rls` | **Yes** — local Supabase + `.env.test` | Yes — the `rls` CI job runs `supabase start` then `test:rls` (`RLS_TESTS_REQUIRED=1`) |

`npm test` runs the whole `vitest` suite. The RLS file is part of it, but it is
written to **skip itself** unless a local Supabase is configured (see below), so
`npm test` on a fresh clone — no Supabase, no `.env.test` — passes with the RLS
tests reported as skipped. That is by design, not a failure.

## Unit tests

```bash
npm test            # run once
npm run test:watch  # watch mode
npm run test:coverage
```

No database, no env setup. These cover pure logic like the Zod validation
schema (`src/lib/validation/notes.test.ts`).

## The RLS isolation test

`src/lib/auth/rls.test.ts` is the security proof: it spins up two real users
against a **local** Supabase and asserts user A can never read, update, delete,
or forge user B's notes (and that a logged-out visitor reads nothing). A failure
here means a real RLS hole — fix the policy, never the test.

A second block, **"write policies stand on their own"**, exists because Postgres
applies the SELECT policy when locating rows for an UPDATE/DELETE — so an
owner-scoped SELECT policy hides whether the write policies are actually doing
anything. This block widens SELECT to `using (true)` for its duration (via a
direct `pg` connection — `SUPABASE_DB_URL` — since that needs DDL) and proves
each write policy blocks A on its own, then restores the original policy. It is
what keeps the "fails loudly if a policy ever leaks" promise true once you copy
the pattern to a table that reads wider than it writes. It skips (locally) or
fails loudly (CI) if `SUPABASE_DB_URL` is unset.

Because it needs a live database, it only runs when you set it up:

1. Start local Supabase (Docker required):

   ```bash
   supabase start
   ```

   It prints an API URL, an anon key, and a service_role key.

2. Create a **gitignored** `.env.test` at the project root pointing at LOCAL:

   ```
   SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_ANON_KEY=<anon key from `supabase start`>
   SUPABASE_SERVICE_ROLE_KEY=<service_role key from `supabase start`>
   SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
   ```

   `.env.test` is in `.gitignore` — never commit it. The keys `supabase start`
   prints locally are the well-known demo keys, but keep the habit anyway.

3. Run it:

   ```bash
   npm run test:rls
   ```

### When it skips (on purpose)

The RLS test **skips cleanly** — it does not fail — when it simply cannot run:

- No `.env.test`, or it's missing `SUPABASE_URL` / `SUPABASE_ANON_KEY` /
  `SUPABASE_SERVICE_ROLE_KEY`.
- `.env.test` looks right but Supabase isn't actually running (nothing listening
  on the API port). The suite probes the connection first and skips with a note
  rather than crashing with `ECONNREFUSED`.

### When it aborts (also on purpose)

In these cases the suite **fails loudly** instead, because carrying on would
either be dangerous or would prove nothing:

- **The URL is not local** (`127.0.0.1` / `localhost`). These tests create and
  delete users, so they must never touch a shared or production database.
- **A Supabase is listening, but it is not THIS project's database.** The
  Supabase CLI serves every project on the same ports, so another project's
  stack answering on 54321 would otherwise have this suite prove the isolation
  of a database we do not ship — or fail with a baffling "table not found". The
  check looks for the `notes` table (see `FINGERPRINT_TABLE` in
  `src/lib/auth/rls.test.ts`); **if you rename that table in your own copy,
  update the constant to match.**
- **`RLS_TESTS_REQUIRED=1` is set and the suite would skip.** CI sets this so a
  missing database can never be mistaken for a passing isolation proof.

So `npm test` on a fresh clone is green (the RLS suite reports as *skipped*),
but it will go red if a wrong or unreachable database would have made the proof
meaningless.

To reset the local database between runs:

```bash
supabase db reset   # re-applies migrations + seed; wipes local data
```

## What CI runs

CI (`.github/workflows/ci.yml`) has two jobs. The `test` job runs `typecheck`,
`lint`, and `test` on a fresh checkout with no Supabase, so the RLS test skips
there. The separate `rls` job spins up local Supabase (`supabase start`, which
applies migrations + seed), writes a `.env.test` pointed at `127.0.0.1`, and runs
`npm run test:rls` with `RLS_TESTS_REQUIRED=1` so the job fails if the isolation
proof is skipped rather than run.

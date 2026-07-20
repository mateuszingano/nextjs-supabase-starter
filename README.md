# Next.js + Supabase Starter

A minimal, **secure-by-default** starter on **Next.js (App Router) + TypeScript +
Supabase**. Email/password auth, one example resource (notes) with Row-Level
Security, and a test that *proves* one user can't read another's data.

It's small on purpose: clone it, run it, understand every file. When you need the
full multi-tenant machinery, there's a paid upgrade (see the bottom).

## What's inside

- **Auth** — sign up, log in, log out, password reset (Supabase Auth + `@supabase/ssr`).
- **One table with RLS** — `notes`, scoped to its owner (`author_id = auth.uid()`),
  all four verbs policed. The reference pattern to copy for your own tables.
- **An RLS proof** — `npm run test:rls` spins up two users and asserts user A can
  never read, edit, delete, or forge user B's notes. Proof, not vibes.
- **Typed** — generated Supabase types, Zod-validated API boundary.

## Quick start

```bash
npm install
supabase start                 # local Supabase on 127.0.0.1
cp .env.example .env            # fill with the URL + anon key `supabase start` printed
npm run dev                     # http://localhost:3000
```

Demo login (seeded locally): `demo@example.com` / `password123`.

### Run the RLS test

```bash
# .env.test with SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY (local)
npm run test:rls
```

Pair it with [`supabase-saas-kit`](https://www.npmjs.com/package/supabase-saas-kit)
(`npx supabase-saas-kit new my-app`), a small CLI that scaffolds this starter,
checks your env + RLS, and generates RLS-safe migrations.

## The security idea

The #1 Supabase footgun is shipping a table with RLS off, or a policy that's
secretly permissive. This starter makes the safe path the default: every table
comes with RLS on and an owner-scoped policy, and the test fails loudly if a
policy ever leaks. Want that enforced in CI on every deploy? See
[Airlock](https://github.com/mateuszingano/airlock-rls).

## Outgrowing it? — the full boilerplate

This starter is **single-user**. Real SaaS needs more, and that's the paid
[SaaS Boilerplate](https://shipsealed.com/#paid):

| Free starter (this repo) | Paid boilerplate |
|---|---|
| Single-user notes + RLS | **Multi-tenant workspaces** (teams, invites, roles) |
| One RLS test | **Full RLS isolation suite** + meta-test + E2E + CI |
| Auth basics | Password flows, settings, polished app shell, docs |
| — | **Pro:** billing (Paddle), admin panel, web push |

The moment you need teams, you've outgrown the starter. That's the upgrade.

## License

MIT — use it for anything.

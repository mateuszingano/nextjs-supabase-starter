# Security Policy

## Reporting a vulnerability

If you find a security issue in this starter, please report it privately:

- Open a **private** GitHub security advisory (Security → Advisories → Report a vulnerability), or
- Email the maintainer.

Please do **not** open a public issue for security problems. We aim to acknowledge reports
within a few business days.

When testing, only use accounts and data you own. Do not run denial-of-service tests, and do
not access, modify, or destroy data that isn't yours.

## What's in scope

The starter's own code: authentication flow, Row-Level Security policies, API route
authorization, and the security headers. Issues in your own features built on top of the
starter are your responsibility.

## Security model (what the starter gives you)

- **Row-Level Security on every table.** Access is enforced by the database, not by
  application `where` clauses. The `notes` table is scoped to its owner
  (`author_id = auth.uid()`), and an isolation test (`rls.test.ts`) proves one user cannot
  read or write another's data.
- **Server-resolved ownership.** API routes never trust an `author_id` from the request body;
  they set it from the authenticated session, then RLS double-checks with `WITH CHECK`. This
  blocks IDOR-style attacks.
- **Input limits enforced at the database, not just in Zod.** Because `authenticated` holds a
  direct grant on `notes` (so RLS is what scopes rows), a user could talk to PostgREST with
  their own JWT and skip the API's Zod validation. `CHECK` constraints on `title`/`body` length
  keep the limits true regardless of which client wrote the row.
- **SSR sessions** validated with `getUser()` (not just a decoded cookie), refreshed in
  `src/proxy.ts` and re-checked in Server Components.
- **Functions** pin `search_path` (e.g. `set_updated_at` sets `search_path = ''`) to prevent search-path privilege escalation.
- **Security headers** (CSP, HSTS, `X-Frame-Options`, `nosniff`, Referrer/Permissions policies)
  applied to every response in `next.config.ts`.
- **Secrets** stay in gitignored `.env.*` files; the `service_role` key is server-only.

## Your responsibilities in production

- Keep the `service_role` key server-side only; never expose it to the browser.
- Enable email confirmation and configure your auth redirect URLs in the Supabase dashboard.
- For higher-assurance apps, require re-authentication (`supabase.auth.reauthenticate()`) before
  a password change, and revoke other sessions when the password changes.
- Review and tighten the Content-Security-Policy for your specific third-party integrations.
- Keep dependencies patched.
- **Add rate limiting before you expose write endpoints.** This starter ships
  **none** at the application layer. Supabase's own `[auth.rate_limit]` covers the
  auth endpoints (sign-in, sign-up, password reset) — it does **not** cover your
  API routes. An authenticated user can call `POST /api/notes` in a loop until
  your Supabase quota or disk runs out, and nothing here stops them. Add a
  limiter (Upstash, Vercel Firewall, or `airlock-ratelimit`) on your mutating
  routes.
- **CSRF protection here is inherited, not explicit.** There is no `Origin` /
  `Referer` check on POSTs; what protects you is the `SameSite=Lax` default on
  the Supabase auth cookie. That is a legitimate defense, but if you customize
  `cookieOptions` to `sameSite: 'none'` (common when embedding in an iframe), the
  protection is gone and nothing here will warn you.
- **The auth cookie is readable by JavaScript, so XSS means session takeover.**
  `@supabase/ssr` sets the session cookie with `httpOnly: false` — its browser
  client has to read it. That changes the price of the CSP trade-off documented
  in `next.config.ts`: with `script-src 'unsafe-inline'` still in place, an
  injected script does not merely *run*, it can read `document.cookie` and walk
  away with the whole session. Treat output escaping as the real defense, keep
  untrusted data out of HTML, and tighten the CSP (nonces) before shipping
  anything that renders user-supplied content.
- **The edge auth check skips paths ending in a static-asset extension.** The
  full list is the `STATIC_ASSET` regex in `src/lib/supabase/proxy.ts` — around
  twenty extensions, including `.js`, `.css`, `.map`, `.txt`, `.xml`, `.svg`,
  `.woff2` and `.webmanifest`, matched case-insensitively. Every page and route
  handler re-checks the session server-side, so this is defense in depth rather
  than the gate itself — but if you add a protected route whose path can end in
  one of those (e.g. `/api/export/[name]`), do not rely on the edge check for it.

## Known gaps — declared, not silently missed

Everything below is a real limitation of this starter that we know about. It is
written here so you find it before an attacker does, rather than after.

- **The login redirect is built from the request's `Host` header.**
  `new URL('/login', request.url)` follows Supabase's own pattern, and platforms
  like Vercel validate the Host for you — but on a self-hosted deployment that
  does not, a forged `Host` can make the `Location` point elsewhere. The *path*
  is not attacker-controllable (verified against `?next=`, `#@evil.com` and CRLF
  injection); only the host is. Validate `Host` at your edge, or pin the origin.
- **No application-layer rate limiting.** See "Your responsibilities in
  production" above — this is the same gap, repeated here so this list is
  complete.
- **`FORCE ROW LEVEL SECURITY` is not enabled.** This matches Supabase's own
  default and has no impact as shipped (the one `SECURITY DEFINER` function is
  a trigger with a pinned `search_path`). It matters the moment you write a
  `SECURITY DEFINER` function of your own, or run a job as the table owner:
  those bypass RLS unless you enable `FORCE`.
- **The demo password in the README (`password123`) would not pass the signup
  policy.** `supabase/config.toml` now requires 8 characters plus mixed case and
  digits. The seeded demo account still logs in because the seed writes the
  bcrypt hash straight into `auth.users`, bypassing GoTrue — but if you try to
  *register* that password, you will get an error from Supabase. Pick a
  conforming password for new accounts.
- **The signup and reset forms only declare `minLength={8}`.** They do not
  surface the mixed-case/digit requirement, so a rejected password shows
  Supabase's raw message rather than a friendly hint. Cosmetic, but it is the
  first thing a new user hits.

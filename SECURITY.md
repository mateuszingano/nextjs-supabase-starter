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
- **SSR sessions** validated with `getUser()` (not just a decoded cookie), refreshed in
  `src/proxy.ts` and re-checked in Server Components.
- **`SECURITY DEFINER` helpers** pin `search_path` to prevent search-path privilege escalation.
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

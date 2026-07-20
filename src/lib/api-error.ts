import { NextResponse } from 'next/server'

/**
 * Turn a database error into a response the client may see.
 *
 * The detail stays on the server. A Postgres error message names constraints,
 * columns and sometimes values — handing that to any authenticated caller is
 * free reconnaissance of the schema, and in a starter the pattern gets copied
 * into routes far more sensitive than this one.
 */
export function serverError(scope: string, error: unknown) {
  console.error(`[${scope}]`, error)
  return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
}

/**
 * Largest JSON body we will parse. The Zod schemas already cap `title` (200) and
 * `body` (10 000), but they run AFTER `request.json()` has materialised the whole
 * payload in memory — so a 500 MB POST was parsed in full and only then
 * rejected. Refuse it before that, by the declared Content-Length.
 */
export const MAX_BODY_BYTES = 64 * 1024

/** 413 when the declared body is too large, otherwise null. */
export function bodyTooLarge(request: Request) {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (!Number.isFinite(declared) || declared <= MAX_BODY_BYTES) return null
  return NextResponse.json({ error: 'Request body too large.' }, { status: 413 })
}

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
 * `body` (10 000), but they run AFTER the payload has been materialised in
 * memory — so an oversized POST would be read in full and only then rejected.
 */
export const MAX_BODY_BYTES = 64 * 1024

function tooLarge() {
  return NextResponse.json({ error: 'Request body too large.' }, { status: 413 })
}

type ReadResult =
  | { ok: true; value: unknown }
  | { ok: false; response: NextResponse }

/**
 * Read and JSON-parse a request body, refusing anything over MAX_BODY_BYTES.
 *
 * Why not just check Content-Length: that header is client-supplied and
 * optional. A `Transfer-Encoding: chunked` request carries no Content-Length,
 * so a size check that trusts the header alone waves through a body of any
 * size (proven: 4 MB chunked slipped past a 64 KB cap). We keep the header as a
 * cheap fast-path — reject before reading a byte when it is present and already
 * too big — but the real guard COUNTS bytes as it drains the stream and aborts
 * the moment the running total crosses the cap. A malformed/empty body resolves
 * to `null`, matching the old `request.json().catch(() => null)`, so the caller's
 * Zod schema still produces the 400.
 */
export async function readJsonWithinLimit(request: Request): Promise<ReadResult> {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { ok: false, response: tooLarge() }
  }

  const reader = request.body?.getReader()
  if (!reader) return { ok: true, value: null }

  const chunks: Uint8Array[] = []
  let received = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > MAX_BODY_BYTES) {
        await reader.cancel()
        return { ok: false, response: tooLarge() }
      }
      chunks.push(value)
    }
  } catch {
    // Stream aborted or errored mid-read — treat as no usable body.
    return { ok: true, value: null }
  }

  if (received === 0) return { ok: true, value: null }
  const text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8')
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: true, value: null }
  }
}

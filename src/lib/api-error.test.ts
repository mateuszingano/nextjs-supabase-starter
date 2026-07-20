import { describe, it, expect } from 'vitest'
import { readJsonWithinLimit, MAX_BODY_BYTES, serverError } from './api-error'

// A helper that builds a POST Request whose body is a *streamed* payload with no
// Content-Length header — the shape a `Transfer-Encoding: chunked` client sends.
function chunkedRequest(totalBytes: number): Request {
  const chunk = new Uint8Array(16 * 1024).fill(0x61) // 'a'
  let sent = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= totalBytes) return controller.close()
      const remaining = totalBytes - sent
      const piece = remaining < chunk.byteLength ? chunk.subarray(0, remaining) : chunk
      controller.enqueue(piece)
      sent += piece.byteLength
    },
  })
  // duplex:'half' is required by undici to send a stream body.
  return new Request('https://app.test/api/notes', {
    method: 'POST',
    body: stream,
    // @ts-expect-error — duplex is valid at runtime but missing from the DOM lib types.
    duplex: 'half',
  })
}

function jsonRequest(value: unknown): Request {
  return new Request('https://app.test/api/notes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  })
}

describe('readJsonWithinLimit', () => {
  it('parses a normal JSON body', async () => {
    const res = await readJsonWithinLimit(jsonRequest({ title: 'ok' }))
    expect(res).toEqual({ ok: true, value: { title: 'ok' } })
  })

  it('rejects early when Content-Length declares an oversized body', async () => {
    const req = new Request('https://app.test/api/notes', {
      method: 'POST',
      headers: { 'content-length': String(MAX_BODY_BYTES + 1) },
      body: 'x',
    })
    const res = await readJsonWithinLimit(req)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(413)
  })

  // Regression: the old bodyTooLarge() trusted Content-Length alone, so a chunked
  // request (no Content-Length) of ANY size slipped through — 4 MB was accepted
  // against a 64 KB cap. The stream-counting guard must catch it.
  it('rejects an oversized CHUNKED body that carries no Content-Length', async () => {
    const req = chunkedRequest(4 * 1024 * 1024) // 4 MB, 64x the cap
    expect(req.headers.get('content-length'), 'precondition: no content-length').toBeNull()
    const res = await readJsonWithinLimit(req)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(413)
  })

  it('accepts a chunked body that stays under the cap', async () => {
    // 1 KB of 'a' is not valid JSON → resolves to null, exactly like the old
    // catch(() => null) path, and the caller's Zod schema produces the 400.
    const res = await readJsonWithinLimit(chunkedRequest(1024))
    expect(res).toEqual({ ok: true, value: null })
  })

  it('treats a malformed or empty body as null (caller validates)', async () => {
    const bad = new Request('https://app.test/api/notes', { method: 'POST', body: 'not json' })
    expect(await readJsonWithinLimit(bad)).toEqual({ ok: true, value: null })
    const empty = new Request('https://app.test/api/notes', { method: 'POST' })
    expect(await readJsonWithinLimit(empty)).toEqual({ ok: true, value: null })
  })
})

// A Postgres error message names constraints, columns and sometimes values.
// Handing that to any authenticated caller is free schema reconnaissance — and
// in a starter the pattern gets copied into far more sensitive routes.
describe('serverError', () => {
  it('never returns the underlying database message to the client', async () => {
    const res = serverError('test', new Error('duplicate key value violates unique constraint "notes_pkey"'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('notes_pkey')
    expect(JSON.stringify(body)).not.toContain('constraint')
  })
})

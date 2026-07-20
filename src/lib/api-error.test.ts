import { describe, it, expect } from 'vitest'
import { bodyTooLarge, MAX_BODY_BYTES, serverError } from './api-error'

// Zod caps title/body, but only AFTER request.json() has materialised the whole
// payload — so an oversized POST was parsed in full and only then rejected.
describe('bodyTooLarge', () => {
  const req = (len?: string) =>
    new Request('https://app.test/api/notes', {
      method: 'POST',
      headers: len === undefined ? {} : { 'content-length': len },
    })

  it('refuses a body larger than the cap, before parsing', () => {
    const res = bodyTooLarge(req(String(MAX_BODY_BYTES + 1)))
    expect(res?.status).toBe(413)
  })

  it('lets normal and missing-length requests through', () => {
    expect(bodyTooLarge(req('512'))).toBeNull()
    expect(bodyTooLarge(req(String(MAX_BODY_BYTES)))).toBeNull()
    expect(bodyTooLarge(req())).toBeNull()
    expect(bodyTooLarge(req('not-a-number'))).toBeNull()
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

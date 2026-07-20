import { describe, it, expect } from 'vitest'
import { noteInputSchema, notePatchSchema } from './notes'

describe('noteInputSchema', () => {
  it('accepts a valid note', () => {
    const result = noteInputSchema.safeParse({ title: 'Hello', body: 'World' })
    expect(result.success).toBe(true)
  })

  it('rejects a blank title', () => {
    const result = noteInputSchema.safeParse({ title: '   ', body: '' })
    expect(result.success).toBe(false)
  })

  it('defaults body to an empty string', () => {
    const result = noteInputSchema.parse({ title: 'Only a title' })
    expect(result.body).toBe('')
  })

  it('rejects a title over 200 chars', () => {
    const result = noteInputSchema.safeParse({ title: 'a'.repeat(201), body: '' })
    expect(result.success).toBe(false)
  })
})

describe('notePatchSchema', () => {
  // Regression: `.partial()` does not strip `.default()`. Sharing the create
  // schema here made Zod invent `body: ''`, so a PATCH that only sent a title
  // silently wiped the body column of an existing note.
  it('does not invent a body when the patch omits it', () => {
    const result = notePatchSchema.parse({ title: 'Only a title' })
    expect(result).not.toHaveProperty('body')
  })

  // Regression: with the fabricated default, the parsed object was never empty,
  // so this refine was unreachable and `PATCH {}` answered 200.
  it('rejects an empty patch', () => {
    const result = notePatchSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('accepts a body-only patch', () => {
    const result = notePatchSchema.safeParse({ body: 'new body' })
    expect(result.success).toBe(true)
  })

  it('still enforces the field rules it does receive', () => {
    expect(notePatchSchema.safeParse({ title: '   ' }).success).toBe(false)
    expect(notePatchSchema.safeParse({ title: 'a'.repeat(201) }).success).toBe(false)
    expect(notePatchSchema.safeParse({ body: 'a'.repeat(10_001) }).success).toBe(false)
  })
})

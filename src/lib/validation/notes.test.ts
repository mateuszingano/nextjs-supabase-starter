import { describe, it, expect } from 'vitest'
import { noteInputSchema } from './notes'

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

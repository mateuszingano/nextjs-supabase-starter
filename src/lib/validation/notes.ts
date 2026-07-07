import { z } from 'zod'

// Validation for note create/update payloads. Same schema on the API boundary
// and (optionally) the client form — one source of truth.
export const noteInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  body: z.string().max(10_000).default(''),
})

export type NoteInput = z.infer<typeof noteInputSchema>

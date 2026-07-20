import { z } from 'zod'

// The field rules, shared by create and update — one source of truth. Note that
// `body` carries NO default here; the create schema adds it below.
const noteFields = {
  title: z.string().trim().min(1, 'Title is required').max(200),
  body: z.string().max(10_000),
}

// Create (POST): `body` is optional and starts empty — a note can be title-only.
export const noteInputSchema = z.object({
  ...noteFields,
  body: noteFields.body.default(''),
})

// Update (PATCH): every field optional, at least one required — and crucially
// WITHOUT the `.default('')`.
//
// `.partial()` does NOT strip a `.default()`. Reusing the create schema here
// would make Zod *fabricate* `body: ''` for a PATCH that never mentioned it,
// so `{ "title": "new" }` would silently wipe the body column. It also made the
// refine below unreachable dead code: the parsed object was never empty, so
// `PATCH {}` returned 200 instead of 400.
export const notePatchSchema = z
  .object(noteFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'No fields to update')

export type NoteInput = z.infer<typeof noteInputSchema>

import { NextResponse } from 'next/server'
import { serverError, readJsonWithinLimit } from '@/lib/api-error'
import { authenticate } from '@/lib/auth/api'
import { notePatchSchema } from '@/lib/validation/notes'

type Context = { params: Promise<{ id: string }> }

// PATCH /api/notes/:id — update a note. RLS ensures the user can only touch
// notes they own, so editing someone else's note affects 0 rows → 404.
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params
  const auth = await authenticate()
  if (!auth.ok) return auth.response
  const { supabase } = auth

  const body = await readJsonWithinLimit(request)
  if (!body.ok) return body.response
  const parsed = notePatchSchema.safeParse(body.value)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('notes')
    .update(parsed.data)
    .eq('id', id)
    .select('id, title, body, created_at, updated_at')
    .maybeSingle()

  if (error) return serverError('notes/[id] PATCH', error)
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ note: data })
}

// DELETE /api/notes/:id — RLS blocks deleting a note you don't own (0 rows).
export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params
  const auth = await authenticate()
  if (!auth.ok) return auth.response
  const { supabase } = auth

  const { data, error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) return serverError('notes/[id] DELETE', error)
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

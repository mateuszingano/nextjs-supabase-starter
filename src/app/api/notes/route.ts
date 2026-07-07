import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/auth/api'
import { noteInputSchema } from '@/lib/validation/notes'

// GET /api/notes — list the current user's notes (RLS scopes to the owner).
export async function GET() {
  const auth = await authenticate()
  if (!auth.ok) return auth.response
  const { supabase } = auth

  const { data, error } = await supabase
    .from('notes')
    .select('id, title, body, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notes: data })
}

// POST /api/notes — create a note owned by the current user.
export async function POST(request: Request) {
  const auth = await authenticate()
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const parsed = noteInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten() }, { status: 400 })
  }

  // author_id comes from the authenticated session, NEVER the request body
  // (trusting the body would be an IDOR). RLS double-guards it with WITH CHECK.
  const { data, error } = await supabase
    .from('notes')
    .insert({
      author_id: user.id,
      title: parsed.data.title,
      body: parsed.data.body,
    })
    .select('id, title, body, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ note: data }, { status: 201 })
}

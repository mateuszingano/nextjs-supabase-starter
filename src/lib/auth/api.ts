import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

type Authed = { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; user: User }
type Unauthed = { ok: false; response: NextResponse }

// Auth for Route Handlers. Returns the Supabase client + user, or a ready 401.
// Usage:
//   const auth = await authenticate()
//   if (!auth.ok) return auth.response
//   const { supabase, user } = auth   // user is guaranteed here
export async function authenticate(): Promise<Authed | Unauthed> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { ok: true, supabase, user }
}

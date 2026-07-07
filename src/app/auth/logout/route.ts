import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST-only so a prefetch or an <img> can't sign the user out (CSRF-safe).
// Trigger it from a small <form action="/auth/logout" method="post"> button.
export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
}

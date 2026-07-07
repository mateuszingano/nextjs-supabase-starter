import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Handles the redirect back from Supabase for email confirmation, magic links,
// OAuth, and password recovery. Exchanges the `code` for a session cookie.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next') ?? '/notes'
  // Only allow relative in-app paths. Blocks open-redirect payloads crafted into
  // the callback URL — e.g. `@evil.com`, `.evil.com`, or `//evil.com`, which
  // `${origin}${next}` would otherwise resolve to an attacker-controlled host.
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/notes'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Page/route guard: ensures a user is signed in.
// Returns the authenticated user and a ready-to-use Supabase client so the
// caller doesn't fetch them again. Redirects to /login when signed out.
export async function requireAccess() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return { user, supabase }
}

import { requireAccess } from '@/lib/auth/require-access'
import { NotesClient, type Note } from './notes-client'

// Server Component: loads the initial notes (RLS-scoped) and hands them to the
// interactive client. The page only needs auth — RLS scopes the query to the
// signed-in owner, so there's no per-row filtering to write here.
export default async function NotesPage() {
  const { supabase } = await requireAccess()

  const { data } = await supabase
    .from('notes')
    .select('id, title, body, created_at, updated_at')
    .order('updated_at', { ascending: false })

  return <NotesClient initialNotes={(data ?? []) as Note[]} />
}

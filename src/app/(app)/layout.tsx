import Link from 'next/link'
import { requireAccess } from '@/lib/auth/require-access'

// Authenticated app shell: header with nav and sign-out.
// requireAccess() runs on every page under this layout (redirects if signed out).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAccess()

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">Starter</span>
            <nav className="flex gap-4 text-sm text-neutral-500">
              <Link href="/notes" className="hover:text-neutral-900 dark:hover:text-neutral-100">Notes</Link>
              <Link href="/settings" className="hover:text-neutral-900 dark:hover:text-neutral-100">Settings</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-neutral-500 sm:inline">{user.email}</span>
            <form action="/auth/logout" method="post">
              <button className="rounded-md border border-neutral-300 px-2 py-1 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  )
}

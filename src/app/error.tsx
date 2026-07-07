'use client'

import { useEffect } from 'react'
import Link from 'next/link'

// Root error boundary. Catches unhandled errors in the app and shows a safe,
// generic message (never the raw error) with a way to recover.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Wire your error-tracking service here (e.g. Sentry.captureException(error)).
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-50 px-4 text-center dark:bg-neutral-950">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Something went wrong</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        An unexpected error occurred. Try again — if it keeps happening, let us know.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Go home
        </Link>
      </div>
    </main>
  )
}

import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-50 px-4 text-center dark:bg-neutral-950">
      <p className="font-mono text-sm text-neutral-500">404</p>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Page not found</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
      >
        Go home
      </Link>
    </main>
  )
}

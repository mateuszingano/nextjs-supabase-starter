import Link from 'next/link'
import { requireAccess } from '@/lib/auth/require-access'

export default async function SettingsPage() {
  const { user } = await requireAccess()

  const rows: [string, string][] = [
    ['Email', user.email ?? '—'],
    ['User ID', user.id],
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Settings</h1>
      <dl className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between px-4 py-3 text-sm">
            <dt className="text-neutral-500">{label}</dt>
            <dd className="font-medium text-neutral-900 dark:text-neutral-100">{value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <Link href="/update-password" className="text-sm font-medium text-primary hover:underline">
          Change password →
        </Link>
      </div>
    </div>
  )
}

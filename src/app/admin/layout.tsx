import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { hasRole, STAFF } from '@/domain/roles'
import { getSessionUser } from '@/lib/auth/session'
import { createSessionClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } }

/** Second gate for everything under /admin: signed in AND holding a staff role. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser(await createSessionClient())
  if (!user) redirect('/login')
  if (!hasRole(user, STAFF)) {
    return (
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '96px 24px' }}>
        <h1 style={{ color: 'var(--ink-cream)', margin: 0 }}>No access</h1>
        <p>Your account is signed in but has not been given access to the admin. Ask an admin to grant it.</p>
      </main>
    )
  }
  return <>{children}</>
}

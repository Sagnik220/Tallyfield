import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { Wordmark } from '@/components/site/chrome'
import { hasRole, STAFF } from '@/domain/roles'
import { getSessionUser } from '@/lib/auth/session'
import { createSessionClient } from '@/lib/supabase/server'
import { AdminNav } from './admin-nav'

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } }

function SignOut() {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className="tf-nav" style={{ background: 'none', border: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
        Sign out
      </button>
    </form>
  )
}

/** Second gate for everything under /admin: signed in AND holding a staff role. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const db = await createSessionClient()
  const user = await getSessionUser(db)
  if (!user) redirect('/login')
  if (!hasRole(user, STAFF)) {
    const { data } = await db.auth.getClaims()
    const email = typeof data?.claims?.email === 'string' ? data.claims.email : 'This account'
    return (
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '96px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <h1 className="tf-display" style={{ fontSize: 56 }}>
          No access yet
        </h1>
        <p className="tf-body">
          {email} is signed in but has not been given access to the admin. Ask an admin to grant it.
        </p>
        <SignOut />
      </main>
    )
  }
  return (
    <div className="tf-admin">
      <aside className="tf-side-nav">
        <Link href="/" aria-label="Tallyfield home" style={{ display: 'flex', alignItems: 'center', minHeight: 44, padding: '0 20px', textDecoration: 'none' }}>
          <Wordmark size={26} />
        </Link>
        <AdminNav />
        <div style={{ marginTop: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="tf-label">Signed in as {user.role}</div>
          <Link className="tf-nav" href="/" style={{ color: 'var(--gold-light)' }}>
            View site →
          </Link>
          <SignOut />
        </div>
      </aside>
      <main className="tf-admin-main">{children}</main>
    </div>
  )
}

import type { Metadata } from 'next'
import { connection } from 'next/server'

export const metadata: Metadata = { title: 'Sign in' }

// Placeholder. The sign-in form (Supabase Auth, invite-only) is built here in the UI phase.
export default async function LoginPage() {
  // Rendered per request so the page's scripts carry the nonce that src/proxy.ts puts in the Content-Security-Policy.
  await connection()
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '96px 24px' }}>
      <h1 style={{ color: 'var(--ink-cream)', margin: 0 }}>Sign in</h1>
      <p>Admin sign-in is not built yet.</p>
    </main>
  )
}

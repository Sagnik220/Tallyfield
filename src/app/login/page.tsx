import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { Ornaments, Wordmark } from '@/components/site/chrome'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: false } }

const ERRORS: Record<string, string> = {
  link: 'That sign-in link has expired or was already used. Request a new one.',
}

type Props = { searchParams: Promise<{ error?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  // Rendered per request so the page's scripts carry the nonce that src/proxy.ts puts in the Content-Security-Policy.
  await connection()
  const { error } = await searchParams
  return (
    <div className="tf-page" style={{ display: 'grid', placeItems: 'center', padding: '48px 24px' }}>
      <Ornaments />
      <main style={{ width: 'min(460px, 100%)', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <Link href="/" aria-label="Tallyfield home" style={{ textDecoration: 'none' }}>
          <Wordmark size={34} />
        </Link>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="tf-eyebrow">Admin</div>
          <h1 className="tf-display" style={{ fontSize: 'clamp(44px, 6vw, 68px)' }}>
            Sign in
          </h1>
          <p className="tf-note">Enter your email and we&apos;ll send you a link. Only accounts given access by an admin can open the admin area.</p>
        </div>
        <div className="tf-panel">
          <LoginForm error={error ? ERRORS[error] : undefined} />
        </div>
      </main>
    </div>
  )
}

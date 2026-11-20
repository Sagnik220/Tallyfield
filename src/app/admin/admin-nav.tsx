'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS: { href: string; label: string; sub?: boolean }[] = [
  { href: '/admin', label: 'Posts' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/analytics', label: 'Overview', sub: true },
  { href: '/admin/analytics/instagram', label: 'Instagram', sub: true },
  { href: '/admin/analytics/ads', label: 'Ads', sub: true },
  { href: '/admin/analytics/website', label: 'Website', sub: true },
  { href: '/admin/new', label: 'Write a post' },
  { href: '/admin/import', label: 'Import from Instagram' },
  { href: '/admin/sync', label: 'Sync with Instagram' },
  { href: '/admin/stories', label: 'Stories' },
]

export function AdminNav() {
  const path = usePathname()
  return (
    <nav aria-label="Admin" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {LINKS.map((l) => {
        // The "Analytics" heading is current for any analytics tab; each sub-item only for its own page.
        const current = l.sub ? path === l.href : path === l.href || (l.href === '/admin' && path.startsWith('/admin/posts')) || (l.href === '/admin/analytics' && path.startsWith('/admin/analytics/'))
        return (
          <Link key={`${l.href}-${l.label}`} className={l.sub ? 'tf-side tf-side-sub' : 'tf-side'} href={l.href} aria-current={current ? (l.sub ? 'page' : 'true') : undefined}>
            {l.sub ? '↳ ' : ''}
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}

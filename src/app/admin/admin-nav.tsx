'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/admin', label: 'Posts' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/new', label: 'Write a post' },
  { href: '/admin/import', label: 'Import from Instagram' },
  { href: '/admin/sync', label: 'Sync with Instagram' },
  { href: '/admin/stories', label: 'Stories' },
]

export function AdminNav() {
  const path = usePathname()
  return (
    <nav aria-label="Admin" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {LINKS.map((l) => (
        <Link key={l.href} className="tf-side" href={l.href} aria-current={path === l.href || (l.href === '/admin' && path.startsWith('/admin/posts')) ? 'page' : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  )
}

'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

export const TABS = [
  { href: '/admin/analytics', label: 'Overview' },
  { href: '/admin/analytics/instagram', label: 'Instagram' },
  { href: '/admin/analytics/ads', label: 'Ads' },
  { href: '/admin/analytics/website', label: 'Website' },
] as const
const RANGES = [7, 30, 90]

/** Sub-section tabs and the date range; the range carries across tabs. */
export function AnalyticsNav() {
  const path = usePathname()
  const params = useSearchParams()
  const range = Number(params.get('range')) || 30
  const q = (r: number) => (r === 30 ? '' : `?range=${r}`)
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="tf-eyebrow">Admin</div>
          <h1 className="tf-display">Analytics</h1>
        </div>
        <nav aria-label="Date range" style={{ display: 'flex', gap: 6 }}>
          {RANGES.map((r) => (
            <Link key={r} href={`${path}${q(r)}`} className="tf-chip" aria-pressed={r === range} aria-current={r === range ? 'true' : undefined} scroll={false}>
              Last {r} days
            </Link>
          ))}
        </nav>
      </div>
      <nav aria-label="Analytics sections" className="tf-analytics-tabs">
        {TABS.map((t) => (
          <Link key={t.href} href={`${t.href}${q(range)}`} aria-current={path === t.href ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}

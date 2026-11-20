import type { Metadata } from 'next'
import type { DailyRow } from '@/data/analytics.repo'
import { createSessionClient } from '@/lib/supabase/server'
import { DailyChart, type DayPoint } from '../daily-chart'
import { dayKey, loadSite, parseDays, rangeStart } from '../data'
import { fmt, pct, Ranked, SectionTitle, Tile, Tiles } from '../ui'

export const metadata: Metadata = { title: 'Website · Analytics' }

function group(rows: DailyRow[], key: (r: DailyRow) => string, limit = 8) {
  const m = new Map<string, number>()
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + r.views)
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
}

export default async function WebsiteAnalytics({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const days = parseDays((await searchParams).range)
  const from = rangeStart(days)
  const db = await createSessionClient()
  const { rows, posts } = await loadSite(db, days)

  const totalViews = rows.reduce((s, r) => s + r.views, 0)
  const totalVisitors = rows.reduce((s, r) => s + r.visitors, 0)
  const byDay = new Map<string, DayPoint>()
  for (let i = 0; i < days; i += 1) {
    const d = dayKey(new Date(from.getTime() + i * 86_400_000))
    byDay.set(d, { day: d, value: 0, extra: 0 })
  }
  for (const r of rows) {
    const p = byDay.get(r.day)
    if (p) {
      p.value += r.views
      p.extra = (p.extra ?? 0) + r.visitors
    }
  }
  const postById = new Map(posts.map((p) => [p.id, p]))
  const pageLabel = (r: DailyRow) => (r.post_id && postById.get(r.post_id)?.title) || (r.path === '/' ? 'Homepage' : r.path)
  const topPages = group(rows, pageLabel).map(([label, value]) => {
    const post = posts.find((p) => p.title === label)
    return { label, value, ...(post ? { href: `/admin/posts/${post.id}` } : {}) }
  })
  const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
  const countries = group(rows, (r) => r.country || '??').map(([c, value]) => ({ label: c === '??' ? 'Unknown' : (regionNames.of(c) ?? c), value }))
  const sources = group(rows, (r) => r.referrer_host || 'Direct or unknown').map(([label, value]) => ({ label, value }))
  const devices = group(rows, (r) => r.device, 3).map(([d, value]) => ({ label: d[0]!.toUpperCase() + d.slice(1), value }))
  const instagramVisits = rows.filter((r) => r.referrer_host === 'instagram.com').reduce((s, r) => s + r.views, 0)

  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <SectionTitle>Website · last {days} days</SectionTitle>
      <Tiles>
        <Tile label="Page views" value={fmt(totalViews)} />
        <Tile label="Visitors" value={fmt(totalVisitors)} note="Counted once per page per day" />
        <Tile label="Views per visitor" value={totalVisitors ? (totalViews / totalVisitors).toFixed(1) : '—'} />
        <Tile label="From Instagram" value={fmt(instagramVisits)} note={`${pct(instagramVisits, totalViews)} of views`} />
      </Tiles>
      <section className="tf-panel">
        <h2>Page views per day</h2>
        {totalViews === 0 ? (
          <p className="tf-note" style={{ fontSize: 13 }}>
            No visits recorded yet in this period.
          </p>
        ) : null}
        <DailyChart points={[...byDay.values()]} valueLabel="views" extraLabel="visitors" />
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <Ranked title="Top pages" rows={topPages} total={totalViews} empty="No page views yet." />
        <Ranked title="Where visitors come from" rows={sources} total={totalViews} empty="No visits yet." />
        <Ranked title="Countries" rows={countries} total={totalViews} empty="No visits yet." />
        <Ranked title="Devices" rows={devices} total={totalViews} empty="No visits yet." />
      </div>
      <p className="tf-note" style={{ fontSize: 12 }}>
        Privacy: the site sets no cookies and stores no IP addresses. Visitors who turn on “Do Not Track” or Global Privacy Control are not counted.
      </p>
    </section>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { serverEnv } from '@/config/env.server'
import { listDailyViews, type DailyRow } from '@/data/analytics.repo'
import { listPostSummariesForAdmin, type PostSummary } from '@/data/posts.repo'
import { getIntegrationToken } from '@/data/tokens.repo'
import { instagramReport, type IgReport } from '@/integrations/instagram/insights'
import { createSessionClient } from '@/lib/supabase/server'
import { DailyChart, type DayPoint } from './daily-chart'
import { IgPostsTable, type IgRow } from './ig-posts-table'

export const metadata: Metadata = { title: 'Analytics' }

type Props = { searchParams: Promise<{ range?: string }> }
const RANGES = [7, 30, 90] as const

const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-IN'))
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '0%')
/** First day of the range (computed per request; the page is never cached). */
function rangeStart(days: number): Date {
  return new Date(Date.now() - (days - 1) * 86_400_000)
}
const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const normalise = (url: string | null) => (url ? url.replace(/[?#].*$/, '').replace(/\/?$/, '/').replace('instagram.com/reels/', 'instagram.com/reel/') : '')

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="tf-panel" style={{ gap: 6, padding: '16px 18px' }}>
      <span className="tf-label">{label}</span>
      <span style={{ fontFamily: 'var(--display)', fontSize: 34, lineHeight: 1, color: 'var(--ink-cream)' }}>{value}</span>
      {note ? <span className="tf-note" style={{ fontSize: 12 }}>{note}</span> : null}
    </div>
  )
}

/** A ranked list with a thin single-colour bar for magnitude and the number in text colour. */
function Ranked({ title, rows, total, empty }: { title: string; rows: { label: string; value: number; href?: string }[]; total: number; empty: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <section className="tf-panel" style={{ gap: 10 }}>
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="tf-note" style={{ fontSize: 13 }}>{empty}</p> : null}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td style={{ padding: '6px 0', fontSize: 14, color: 'var(--ink-cream)', width: '45%', maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.href ? (
                  <Link href={r.href} style={{ color: 'inherit' }}>
                    {r.label}
                  </Link>
                ) : (
                  r.label
                )}
              </td>
              <td style={{ padding: '6px 10px' }}>
                <span style={{ display: 'block', height: 8, width: `${Math.max(2, (r.value / max) * 100)}%`, background: 'var(--gold-light)', borderRadius: '0 4px 4px 0' }} />
              </td>
              <td style={{ padding: '6px 0', fontSize: 13, color: 'var(--grey-1)', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {fmt(r.value)} <span style={{ color: 'var(--grey-3)' }}>· {pct(r.value, total)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function group(rows: DailyRow[], key: (r: DailyRow) => string, limit = 8) {
  const m = new Map<string, number>()
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + r.views)
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
}

async function loadInstagram(days: number): Promise<IgReport> {
  const empty: IgReport = { ok: false, error: null, insightsAvailable: false, account: null, totals: null, posts: [], fetchedAt: new Date().toISOString() }
  try {
    const env = serverEnv()
    if (!env.INSTAGRAM_ACCOUNT_ID) return { ...empty, error: 'INSTAGRAM_ACCOUNT_ID is not set.' }
    const token = await getIntegrationToken('instagram')
    return await instagramReport({ token, accountId: env.INSTAGRAM_ACCOUNT_ID, apiVersion: env.INSTAGRAM_API_VERSION, days })
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : 'Instagram is not connected.' }
  }
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const raw = Number((await searchParams).range)
  const days = (RANGES as readonly number[]).includes(raw) ? raw : 30
  const from = rangeStart(days)
  const db = await createSessionClient()

  const [rows, posts, ig] = await Promise.all([
    listDailyViews(db, dayKey(from)).catch(() => [] as DailyRow[]),
    listPostSummariesForAdmin(db).catch(() => [] as PostSummary[]),
    loadInstagram(days),
  ])

  // Website
  const totalViews = rows.reduce((s, r) => s + r.views, 0)
  const totalVisitors = rows.reduce((s, r) => s + r.visitors, 0)
  const byDay = new Map<string, DayPoint>()
  for (let i = 0; i < days; i += 1) {
    const d = dayKey(new Date(from.getTime() + i * 86_400_000))
    byDay.set(d, { day: d, views: 0, visitors: 0 })
  }
  for (const r of rows) {
    const p = byDay.get(r.day)
    if (p) {
      p.views += r.views
      p.visitors += r.visitors
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

  // Per post: site views next to Instagram numbers (matched by the Instagram link a post was imported from).
  const siteViewsByPost = new Map<string, number>()
  for (const r of rows) if (r.post_id) siteViewsByPost.set(r.post_id, (siteViewsByPost.get(r.post_id) ?? 0) + r.views)
  const postByPermalink = new Map(posts.filter((p) => p.source_url).map((p) => [normalise(p.source_url), p]))
  const igRows: IgRow[] = ig.posts.map((p) => {
    const sitePost = postByPermalink.get(normalise(p.permalink))
    return { ...p, sitePostId: sitePost?.id ?? null, siteViews: sitePost ? (siteViewsByPost.get(sitePost.id) ?? 0) : null }
  })

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="tf-eyebrow">Admin</div>
          <h1 className="tf-display">Analytics</h1>
        </div>
        <nav aria-label="Date range" style={{ display: 'flex', gap: 6 }}>
          {RANGES.map((r) => (
            <Link key={r} href={`/admin/analytics?range=${r}`} className="tf-chip" aria-pressed={r === days} aria-current={r === days ? 'page' : undefined}>
              Last {r} days
            </Link>
          ))}
        </nav>
      </div>

      {/* ------------------------------------------------ Instagram */}
      <section style={{ display: 'grid', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 16, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-cream)' }}>Instagram {ig.account ? `· @${ig.account.username}` : ''}</h2>
        {ig.ok ? (
          <p className="tf-note" style={{ fontSize: 12, margin: 0 }}>
            Instagram numbers refresh every 15 minutes; per-post reach, views, saves and shares every hour.
          </p>
        ) : null}
        {!ig.ok ? (
          <div className="tf-alert" role="alert">
            Instagram numbers are unavailable: {ig.error ?? 'unknown error'}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <Tile label="Followers" value={fmt(ig.account?.followers)} />
              <Tile label="Posts" value={fmt(ig.account?.posts)} />
              <Tile label={`Reach · ${Math.min(days, 30)} days`} value={fmt(ig.totals?.reach)} note="Accounts that saw your content" />
              <Tile label={`Views · ${Math.min(days, 30)} days`} value={fmt(ig.totals?.views)} />
              <Tile label="Accounts engaged" value={fmt(ig.totals?.engaged)} />
              <Tile label="Profile views" value={fmt(ig.totals?.profileViews)} />
            </div>
            {!ig.insightsAvailable ? (
              <div className="tf-alert">
                Likes and comments are showing. <strong>Reach, views, saves and shares</strong> need one more Meta permission on your token
                (<code>instagram_manage_insights</code>). Ask Claude to walk you through adding it.
              </div>
            ) : null}
            <IgPostsTable rows={igRows} insights={ig.insightsAvailable} siteDays={days} />
          </>
        )}
      </section>

      {/* ------------------------------------------------ Website */}
      <section style={{ display: 'grid', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 16, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-cream)' }}>Website · last {days} days</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <Tile label="Page views" value={fmt(totalViews)} />
          <Tile label="Visitors" value={fmt(totalVisitors)} note="Counted once per page per day" />
          <Tile label="Views per visitor" value={totalVisitors ? (totalViews / totalVisitors).toFixed(1) : '—'} />
          <Tile label="From Instagram" value={fmt(instagramVisits)} note={`${pct(instagramVisits, totalViews)} of views`} />
        </div>
        <section className="tf-panel">
          <h2>Page views per day</h2>
          {totalViews === 0 ? (
            <p className="tf-note" style={{ fontSize: 13 }}>
              No visits recorded yet. Counting started when this dashboard went live; visits appear within a minute.
            </p>
          ) : null}
          <DailyChart points={[...byDay.values()]} />
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
    </>
  )
}

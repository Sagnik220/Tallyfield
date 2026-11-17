'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import type { IgPost } from '@/integrations/instagram/insights'
import { compare, CsvButton, downloadCsv, FilterSelect, Pager, pageSlice, SearchBox, SortTh, Toolbar, useTableState, type Dir } from '@/components/admin/table-kit'

export type IgRow = IgPost & { sitePostId: string | null; siteViews: number | null }

const DEFAULTS = { q: '', type: 'all', posted: 'all', site: 'all', sort: 'date', dir: 'desc' }

const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-IN'))
const kind = (p: IgPost) => (p.product === 'REELS' ? 'Reel' : p.type === 'CAROUSEL_ALBUM' ? 'Carousel' : p.type === 'VIDEO' ? 'Video' : 'Photo')
const engagement = (p: IgPost) => {
  if (!p.reach) return null
  const total = (p.likes ?? 0) + (p.comments ?? 0) + (p.saves ?? 0) + (p.shares ?? 0)
  return total / p.reach
}
const pct = (r: number | null) => (r == null ? '—' : `${(r * 100).toFixed(1)}%`)

type SortKey = 'date' | 'likes' | 'comments' | 'saves' | 'shares' | 'reach' | 'views' | 'eng' | 'site' | 'caption'
const value = (p: IgRow, key: SortKey): string | number | null => {
  switch (key) {
    case 'date':
      return Date.parse(p.timestamp)
    case 'caption':
      return p.caption.toLowerCase()
    case 'eng':
      return engagement(p)
    case 'site':
      return p.siteViews
    default:
      return p[key]
  }
}

const SORT_OPTIONS: [string, string][] = [
  ['date:desc', 'Newest first'],
  ['date:asc', 'Oldest first'],
  ['likes:desc', 'Most likes'],
  ['comments:desc', 'Most comments'],
  ['saves:desc', 'Most saves'],
  ['shares:desc', 'Most shares'],
  ['reach:desc', 'Highest reach'],
  ['views:desc', 'Most views'],
  ['eng:desc', 'Best engagement rate'],
  ['site:desc', 'Most site views'],
]

/** Every Instagram post with its numbers: search, filter, sort, 15 per page, and download as CSV. */
export function IgPostsTable({ rows, insights, siteDays }: { rows: IgRow[]; insights: boolean; siteDays: number }) {
  const t = useTableState(DEFAULTS)
  const q = t.get('q')
  const type = t.get('type')
  const posted = t.get('posted')
  const site = t.get('site')
  const sort = t.get('sort') as SortKey
  const dir = t.get('dir') as Dir

  const filtered = useMemo(() => {
    const needle = q.toLowerCase()
    // eslint-disable-next-line react-hooks/purity -- "posted in the last N days" is relative to now by design
    const since = posted === 'all' ? 0 : Date.now() - Number(posted) * 86_400_000
    return rows
      .filter((p) => (needle ? p.caption.toLowerCase().includes(needle) : true))
      .filter((p) => (type === 'all' ? true : kind(p).toLowerCase() === type))
      .filter((p) => (since ? Date.parse(p.timestamp) >= since : true))
      .filter((p) => (site === 'all' ? true : site === 'on' ? Boolean(p.sitePostId) : !p.sitePostId))
      .sort((a, b) => compare(value(a, sort), value(b, sort), dir) || compare(Date.parse(a.timestamp), Date.parse(b.timestamp), 'desc'))
  }, [rows, q, type, posted, site, sort, dir])

  const visible = pageSlice(filtered, t.page)
  const sum = (k: 'likes' | 'comments' | 'saves' | 'shares' | 'reach' | 'views' | 'siteViews') => {
    const vals = filtered.map((p) => p[k]).filter((v): v is number => typeof v === 'number')
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null
  }
  const totalReach = sum('reach')
  const totalEng = totalReach ? ((sum('likes') ?? 0) + (sum('comments') ?? 0) + (sum('saves') ?? 0) + (sum('shares') ?? 0)) / totalReach : null

  const onSort = (id: string, d: Dir) => t.set({ sort: id, dir: d })
  const th = (id: SortKey, label: string, align: 'left' | 'right' = 'right', first: Dir = 'desc') => <SortTh id={id} label={label} sort={sort} dir={dir} onSort={onSort} align={align} first={first} />

  function exportCsv() {
    downloadCsv(
      `tallyfield-instagram-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date', 'Type', 'Caption', 'Likes', 'Comments', 'Saves', 'Shares', 'Reach', 'Views', 'Engagement rate', `Site views (${siteDays} days)`, 'Link'],
      filtered.map((p) => [p.timestamp.slice(0, 10), kind(p), p.caption, p.likes, p.comments, p.saves, p.shares, p.reach, p.views, engagement(p) == null ? '' : (engagement(p)! * 100).toFixed(2) + '%', p.siteViews, p.permalink]),
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Toolbar count={filtered.length} total={rows.length} noun="posts" showReset={t.isFiltered} onReset={t.reset} actions={<CsvButton onClick={exportCsv} />}>
        <SearchBox value={q} onChange={(v) => t.set({ q: v })} placeholder="Search captions…" label="Search Instagram posts" />
        <FilterSelect label="Type" value={type} onChange={(v) => t.set({ type: v })} options={[['all', 'All types'], ['photo', 'Photos'], ['carousel', 'Carousels'], ['reel', 'Reels'], ['video', 'Videos']]} />
        <FilterSelect label="Posted" value={posted} onChange={(v) => t.set({ posted: v })} options={[['all', 'Any time'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['365', 'Last 12 months']]} />
        <FilterSelect label="On the site" value={site} onChange={(v) => t.set({ site: v })} options={[['all', 'All posts'], ['on', 'Imported'], ['off', 'Not imported yet']]} />
        <FilterSelect
          label="Sort"
          value={`${sort}:${dir}`}
          onChange={(v) => {
            const [s, d] = v.split(':')
            t.set({ sort: s, dir: d })
          }}
          options={SORT_OPTIONS.some(([v]) => v === `${sort}:${dir}`) ? SORT_OPTIONS : [...SORT_OPTIONS, [`${sort}:${dir}`, 'Custom (column)']]}
        />
      </Toolbar>

      <div className="tf-panel" style={{ padding: 0, overflow: 'auto', maxHeight: '75vh' }}>
        <table className="tf-table tf-tk-table" style={{ minWidth: 1080 }}>
          <thead>
            <tr>
              {th('caption', 'Post', 'left', 'asc')}
              {th('date', 'Date', 'left')}
              {th('likes', 'Likes')}
              {th('comments', 'Comments')}
              {th('saves', 'Saves')}
              {th('shares', 'Shares')}
              {th('reach', 'Reach')}
              {th('views', 'Views')}
              {th('eng', 'Eng. rate')}
              {th('site', 'On the site')}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={10} className="tf-tk-empty">
                  No posts match.{' '}
                  {t.isFiltered ? (
                    <button type="button" className="tf-tk-link" onClick={t.reset}>
                      Clear filters
                    </button>
                  ) : null}
                </td>
              </tr>
            ) : null}
            {visible.map((p) => (
              <tr key={p.id}>
                <td style={{ fontSize: 14 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {p.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Instagram thumbnail
                      <img src={p.thumbnail} alt="" width={40} height={50} loading="lazy" style={{ objectFit: 'cover', flex: '0 0 auto' }} referrerPolicy="no-referrer" />
                    ) : (
                      <span style={{ width: 40, height: 50, background: 'var(--panel-hi)', flex: '0 0 auto' }} />
                    )}
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                      <a href={p.permalink} target="_blank" rel="noreferrer" title="Open on Instagram" style={{ color: 'var(--ink-cream)', textDecoration: 'none', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: 320 }}>
                        {p.caption || '(no caption)'}
                      </a>
                      <span className="tf-label" style={{ fontSize: 10 }}>
                        {kind(p)}
                      </span>
                    </span>
                  </span>
                </td>
                <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{new Date(p.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                <td className="num">{fmt(p.likes)}</td>
                <td className="num">{fmt(p.comments)}</td>
                <td className="num">{fmt(p.saves)}</td>
                <td className="num">{fmt(p.shares)}</td>
                <td className="num">{fmt(p.reach)}</td>
                <td className="num">{fmt(p.views)}</td>
                <td className="num">{pct(engagement(p))}</td>
                <td className="num" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                  {p.sitePostId ? (
                    <Link href={`/admin/posts/${p.sitePostId}`} style={{ color: 'var(--gold-light)' }}>
                      {fmt(p.siteViews ?? 0)} views
                    </Link>
                  ) : (
                    <Link href={`/admin/import?url=${encodeURIComponent(p.permalink)}`} style={{ color: 'var(--grey-2)' }}>
                      Import →
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 1 ? (
            <tfoot>
              <tr>
                <td colSpan={2}>Total · {filtered.length.toLocaleString('en-IN')} posts</td>
                <td className="num">{fmt(sum('likes'))}</td>
                <td className="num">{fmt(sum('comments'))}</td>
                <td className="num">{fmt(sum('saves'))}</td>
                <td className="num">{fmt(sum('shares'))}</td>
                <td className="num">{fmt(totalReach)}</td>
                <td className="num">{fmt(sum('views'))}</td>
                <td className="num">{pct(totalEng)}</td>
                <td className="num">{fmt(sum('siteViews'))}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <Pager page={t.page} total={filtered.length} onPage={(p) => t.set({ page: String(p) })} />
      <p className="tf-note" style={{ fontSize: 12 }}>
        Engagement rate = (likes + comments + saves + shares) ÷ reach.{insights ? '' : ' It needs reach, which needs the insights permission.'} “On the site” counts views in the last {siteDays} days.
      </p>
    </div>
  )
}

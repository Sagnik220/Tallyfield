'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { compare, CsvButton, downloadCsv, FilterSelect, Pager, pageSlice, SearchBox, SortTh, Toolbar, useTableState, type Dir } from '@/components/admin/table-kit'

export interface CombinedRow {
  id: string
  permalink: string
  caption: string
  timestamp: string
  thumbnail: string | null
  organicViews: number | null
  paidViews: number
  organicInteractions: number | null
  paidInteractions: number
  spend: number
  ads: number
  sitePostId: string | null
  siteViews: number | null
}

const DEFAULTS = { q: '', boost: 'all', sort: 'totalViews', dir: 'desc' }
const n = (v: number | null) => (v == null ? '—' : Math.round(v).toLocaleString('en-IN'))
const totalViews = (r: CombinedRow) => (r.organicViews ?? 0) + r.paidViews
const totalInteractions = (r: CombinedRow) => (r.organicInteractions ?? 0) + r.paidInteractions
const paidShare = (r: CombinedRow) => (totalViews(r) ? r.paidViews / totalViews(r) : 0)

type Key = 'caption' | 'date' | 'organicViews' | 'paidViews' | 'totalViews' | 'organicInteractions' | 'paidInteractions' | 'totalInteractions' | 'spend' | 'cpi' | 'site'
const value = (r: CombinedRow, k: Key) => {
  switch (k) {
    case 'caption':
      return r.caption.toLowerCase()
    case 'date':
      return Date.parse(r.timestamp)
    case 'totalViews':
      return totalViews(r)
    case 'totalInteractions':
      return totalInteractions(r)
    case 'cpi':
      return r.paidInteractions ? r.spend / r.paidInteractions : null
    case 'site':
      return r.siteViews
    default:
      return r[k]
  }
}

/** Each Instagram post with organic and paid results side by side, and their totals. */
export function CombinedTable({ rows, currency, adsReady }: { rows: CombinedRow[]; currency: string; adsReady: boolean }) {
  const money = (v: number | null, d = 0) => (v == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: d, minimumFractionDigits: d }).format(v))
  const t = useTableState(DEFAULTS)
  const q = t.get('q')
  const boost = t.get('boost')
  const sort = t.get('sort') as Key
  const dir = t.get('dir') as Dir
  const filtered = useMemo(() => {
    const needle = q.toLowerCase()
    return rows
      .filter((r) => (needle ? r.caption.toLowerCase().includes(needle) : true))
      .filter((r) => (boost === 'all' ? true : boost === 'boosted' ? r.ads > 0 : r.ads === 0))
      .sort((a, b) => compare(value(a, sort), value(b, sort), dir) || compare(Date.parse(a.timestamp), Date.parse(b.timestamp), 'desc'))
  }, [rows, q, boost, sort, dir])
  const visible = pageSlice(filtered, t.page)
  const onSort = (id: string, d: Dir) => t.set({ sort: id, dir: d })
  const th = (id: Key, label: string, first: Dir = 'desc') => <SortTh id={id} label={label} sort={sort} dir={dir} onSort={onSort} align="right" first={first} />
  const sum = (f: (r: CombinedRow) => number | null) => filtered.reduce((s, r) => s + (f(r) ?? 0), 0)

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Toolbar
        count={filtered.length}
        total={rows.length}
        noun="posts"
        showReset={t.isFiltered}
        onReset={t.reset}
        actions={
          <CsvButton
            onClick={() =>
              downloadCsv(
                `tallyfield-organic-and-paid-${new Date().toISOString().slice(0, 10)}.csv`,
                ['Date', 'Caption', 'Organic views', 'Paid views', 'Total views', 'Organic interactions', 'Paid interactions', 'Total interactions', `Spend (${currency})`, 'Cost per paid interaction', 'Site views', 'Link'],
                filtered.map((r) => [r.timestamp.slice(0, 10), r.caption, r.organicViews, r.paidViews, totalViews(r), r.organicInteractions, r.paidInteractions, totalInteractions(r), r.spend.toFixed(2), r.paidInteractions ? (r.spend / r.paidInteractions).toFixed(2) : '', r.siteViews, r.permalink]),
              )
            }
          />
        }
      >
        <SearchBox value={q} onChange={(v) => t.set({ q: v })} placeholder="Search captions…" label="Search posts" />
        <FilterSelect label="Promotion" value={boost} onChange={(v) => t.set({ boost: v })} options={[['all', 'All posts'], ['boosted', 'Boosted / advertised'], ['organic', 'Organic only']]} />
      </Toolbar>
      <div className="tf-panel" style={{ padding: 0, overflow: 'auto', maxHeight: '75vh' }}>
        <table className="tf-table tf-tk-table" style={{ minWidth: 1180 }}>
          <thead>
            <tr>
              <SortTh id="caption" label="Post" sort={sort} dir={dir} onSort={onSort} first="asc" />
              {th('organicViews', 'Organic views')}
              {th('paidViews', 'Paid views')}
              {th('totalViews', 'Total views')}
              {th('organicInteractions', 'Organic interactions')}
              {th('paidInteractions', 'Paid interactions')}
              {th('totalInteractions', 'Total interactions')}
              {th('spend', 'Spend')}
              {th('cpi', 'Cost / paid interaction', 'asc')}
              {th('site', 'Site views')}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={10} className="tf-tk-empty">
                  No posts match.
                </td>
              </tr>
            ) : null}
            {visible.map((r) => (
              <tr key={r.id}>
                <td style={{ fontSize: 14 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {r.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Instagram thumbnail
                      <img src={r.thumbnail} alt="" width={40} height={50} loading="lazy" referrerPolicy="no-referrer" style={{ objectFit: 'cover', flex: '0 0 auto' }} />
                    ) : (
                      <span style={{ width: 40, height: 50, background: 'var(--panel-hi)', flex: '0 0 auto' }} />
                    )}
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <a href={r.permalink} target="_blank" rel="noreferrer" style={{ color: 'var(--ink-cream)', textDecoration: 'none', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: 300 }}>
                        {r.caption || '(no caption)'}
                      </a>
                      {/* How much of this post's audience came from ads */}
                      <span className="tf-split-bar" style={{ width: 120, height: 5 }} title={`${Math.round(paidShare(r) * 100)}% of views paid`} aria-label={`${Math.round(paidShare(r) * 100)}% of views from ads`}>
                        <span className="tf-split-organic" style={{ flexGrow: totalViews(r) ? (r.organicViews ?? 0) : 1 }} />
                        {r.paidViews > 0 ? <span className="tf-split-paid" style={{ flexGrow: r.paidViews }} /> : null}
                      </span>
                      <span className="tf-note" style={{ fontSize: 11 }}>
                        {new Date(r.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                        {r.ads > 0 ? ` · boosted (${r.ads} ad${r.ads === 1 ? '' : 's'})` : ''}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="num">{n(r.organicViews)}</td>
                <td className="num">{adsReady ? n(r.paidViews) : '—'}</td>
                <td className="num" style={{ color: 'var(--ink-cream)', fontWeight: 700 }}>
                  {n(totalViews(r))}
                </td>
                <td className="num">{n(r.organicInteractions)}</td>
                <td className="num">{adsReady ? n(r.paidInteractions) : '—'}</td>
                <td className="num" style={{ color: 'var(--ink-cream)', fontWeight: 700 }}>
                  {n(totalInteractions(r))}
                </td>
                <td className="num">{adsReady ? money(r.spend) : '—'}</td>
                <td className="num">{r.paidInteractions ? money(r.spend / r.paidInteractions, 2) : '—'}</td>
                <td className="num">
                  {r.sitePostId ? (
                    <Link href={`/admin/posts/${r.sitePostId}`} style={{ color: 'var(--gold-light)' }}>
                      {n(r.siteViews ?? 0)}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 1 ? (
            <tfoot>
              <tr>
                <td>Total · {filtered.length} posts</td>
                <td className="num">{n(sum((r) => r.organicViews))}</td>
                <td className="num">{adsReady ? n(sum((r) => r.paidViews)) : '—'}</td>
                <td className="num">{n(sum(totalViews))}</td>
                <td className="num">{n(sum((r) => r.organicInteractions))}</td>
                <td className="num">{adsReady ? n(sum((r) => r.paidInteractions)) : '—'}</td>
                <td className="num">{n(sum(totalInteractions))}</td>
                <td className="num">{adsReady ? money(sum((r) => r.spend)) : '—'}</td>
                <td className="num">{sum((r) => r.paidInteractions) ? money(sum((r) => r.spend) / sum((r) => r.paidInteractions), 2) : '—'}</td>
                <td className="num">{n(sum((r) => r.siteViews))}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <Pager page={t.page} total={filtered.length} onPage={(p) => t.set({ page: String(p) })} />
      <p className="tf-note" style={{ fontSize: 12 }}>
        Per-post numbers are lifetime totals. Organic comes from Instagram Insights (unpaid activity only); paid comes from Meta Ads (boosts and ads that use the post), so they add up without double counting. Interactions = likes + comments + saves + shares.
      </p>
    </div>
  )
}

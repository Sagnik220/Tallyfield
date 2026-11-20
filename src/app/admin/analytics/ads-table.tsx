'use client'

import { useMemo } from 'react'
import { compare, CsvButton, downloadCsv, FilterSelect, Pager, pageSlice, SearchBox, SortTh, Toolbar, useTableState, type Dir } from '@/components/admin/table-kit'
import type { AdRow } from '@/integrations/meta-ads/ads'

export type AdTableRow = AdRow & { postCaption: string | null; postPermalink: string | null }

const DEFAULTS = { q: '', status: 'all', sort: 'spend', dir: 'desc' }
const n = (v: number | null) => (v == null ? '—' : Math.round(v).toLocaleString('en-IN'))
const statusLabel = (s: string) => (s === 'ACTIVE' ? 'Active' : s === 'PAUSED' || s === 'CAMPAIGN_PAUSED' || s === 'ADSET_PAUSED' ? 'Paused' : s ? s[0] + s.slice(1).toLowerCase().replace(/_/g, ' ') : '—')
const cpm = (r: AdRow) => (r.impressions ? (r.spend / r.impressions) * 1000 : null)
const cpi = (r: AdRow) => (r.interactions ? r.spend / r.interactions : null)
const ctr = (r: AdRow) => (r.impressions ? r.linkClicks / r.impressions : null)

type Key = 'name' | 'spend' | 'impressions' | 'reach' | 'linkClicks' | 'interactions' | 'cpm' | 'cpi' | 'ctr'
const value = (r: AdRow, k: Key) => (k === 'name' ? r.name.toLowerCase() : k === 'cpm' ? cpm(r) : k === 'cpi' ? cpi(r) : k === 'ctr' ? ctr(r) : r[k])

/** Every ad and boosted post with lifetime results: search, filter by status, sort, 15 per page, CSV. */
export function AdsTable({ rows, currency }: { rows: AdTableRow[]; currency: string }) {
  const money = (v: number | null, d = 0) => (v == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: d, minimumFractionDigits: d }).format(v))
  const t = useTableState(DEFAULTS)
  const q = t.get('q')
  const status = t.get('status')
  const sort = t.get('sort') as Key
  const dir = t.get('dir') as Dir
  const filtered = useMemo(() => {
    const needle = q.toLowerCase()
    return rows
      .filter((r) => (needle ? `${r.name} ${r.postCaption ?? ''}`.toLowerCase().includes(needle) : true))
      .filter((r) => (status === 'all' ? true : status === 'active' ? r.status === 'ACTIVE' : status === 'paused' ? /PAUSED/.test(r.status) : r.status !== 'ACTIVE' && !/PAUSED/.test(r.status)))
      .sort((a, b) => compare(value(a, sort), value(b, sort), dir))
  }, [rows, q, status, sort, dir])
  const visible = pageSlice(filtered, t.page)
  const onSort = (id: string, d: Dir) => t.set({ sort: id, dir: d })
  const th = (id: Key, label: string, first: Dir = 'desc') => <SortTh id={id} label={label} sort={sort} dir={dir} onSort={onSort} align="right" first={first} />
  const sum = (k: 'spend' | 'impressions' | 'reach' | 'linkClicks' | 'interactions') => filtered.reduce((s, r) => s + r[k], 0)

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Toolbar
        count={filtered.length}
        total={rows.length}
        noun="ads"
        showReset={t.isFiltered}
        onReset={t.reset}
        actions={
          <CsvButton
            onClick={() =>
              downloadCsv(
                `tallyfield-ads-${new Date().toISOString().slice(0, 10)}.csv`,
                ['Ad', 'Status', `Spend (${currency})`, 'Impressions', 'Reach', 'Link clicks', 'Interactions', 'CPM', 'Cost per interaction', 'Instagram post'],
                filtered.map((r) => [r.name, statusLabel(r.status), r.spend.toFixed(2), r.impressions, r.reach, r.linkClicks, r.interactions, cpm(r)?.toFixed(2), cpi(r)?.toFixed(2), r.postPermalink ?? r.permalink ?? '']),
              )
            }
          />
        }
      >
        <SearchBox value={q} onChange={(v) => t.set({ q: v })} placeholder="Search ads…" label="Search ads" />
        <FilterSelect label="Status" value={status} onChange={(v) => t.set({ status: v })} options={[['all', 'All ads'], ['active', 'Active'], ['paused', 'Paused'], ['ended', 'Ended / other']]} />
      </Toolbar>
      <div className="tf-panel" style={{ padding: 0, overflow: 'auto', maxHeight: '75vh' }}>
        <table className="tf-table tf-tk-table" style={{ minWidth: 1060 }}>
          <thead>
            <tr>
              <SortTh id="name" label="Ad" sort={sort} dir={dir} onSort={onSort} first="asc" />
              {th('spend', 'Spend')}
              {th('impressions', 'Impressions')}
              {th('reach', 'Reach')}
              {th('linkClicks', 'Link clicks')}
              {th('ctr', 'CTR')}
              {th('interactions', 'Interactions')}
              {th('cpm', 'Cost / 1,000 views', 'asc')}
              {th('cpi', 'Cost / interaction', 'asc')}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={9} className="tf-tk-empty">
                  No ads match.
                </td>
              </tr>
            ) : null}
            {visible.map((r) => (
              <tr key={r.id}>
                <td style={{ fontSize: 14 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {r.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Meta thumbnail
                      <img src={r.thumbnail} alt="" width={40} height={40} loading="lazy" referrerPolicy="no-referrer" style={{ objectFit: 'cover', flex: '0 0 auto' }} />
                    ) : (
                      <span style={{ width: 40, height: 40, background: 'var(--panel-hi)', flex: '0 0 auto' }} />
                    )}
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, maxWidth: 300 }}>
                      <span style={{ color: 'var(--ink-cream)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>
                        {r.name}
                      </span>
                      <span className="tf-note" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span className="tf-sync-status" data-status={r.status === 'ACTIVE' ? 'new' : 'current'} style={{ padding: '1px 6px', fontSize: 10, marginRight: 6 }}>
                          {statusLabel(r.status)}
                        </span>
                        {r.postPermalink || r.permalink ? (
                          <a href={r.postPermalink || r.permalink || undefined} target="_blank" rel="noreferrer" style={{ color: 'var(--gold-light)' }}>
                            {r.postCaption ? r.postCaption.slice(0, 40) : 'Instagram post'} ↗
                          </a>
                        ) : (
                          'Not linked to a post'
                        )}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="num">{money(r.spend)}</td>
                <td className="num">{n(r.impressions)}</td>
                <td className="num">{n(r.reach)}</td>
                <td className="num">{n(r.linkClicks)}</td>
                <td className="num">{ctr(r) == null ? '—' : `${(ctr(r)! * 100).toFixed(2)}%`}</td>
                <td className="num">{n(r.interactions)}</td>
                <td className="num">{money(cpm(r), 2)}</td>
                <td className="num">{money(cpi(r), 2)}</td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 1 ? (
            <tfoot>
              <tr>
                <td>Total · {filtered.length} ads</td>
                <td className="num">{money(sum('spend'))}</td>
                <td className="num">{n(sum('impressions'))}</td>
                <td className="num" title="Reach can overlap between ads">
                  {n(sum('reach'))}*
                </td>
                <td className="num">{n(sum('linkClicks'))}</td>
                <td className="num">{sum('impressions') ? `${((sum('linkClicks') / sum('impressions')) * 100).toFixed(2)}%` : '—'}</td>
                <td className="num">{n(sum('interactions'))}</td>
                <td className="num">{sum('impressions') ? money((sum('spend') / sum('impressions')) * 1000, 2) : '—'}</td>
                <td className="num">{sum('interactions') ? money(sum('spend') / sum('interactions'), 2) : '—'}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <Pager page={t.page} total={filtered.length} onPage={(p) => t.set({ page: String(p) })} />
      <p className="tf-note" style={{ fontSize: 12 }}>
        Per-ad numbers are lifetime totals. *Reach is summed across ads, so people reached by more than one ad are counted more than once.
      </p>
    </div>
  )
}

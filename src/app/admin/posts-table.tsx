'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { compare, CsvButton, downloadCsv, FilterSelect, Pager, pageSlice, SearchBox, SortTh, Toolbar, useTableState, type Dir } from '@/components/admin/table-kit'
import { StatusButtons } from './status-buttons'

export interface PostListRow {
  id: string
  title: string
  slug: string
  status: 'draft' | 'published' | 'archived'
  category: string
  source: 'instagram' | 'site'
  cover: string | null
  updatedAt: string
  publishedAt: string | null
  views: number
}

const DEFAULTS = { q: '', status: 'all', category: 'all', source: 'all', sort: 'updated', dir: 'desc' }
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—')

type SortKey = 'updated' | 'published' | 'title' | 'views'
const value = (p: PostListRow, k: SortKey) => (k === 'updated' ? Date.parse(p.updatedAt) : k === 'published' ? (p.publishedAt ? Date.parse(p.publishedAt) : null) : k === 'title' ? p.title : p.views)

/** All posts: search, filter by status / category / source, sort, 15 per page. */
export function PostsTable({ rows, categories }: { rows: PostListRow[]; categories: string[] }) {
  const t = useTableState(DEFAULTS)
  const q = t.get('q')
  const status = t.get('status')
  const category = t.get('category')
  const source = t.get('source')
  const sort = t.get('sort') as SortKey
  const dir = t.get('dir') as Dir

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, draft: 0, published: 0, archived: 0 }
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [rows])

  const filtered = useMemo(() => {
    const needle = q.toLowerCase()
    return rows
      .filter((p) => (needle ? p.title.toLowerCase().includes(needle) || p.slug.includes(needle) : true))
      .filter((p) => (status === 'all' ? true : p.status === status))
      .filter((p) => (category === 'all' ? true : p.category === category))
      .filter((p) => (source === 'all' ? true : p.source === source))
      .sort((a, b) => compare(value(a, sort), value(b, sort), dir) || compare(Date.parse(a.updatedAt), Date.parse(b.updatedAt), 'desc'))
  }, [rows, q, status, category, source, sort, dir])

  const visible = pageSlice(filtered, t.page)
  const onSort = (id: string, d: Dir) => t.set({ sort: id, dir: d })

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Status tabs with counts: the most common filter, one click away. */}
      <div role="group" aria-label="Status" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['all', 'published', 'draft', 'archived'] as const).map((s) => (
          <button key={s} type="button" className="tf-chip" aria-pressed={status === s} onClick={() => t.set({ status: s })}>
            {s === 'all' ? 'All' : s[0]!.toUpperCase() + s.slice(1)} · {counts[s] ?? 0}
          </button>
        ))}
      </div>

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
                `tallyfield-posts-${new Date().toISOString().slice(0, 10)}.csv`,
                ['Title', 'Status', 'Category', 'Source', 'Views (30 days)', 'Published', 'Updated', 'Link'],
                filtered.map((p) => [p.title, p.status, p.category, p.source, p.views, p.publishedAt?.slice(0, 10), p.updatedAt.slice(0, 10), p.status === 'published' ? `/posts/${p.slug}` : '']),
              )
            }
          />
        }
      >
        <SearchBox value={q} onChange={(v) => t.set({ q: v })} placeholder="Search titles…" label="Search posts" />
        <FilterSelect label="Category" value={category} onChange={(v) => t.set({ category: v })} options={[['all', 'All categories'], ...categories.map((c) => [c, c] as [string, string])]} />
        <FilterSelect label="Source" value={source} onChange={(v) => t.set({ source: v })} options={[['all', 'All sources'], ['instagram', 'From Instagram'], ['site', 'Written on the site']]} />
        <FilterSelect
          label="Sort"
          value={`${sort}:${dir}`}
          onChange={(v) => {
            const [s, d] = v.split(':')
            t.set({ sort: s, dir: d })
          }}
          options={[
            ['updated:desc', 'Recently edited'],
            ['published:desc', 'Recently published'],
            ['views:desc', 'Most viewed (30 days)'],
            ['title:asc', 'Title A–Z'],
            ['updated:asc', 'Least recently edited'],
            ...((['updated:desc', 'published:desc', 'views:desc', 'title:asc', 'updated:asc'].includes(`${sort}:${dir}`) ? [] : [[`${sort}:${dir}`, 'Custom (column)']]) as [string, string][]),
          ]}
        />
      </Toolbar>

      <div className="tf-table-wrap" style={{ borderTop: '2px solid var(--gold)' }}>
        <table className="tf-table tf-tk-table" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <SortTh id="title" label="Post" sort={sort} dir={dir} onSort={onSort} first="asc" />
              <th>Status</th>
              <SortTh id="views" label="Views · 30d" sort={sort} dir={dir} onSort={onSort} align="right" />
              <SortTh id="updated" label="Edited" sort={sort} dir={dir} onSort={onSort} />
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="tf-tk-empty">
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
                <td>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <span style={{ width: 44, height: 55, background: 'var(--panel-hi)', overflow: 'hidden', flex: '0 0 auto' }}>
                      {p.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail
                        <img src={p.cover} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : null}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <Link href={`/admin/posts/${p.id}`} style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-cream)', textDecoration: 'none', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: 420 }}>
                        {p.title}
                      </Link>
                      <span className="tf-label" style={{ fontSize: 10 }}>
                        {p.category} · {p.source === 'instagram' ? 'Instagram' : 'Site'}
                      </span>
                    </span>
                  </span>
                </td>
                <td>
                  <span className="tf-status" data-status={p.status}>
                    {p.status}
                  </span>
                </td>
                <td className="num">{p.views.toLocaleString('en-IN')}</td>
                <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{when(p.updatedAt)}</td>
                <td>
                  <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                    {p.status === 'published' ? (
                      <a href={`/posts/${p.slug}`} target="_blank" rel="noreferrer" className="tf-tk-link" title="Open on the site">
                        View ↗
                      </a>
                    ) : null}
                    <StatusButtons id={p.id} status={p.status} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={t.page} total={filtered.length} onPage={(n) => t.set({ page: String(n) })} />
    </div>
  )
}

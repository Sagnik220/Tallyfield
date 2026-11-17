'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Pager, pageSlice, useTableState } from '@/components/admin/table-kit'
import { allowInstagramSyncAction, syncInstagramBatchAction } from '@/server/actions/sync'
import type { SyncItem, SyncStatus } from '@/services/sync.service'

const LABEL: Record<SyncStatus, string> = {
  new: 'New',
  changed: 'Caption changed',
  current: 'Up to date',
  edited: 'Edited on site',
  removed: 'Deleted from site',
  no_images: 'Video only',
}
const NOTE: Record<SyncStatus, string> = {
  new: 'Will be imported',
  changed: 'Caption will be refreshed',
  current: 'Nothing to do',
  edited: 'Protected: your edits are kept',
  removed: 'Skipped: you deleted it',
  no_images: 'Skipped: no photos to import',
}
const ORDER: SyncStatus[] = ['new', 'changed', 'edited', 'current', 'removed', 'no_images']
const DEFAULTS = { show: 'all' }

type Progress = { imported: number; updated: number; failed: { permalink: string; message: string }[]; total: number; done: boolean }

export function SyncPanel({ items, categories }: { items: SyncItem[]; categories: { id: string; name: string }[] }) {
  const router = useRouter()
  const t = useTableState(DEFAULTS)
  const show = t.get('show')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [publish, setPublish] = useState(false)
  const [updateCaptions, setUpdateCaptions] = useState(true)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState('')

  const counts = useMemo(() => {
    const c = Object.fromEntries(ORDER.map((s) => [s, 0])) as Record<SyncStatus, number>
    for (const i of items) c[i.status] += 1
    return c
  }, [items])
  const filtered = show === 'all' ? items : items.filter((i) => i.status === show)
  const visible = pageSlice(filtered, t.page)
  const work = counts.new + (updateCaptions ? counts.changed : 0)

  async function sync() {
    if (publish && counts.new > 0 && !window.confirm(`Publish ${counts.new} new post${counts.new === 1 ? '' : 's'} on the site straight away?`)) return
    setRunning(true)
    setError('')
    const p: Progress = { imported: 0, updated: 0, failed: [], total: counts.new, done: false }
    setProgress({ ...p })
    const skip: string[] = []
    let captionsDone = !updateCaptions
    try {
      for (let round = 0; round < 400; round += 1) {
        const r = await syncInstagramBatchAction({ categoryId, publish, updateCaptions: !captionsDone, skip })
        if (!r.ok) {
          setError(r.error.message)
          break
        }
        captionsDone = true
        p.imported += r.data.imported.length
        p.updated += r.data.updated.length
        for (const f of r.data.failed) {
          p.failed.push({ permalink: f.permalink, message: f.message })
          skip.push(f.externalId)
        }
        setProgress({ ...p })
        if (r.data.remainingNew === 0 || (r.data.imported.length === 0 && r.data.failed.length === 0)) break
      }
    } catch {
      setError('The connection dropped. Run sync again: it carries on where it stopped.')
    }
    p.done = true
    setProgress({ ...p })
    setRunning(false)
    router.refresh()
  }

  async function allow(postId: string) {
    if (!window.confirm('Let Instagram update this post again? The next sync can replace its caption and title with the ones on Instagram.')) return
    const r = await allowInstagramSyncAction({ postId })
    if (!r.ok) setError(r.error.message)
    else router.refresh()
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {ORDER.map((s) => (
          <button key={s} type="button" className="tf-panel tf-sync-tile" aria-pressed={show === s} onClick={() => t.set({ show: show === s ? 'all' : s })}>
            <span className="tf-label">{LABEL[s]}</span>
            <span style={{ fontFamily: 'var(--display)', fontSize: 34, lineHeight: 1, color: 'var(--ink-cream)' }}>{counts[s]}</span>
            <span className="tf-note" style={{ fontSize: 12 }}>
              {NOTE[s]}
            </span>
          </button>
        ))}
      </div>

      <section className="tf-panel" style={{ gap: 16 }}>
        <h2>Run a sync</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-end' }}>
          <label className="tf-tk-select">
            <span>Category for new posts</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={running}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="tf-sync-check">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} disabled={running} />
            Publish new posts straight away <span className="tf-note">(otherwise they arrive as drafts to check first)</span>
          </label>
          <label className="tf-sync-check">
            <input type="checkbox" checked={updateCaptions} onChange={(e) => setUpdateCaptions(e.target.checked)} disabled={running} />
            Refresh changed captions on posts I haven’t edited
          </label>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
          <button type="button" className="tf-gold" disabled={running || work === 0 || !categoryId} onClick={() => void sync()}>
            {running ? 'Syncing…' : work === 0 ? 'Everything is in sync' : `Sync ${counts.new} new${updateCaptions && counts.changed ? ` · refresh ${counts.changed}` : ''}`}
          </button>
          {progress ? (
            <span role="status" aria-live="polite" className="tf-note" style={{ fontSize: 14 }}>
              {progress.done ? 'Done. ' : ''}Imported {progress.imported}
              {progress.total ? ` of ${progress.total}` : ''} · refreshed {progress.updated}
              {progress.failed.length ? ` · ${progress.failed.length} could not be imported` : ''}
            </span>
          ) : null}
        </div>
        {progress && progress.total > 0 ? (
          <span className="tf-flow-progress" aria-hidden="true" style={{ maxWidth: 520 }}>
            <span style={{ transform: `scaleX(${Math.min(1, (progress.imported + progress.failed.length) / progress.total)})`, transition: 'transform 0.4s ease' }} />
          </span>
        ) : null}
        {error ? (
          <div className="tf-alert" role="alert">
            {error}
          </div>
        ) : null}
        {progress?.failed.length ? (
          <ul className="tf-note" style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {progress.failed.map((f) => (
              <li key={f.permalink}>
                <a href={f.permalink} target="_blank" rel="noreferrer" style={{ color: 'var(--gold-light)' }}>
                  {f.permalink}
                </a>
                : {f.message}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="tf-note" style={{ margin: 0, fontSize: 12 }}>
          A post counts as edited once you change its title, intro or text in the editor. Publishing or unpublishing does not count.
        </p>
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Show">
          <button type="button" className="tf-chip" aria-pressed={show === 'all'} onClick={() => t.set({ show: 'all' })}>
            All · {items.length}
          </button>
          {ORDER.filter((s) => counts[s] > 0).map((s) => (
            <button key={s} type="button" className="tf-chip" aria-pressed={show === s} onClick={() => t.set({ show: s })}>
              {LABEL[s]} · {counts[s]}
            </button>
          ))}
        </div>
        <div className="tf-panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="tf-table tf-tk-table" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th>Instagram post</th>
                <th>Posted</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>On the site</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={4} className="tf-tk-empty">
                    Nothing here.
                  </td>
                </tr>
              ) : null}
              {visible.map((i) => (
                <tr key={i.externalId}>
                  <td style={{ fontSize: 14 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {i.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Instagram thumbnail
                        <img src={i.thumbnail} alt="" width={40} height={50} loading="lazy" referrerPolicy="no-referrer" style={{ objectFit: 'cover', flex: '0 0 auto' }} />
                      ) : (
                        <span style={{ width: 40, height: 50, background: 'var(--panel-hi)', flex: '0 0 auto' }} />
                      )}
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                        <a href={i.permalink} target="_blank" rel="noreferrer" style={{ color: 'var(--ink-cream)', textDecoration: 'none', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: 360 }}>
                          {i.caption || '(no caption)'}
                        </a>
                        <span className="tf-note" style={{ fontSize: 12 }}>
                          {i.slides} photo{i.slides === 1 ? '' : 's'}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{i.timestamp ? new Date(i.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</td>
                  <td>
                    <span className="tf-sync-status" data-status={i.status}>
                      {LABEL[i.status]}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontSize: 13, whiteSpace: 'nowrap' }}>
                    {i.postId ? (
                      <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
                        {i.status === 'edited' ? (
                          <button type="button" className="tf-tk-link" onClick={() => void allow(i.postId!)}>
                            Allow Instagram updates
                          </button>
                        ) : null}
                        <Link href={`/admin/posts/${i.postId}`} style={{ color: 'var(--gold-light)' }}>
                          Open {i.postStatus === 'draft' ? 'draft' : 'post'} →
                        </Link>
                      </span>
                    ) : i.status === 'removed' ? (
                      <Link href={`/admin/import?url=${encodeURIComponent(i.permalink)}`} style={{ color: 'var(--grey-2)' }}>
                        Import again →
                      </Link>
                    ) : (
                      <span className="tf-note">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={t.page} total={filtered.length} onPage={(n) => t.set({ page: String(n) })} />
      </section>
    </div>
  )
}

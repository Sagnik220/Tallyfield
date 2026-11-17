'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import type { ActionResult } from '@/domain/result'
import { getDraftAction, type DraftView } from '@/server/actions/drafts'
import { importFromLinkAction } from '@/server/actions/import'
import { setPostStatusAction, updatePostAction } from '@/server/actions/posts'

interface Props {
  categories: { id: string; name: string }[]
  /** When set, the screen opens this existing post for editing instead of importing a new one. */
  initial: DraftView | null
}

const errorText = <T,>(r: ActionResult<T>) => (r.ok ? '' : r.error.message)

export function ImportFlow({ categories, initial }: Props) {
  const postId = initial?.id ?? null
  const [link, setLink] = useState('')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? '')
  const [draft, setDraft] = useState<DraftView | null>(initial)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [deck, setDeck] = useState(initial?.deck ?? '')
  const [caption, setCaption] = useState(initial?.caption ?? '')
  const [cover, setCover] = useState<string | null>(initial ? (initial.coverMediaId ?? initial.slides[0]?.id ?? null) : null)
  const [busy, setBusy] = useState<'' | 'fetch' | 'save' | 'publish'>('')
  const [error, setError] = useState('')
  const [done, setDone] = useState<'' | 'saved' | 'published'>('')

  async function loadDraft(id: string) {
    const result = await getDraftAction({ id })
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    const d = result.data
    setDraft(d)
    setTitle(d.title)
    setDeck(d.deck)
    setCaption(d.caption)
    setCategoryId(d.categoryId)
    setCover(d.coverMediaId ?? d.slides[0]?.id ?? null)
  }

  async function onFetch(event: FormEvent) {
    event.preventDefault()
    setError('')
    setDone('')
    setBusy('fetch')
    try {
      const result = await importFromLinkAction({ link, categoryId })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      await loadDraft(result.data.postId)
    } finally {
      setBusy('')
    }
  }

  async function save(publish: boolean) {
    if (!draft) return
    setError('')
    setDone('')
    setBusy(publish ? 'publish' : 'save')
    try {
      const update: Record<string, unknown> = { id: draft.id, title, deck, categoryId, coverMediaId: cover }
      if (draft.galleryBlockId) {
        update.body = {
          version: 1,
          blocks: [{ id: draft.galleryBlockId, type: 'gallery', data: { mediaIds: draft.slides.map((s) => s.id), caption } }],
        }
      }
      const saved = await updatePostAction(update)
      if (!saved.ok) {
        setError(errorText(saved))
        return
      }
      if (publish) {
        const published = await setPostStatusAction({ id: draft.id, status: 'published' })
        if (!published.ok) {
          setError(errorText(published))
          return
        }
      }
      setDraft({ ...draft, slug: saved.data.slug, status: publish ? 'published' : draft.status })
      setDone(publish ? 'published' : 'saved')
    } finally {
      setBusy('')
    }
  }

  function clear() {
    setLink('')
    setDraft(null)
    setError('')
    setDone('')
  }

  return (
    <>
      {!postId ? (
        <form className="tf-panel" onSubmit={onFetch}>
          <h2>01&nbsp;&nbsp;Paste the link</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
            <div style={{ flex: '999 1 320px', minWidth: 0 }}>
              <label htmlFor="ig-link" className="tf-label tf-field-label">
                Instagram post link
              </label>
              <input id="ig-link" className="tf-field" type="url" required value={link} disabled={Boolean(draft)} onChange={(e) => setLink(e.target.value)} placeholder="https://www.instagram.com/p/..." />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label htmlFor="ig-cat" className="tf-label tf-field-label">
                Category
              </label>
              <select id="ig-cat" className="tf-field" value={categoryId} disabled={Boolean(draft)} onChange={(e) => setCategoryId(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="tf-gold" type="submit" disabled={busy === 'fetch' || Boolean(draft)}>
              {busy === 'fetch' ? 'Fetching slides…' : 'Fetch post'}
            </button>
            <button className="tf-ghost" type="button" onClick={clear}>
              {draft ? 'Import another' : 'Clear'}
            </button>
          </div>
          <p className="tf-note">
            Works for posts on the connected account, @tallyfield. Fetching copies every slide into the site and creates a draft; nothing goes live until you publish.
          </p>
        </form>
      ) : null}

      {error ? (
        <div className="tf-alert" role="alert">
          {error}
        </div>
      ) : null}

      {!draft && !postId ? (
        <section style={{ border: '1px dashed var(--stroke)', padding: '56px 28px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-cream)' }}>Nothing fetched yet</div>
          <p className="tf-note">Paste a link above and press Fetch post.</p>
        </section>
      ) : null}

      {draft ? (
        <>
          <section className="tf-panel">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px 24px' }}>
              <h2>02&nbsp;&nbsp;Check the slides</h2>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--grey-2)' }}>
                {draft.slides.length} slides · cover: slide {Math.max(1, draft.slides.findIndex((s) => s.id === cover) + 1)}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(132px, 44%), 1fr))', gap: 14 }}>
              {draft.slides.map((slide, i) => (
                <button key={slide.id} className="tf-thumb" type="button" aria-pressed={cover === slide.id} aria-label={`Use slide ${i + 1} as the cover`} onClick={() => setCover(slide.id)}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a just-imported file */}
                  <img src={slide.url} alt={slide.alt} style={{ display: 'block', width: '100%', height: 'auto' }} />
                  <span style={{ position: 'absolute', left: 0, bottom: 0, padding: '4px 8px', background: 'rgba(6, 20, 18, 0.9)', fontSize: 12, fontWeight: 700, color: 'var(--grey-1)' }}>{String(i + 1).padStart(2, '0')}</span>
                  {cover === slide.id ? (
                    <span style={{ position: 'absolute', top: 0, left: 0, padding: '4px 8px', background: 'var(--gold)', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--on-gold)' }}>COVER</span>
                  ) : null}
                </button>
              ))}
            </div>
            <p className="tf-note">Click a slide to make it the cover image.</p>
          </section>

          <section className="tf-panel">
            <h2>03&nbsp;&nbsp;Post details</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 22 }}>
              <div>
                <label htmlFor="p-title" className="tf-label tf-field-label">
                  Headline
                </label>
                <input id="p-title" className="tf-field" type="text" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} aria-describedby="p-title-hint" />
                <p id="p-title-hint" className="tf-note" style={{ fontSize: 13, marginTop: 6 }}>
                  {title.length > 50
                    ? `${title.length} characters. Shorter reads better: try the headline from your first slide.`
                    : 'Tip: use the short headline from your first slide.'}
                </p>
              </div>
              <div>
                <label htmlFor="p-slug" className="tf-label tf-field-label">
                  Web address
                </label>
                <input id="p-slug" className="tf-field" type="text" readOnly value={`/posts/${draft.slug}`} style={{ color: 'var(--grey-2)' }} />
              </div>
              <div>
                <label htmlFor="p-deck" className="tf-label tf-field-label">
                  Deck line
                </label>
                <input id="p-deck" className="tf-field" type="text" maxLength={300} value={deck} placeholder="One line under the headline" onChange={(e) => setDeck(e.target.value)} />
              </div>
              <div>
                <label htmlFor="p-cat" className="tf-label tf-field-label">
                  Category
                </label>
                <select id="p-cat" className="tf-field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {draft.galleryBlockId ? (
              <div>
                <label htmlFor="p-cap" className="tf-label tf-field-label">
                  Caption from Instagram
                </label>
                <textarea id="p-cap" className="tf-field" rows={6} maxLength={2200} value={caption} onChange={(e) => setCaption(e.target.value)} style={{ resize: 'vertical' }} />
              </div>
            ) : null}
          </section>

          <section className="tf-panel">
            <h2>04&nbsp;&nbsp;Publish</h2>
            {done ? (
              <div className="tf-alert tf-success" role="status">
                {done === 'published' ? 'Published. ' : 'Saved. '}
                {done === 'published' || draft.status === 'published' ? (
                  <Link href={`/posts/${draft.slug}`} target="_blank">
                    View it on the site ↗
                  </Link>
                ) : (
                  'It stays a draft until you publish it.'
                )}
              </div>
            ) : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              <button className="tf-gold" type="button" disabled={Boolean(busy)} onClick={() => save(true)}>
                {busy === 'publish' ? 'Publishing…' : draft.status === 'published' ? 'Save and keep live' : 'Publish gallery'}
              </button>
              <button className="tf-ghost" type="button" disabled={Boolean(busy)} onClick={() => save(false)}>
                {busy === 'save' ? 'Saving…' : draft.status === 'published' ? 'Save' : 'Save as draft'}
              </button>
              <Link className="tf-ghost" href="/admin">
                Back to posts
              </Link>
            </div>
          </section>
        </>
      ) : null}
    </>
  )
}

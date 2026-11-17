'use client'

import type { JSONContent } from '@tiptap/core'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { sanitizeRichDoc, type StoredBlock } from '@/blocks'
import { RichEditor } from '@/components/editor/rich-editor'
import { slugify } from '@/domain/slug'
import { mediaUrl } from '@/lib/media-url'
import { createClient } from '@/lib/supabase/browser'
import { ACCEPT, parseEmbed, uploadMedia } from '@/lib/upload'
import { deletePostAction, setPostStatusAction, updatePostAction } from '@/server/actions/posts'

export interface EditorMedia {
  path: string
  kind: 'image' | 'video'
  alt: string
}

interface EditorPost {
  id: string
  slug: string
  title: string
  deck: string
  status: string
  kind: string
  categoryId: string
  coverMediaId: string | null
  sourceUrl: string | null
  pricesCheckedOn: string | null
  priceSources: string
  published: boolean
  blocks: StoredBlock[]
}

interface Props {
  post: EditorPost
  tagIds: string[]
  categories: { id: string; name: string }[]
  tags: { id: string; slug: string; name: string }[]
  media: Record<string, EditorMedia>
}

type Data = Record<string, unknown>
const uuid = () => crypto.randomUUID()

function captionToDoc(caption: string): JSONContent {
  const paragraphs = caption
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  return {
    type: 'doc',
    content: paragraphs.length
      ? paragraphs.map((p) => ({
          type: 'paragraph',
          content: p.split('\n').flatMap((line, i) => (i === 0 ? [{ type: 'text', text: line }] : [{ type: 'hardBreak' }, { type: 'text', text: line }])).filter((n) => n.type !== 'text' || n.text),
        }))
      : [{ type: 'paragraph' }],
  }
}

function Thumb({ m, alt }: { m: EditorMedia | undefined; alt?: string }) {
  if (!m) return <div style={{ aspectRatio: '4 / 5', background: 'var(--panel-hi)' }} />
  return m.kind === 'video' ? (
    <video src={mediaUrl(m.path)} muted playsInline preload="metadata" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
    <img src={mediaUrl(m.path)} alt={alt ?? m.alt} />
  )
}

/* ---------------------------------------------------------------- block editors */

function GalleryEditor({
  data,
  media,
  onChange,
  onUploaded,
  onCaptionToText,
}: {
  data: Data
  media: Record<string, EditorMedia>
  onChange: (d: Data) => void
  onUploaded: (id: string, m: EditorMedia) => void
  onCaptionToText: () => void
}) {
  const ids = (data.mediaIds as string[]) ?? []
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const move = (i: number, step: number) => {
    const next = [...ids]
    const j = i + step
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    onChange({ ...data, mediaIds: next })
  }
  async function add(files: File[]) {
    setBusy(true)
    setError('')
    try {
      const added: string[] = []
      for (const f of files) {
        const m = await uploadMedia(f)
        onUploaded(m.mediaId, { path: m.path, kind: m.kind, alt: m.alt })
        added.push(m.mediaId)
      }
      onChange({ ...data, mediaIds: [...ids, ...added].slice(0, 20) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="tf-slide-grid">
        {ids.map((id, i) => (
          <div key={id} className="tf-slide">
            <Thumb m={media[id]} alt={`Slide ${i + 1}`} />
            <div className="tf-slide-tools">
              <button type="button" aria-label="Move earlier" onClick={() => move(i, -1)} disabled={i === 0}>
                ←
              </button>
              <span className="tf-note" style={{ fontSize: 12, alignSelf: 'center' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <button type="button" aria-label="Move later" onClick={() => move(i, 1)} disabled={i === ids.length - 1}>
                →
              </button>
              <button type="button" aria-label="Remove slide" onClick={() => ids.length > 1 && onChange({ ...data, mediaIds: ids.filter((x) => x !== id) })} disabled={ids.length <= 1}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="tf-ghost tf-small" disabled={busy || ids.length >= 20} onClick={() => fileInput.current?.click()}>
          {busy ? 'Uploading…' : '+ Add slides'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            if (files.length) void add(files)
          }}
        />
      </div>
      {error ? (
        <div className="tf-alert" role="alert">
          {error}
        </div>
      ) : null}
      <label className="tf-label tf-field-label" htmlFor="gallery-caption">
        Caption under the slides
      </label>
      <textarea id="gallery-caption" className="tf-field" rows={5} maxLength={2200} value={String(data.caption ?? '')} onChange={(e) => onChange({ ...data, caption: e.target.value })} style={{ resize: 'vertical' }} />
      {String(data.caption ?? '').trim() ? (
        <button type="button" className="tf-ghost tf-small" style={{ alignSelf: 'flex-start' }} onClick={onCaptionToText}>
          Move caption into a rich text section ↓
        </button>
      ) : null}
    </>
  )
}

function VerdictEditor({ data, onChange }: { data: Data; onChange: (d: Data) => void }) {
  const reasons = (data.reasons as string[]) ?? ['']
  const runnerUp = (data.runnerUp as { name: string; line: string } | null) ?? null
  const set = (k: string, v: unknown) => onChange({ ...data, [k]: v })
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        <input className="tf-field" placeholder="Label, e.g. The Tallyfield verdict" value={String(data.eyebrow ?? '')} maxLength={80} onChange={(e) => set('eyebrow', e.target.value)} />
        <input className="tf-field" placeholder="The pick, e.g. Santos Medium" value={String(data.pick ?? '')} maxLength={80} onChange={(e) => set('pick', e.target.value)} />
        <input className="tf-field" type="number" min={1} placeholder="India price ₹ (optional)" value={data.priceInr == null ? '' : String(data.priceInr)} onChange={(e) => set('priceInr', e.target.value ? Math.round(Number(e.target.value)) : null)} />
      </div>
      <input className="tf-field" placeholder="One-line summary (optional)" value={String(data.summary ?? '')} maxLength={160} onChange={(e) => set('summary', e.target.value)} />
      <span className="tf-label">Reasons (up to 5)</span>
      {reasons.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 6 }}>
          <input className="tf-field" value={r} maxLength={200} placeholder={`Reason ${i + 1}`} onChange={(e) => set('reasons', reasons.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" className="tf-ghost tf-small" disabled={reasons.length <= 1} onClick={() => set('reasons', reasons.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      {reasons.length < 5 ? (
        <button type="button" className="tf-ghost tf-small" style={{ alignSelf: 'flex-start' }} onClick={() => set('reasons', [...reasons, ''])}>
          + Reason
        </button>
      ) : null}
      <input className="tf-field" placeholder="The one drawback (required)" value={String(data.drawback ?? '')} maxLength={200} onChange={(e) => set('drawback', e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        <input className="tf-field" placeholder="Runner-up (optional)" value={runnerUp?.name ?? ''} maxLength={80} onChange={(e) => set('runnerUp', e.target.value ? { name: e.target.value, line: runnerUp?.line ?? '' } : null)} />
        <input className="tf-field" placeholder="Runner-up line" disabled={!runnerUp} value={runnerUp?.line ?? ''} maxLength={200} onChange={(e) => runnerUp && set('runnerUp', { ...runnerUp, line: e.target.value })} />
      </div>
    </div>
  )
}

const BLOCK_NAMES: Record<string, string> = {
  rich_text: 'Rich text',
  gallery: 'Slide gallery',
  verdict: 'Verdict',
  instagram_embed: 'Instagram post',
  heading: 'Heading',
  text: 'Text',
  image: 'Image',
  spec_table: 'Spec table',
  price_table: 'Price table',
}

/* ---------------------------------------------------------------- the editor */

export function PostEditor({ post, tagIds: initialTagIds, categories, tags: initialTags, media: initialMedia }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(post.title)
  const [deck, setDeck] = useState(post.deck)
  const [slug, setSlug] = useState(post.slug)
  const [slugTouched, setSlugTouched] = useState(post.published || post.slug !== slugify(post.title))
  const [categoryId, setCategoryId] = useState(post.categoryId)
  const [tagIds, setTagIds] = useState(initialTagIds)
  const [tags, setTags] = useState(initialTags)
  const [newTag, setNewTag] = useState('')
  const [coverMediaId, setCoverMediaId] = useState(post.coverMediaId)
  const [pricesCheckedOn, setPricesCheckedOn] = useState(post.pricesCheckedOn ?? '')
  const [priceSources, setPriceSources] = useState(post.priceSources)
  const [blocks, setBlocks] = useState<StoredBlock[]>(post.blocks)
  const [media, setMedia] = useState(initialMedia)
  const [status, setStatus] = useState(post.status)
  const [published, setPublished] = useState(post.published)
  const [busy, setBusy] = useState<'' | 'save' | 'publish' | 'unpublish' | 'delete'>('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [igLink, setIgLink] = useState('')
  const coverInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const touch = () => {
    setDirty(true)
    setMessage(null)
  }
  const effectiveSlug = slugTouched ? slug : slugify(title) || slug
  const rememberMedia = (id: string, m: EditorMedia) => setMedia((all) => ({ ...all, [id]: m }))

  /** Every image used in the post, for picking the cover. */
  const imagesInPost = useMemo(() => {
    const ids: string[] = []
    const walk = (n: unknown) => {
      if (!n || typeof n !== 'object') return
      const o = n as { type?: string; attrs?: { mediaId?: string; kind?: string }; content?: unknown[] }
      if (o.type === 'media' && o.attrs?.mediaId && o.attrs.kind === 'image') ids.push(o.attrs.mediaId)
      o.content?.forEach(walk)
    }
    for (const b of blocks) {
      const d = b.data as Data
      if (Array.isArray(d.mediaIds)) ids.push(...(d.mediaIds as string[]))
      if (typeof d.mediaId === 'string') ids.push(d.mediaId)
      if (b.type === 'rich_text') walk(d.doc)
    }
    if (coverMediaId) ids.unshift(coverMediaId)
    return [...new Set(ids)].filter((id) => media[id]?.kind === 'image')
  }, [blocks, coverMediaId, media])

  function updateBlock(id: string, data: Data) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, data } : b)))
    touch()
  }
  function moveBlock(i: number, step: number) {
    setBlocks((bs) => {
      const j = i + step
      if (j < 0 || j >= bs.length) return bs
      const next = [...bs]
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
    touch()
  }
  function removeBlock(id: string) {
    if (!window.confirm('Remove this section?')) return
    setBlocks((bs) => bs.filter((b) => b.id !== id))
    touch()
  }
  function addBlock(type: string, after?: number, data?: Data) {
    const defaults: Record<string, Data> = {
      rich_text: { doc: { type: 'doc', content: [{ type: 'paragraph' }] } },
      gallery: { mediaIds: [], caption: '' },
      verdict: { eyebrow: 'The Tallyfield verdict', pick: '', priceInr: null, summary: '', mediaId: null, reasons: [''], drawback: '', runnerUp: null },
    }
    const block: StoredBlock = { id: uuid(), type, data: data ?? defaults[type] ?? {} }
    setBlocks((bs) => {
      const next = [...bs]
      next.splice(after === undefined ? next.length : after + 1, 0, block)
      return next
    })
    touch()
  }

  async function createTag() {
    const name = newTag.trim()
    if (!name) return
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (!tagIds.includes(existing.id)) setTagIds([...tagIds, existing.id])
      setNewTag('')
      touch()
      return
    }
    const { data, error } = await createClient().from('tags').insert({ name: name.slice(0, 60), slug: slugify(name) }).select('id, slug, name').single()
    if (error || !data) {
      setMessage({ kind: 'error', text: `Could not add the tag: ${error?.message ?? 'unknown error'}` })
      return
    }
    setTags([...tags, data as { id: string; slug: string; name: string }].sort((a, b) => a.name.localeCompare(b.name)))
    setTagIds([...tagIds, (data as { id: string }).id])
    setNewTag('')
    touch()
  }

  function buildBody() {
    return {
      version: 1 as const,
      blocks: blocks
        .map((b) => (b.type === 'rich_text' ? { ...b, data: { doc: sanitizeRichDoc((b.data as Data).doc) } } : b))
        .filter((b) => !(b.type === 'gallery' && ((b.data as Data).mediaIds as string[]).length === 0)),
    }
  }

  async function save(next?: 'published' | 'draft'): Promise<boolean> {
    setMessage(null)
    const result = await updatePostAction({
      id: post.id,
      title,
      deck,
      ...(published ? {} : { slug: effectiveSlug }),
      categoryId,
      tagIds,
      coverMediaId,
      body: buildBody(),
      pricesCheckedOn: pricesCheckedOn || null,
      priceSources,
    })
    if (!result.ok) {
      const firstField = result.error.fields ? Object.entries(result.error.fields)[0] : undefined
      setMessage({ kind: 'error', text: firstField ? `${result.error.message} (${firstField[0]}: ${firstField[1][0]})` : result.error.message })
      return false
    }
    setSlug(result.data.slug)
    if (next) {
      const s = await setPostStatusAction({ id: post.id, status: next })
      if (!s.ok) {
        setMessage({ kind: 'error', text: s.error.message })
        return false
      }
      setStatus(next)
      if (next === 'published') setPublished(true)
    }
    setDirty(false)
    setMessage({ kind: 'ok', text: next === 'published' ? 'Published.' : next === 'draft' ? 'Unpublished. It is a draft again.' : 'Saved.' })
    router.refresh()
    return true
  }

  async function run(kind: 'save' | 'publish' | 'unpublish') {
    setBusy(kind)
    try {
      await save(kind === 'publish' ? 'published' : kind === 'unpublish' ? 'draft' : undefined)
    } finally {
      setBusy('')
    }
  }

  async function remove() {
    if (!window.confirm('Delete this post permanently? This cannot be undone.')) return
    setBusy('delete')
    const result = await deletePostAction({ id: post.id })
    setBusy('')
    if (!result.ok) {
      setMessage({ kind: 'error', text: result.error.message })
      return
    }
    setDirty(false)
    router.push('/admin')
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="tf-status" data-status={status}>
            {status}
          </span>
          {dirty ? <span className="tf-note" style={{ fontSize: 13 }}>Unsaved changes</span> : null}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {published ? (
            <Link className="tf-ghost" href={`/posts/${slug}`} target="_blank">
              View ↗
            </Link>
          ) : null}
          <button type="button" className="tf-ghost" disabled={Boolean(busy)} onClick={() => void run('save')}>
            {busy === 'save' ? 'Saving…' : 'Save'}
          </button>
          {status === 'published' ? (
            <button type="button" className="tf-ghost" disabled={Boolean(busy)} onClick={() => void run('unpublish')}>
              {busy === 'unpublish' ? '…' : 'Unpublish'}
            </button>
          ) : null}
          <button type="button" className="tf-gold" disabled={Boolean(busy)} onClick={() => void run('publish')}>
            {busy === 'publish' ? 'Publishing…' : status === 'published' ? 'Save and keep live' : 'Publish'}
          </button>
        </div>
      </div>

      {message ? (
        <div className={`tf-alert${message.kind === 'ok' ? ' tf-success' : ''}`} role={message.kind === 'ok' ? 'status' : 'alert'}>
          {message.text}{' '}
          {message.kind === 'ok' && published ? (
            <Link href={`/posts/${slug}`} target="_blank">
              View it on the site ↗
            </Link>
          ) : null}
        </div>
      ) : null}

      <section className="tf-panel">
        <h2>Headline and details</h2>
        <div>
          <label htmlFor="ed-title" className="tf-label tf-field-label">
            Headline
          </label>
          <input
            id="ed-title"
            className="tf-field"
            style={{ fontSize: 20, fontWeight: 700 }}
            maxLength={160}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              touch()
            }}
          />
          <p className="tf-note" style={{ fontSize: 12, marginTop: 6 }}>
            {title.length}/160 · {title.length > 50 ? 'Shorter headlines look better on the site.' : 'Good length.'}
          </p>
        </div>
        <div>
          <label htmlFor="ed-deck" className="tf-label tf-field-label">
            Deck line (one line under the headline)
          </label>
          <input
            id="ed-deck"
            className="tf-field"
            maxLength={300}
            value={deck}
            onChange={(e) => {
              setDeck(e.target.value)
              touch()
            }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div>
            <label htmlFor="ed-cat" className="tf-label tf-field-label">
              Category
            </label>
            <select
              id="ed-cat"
              className="tf-field"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value)
                touch()
              }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ed-slug" className="tf-label tf-field-label">
              Web address
            </label>
            <input
              id="ed-slug"
              className="tf-field"
              value={effectiveSlug}
              readOnly={published}
              title={published ? 'The address of a published post never changes, so shared links keep working.' : undefined}
              style={published ? { color: 'var(--grey-2)' } : undefined}
              onChange={(e) => {
                setSlug(slugify(e.target.value) || e.target.value.toLowerCase())
                setSlugTouched(true)
                touch()
              }}
            />
          </div>
          <div>
            <label htmlFor="ed-prices" className="tf-label tf-field-label">
              Prices checked on (optional)
            </label>
            <input
              id="ed-prices"
              className="tf-field"
              type="date"
              value={pricesCheckedOn}
              onChange={(e) => {
                setPricesCheckedOn(e.target.value)
                touch()
              }}
            />
          </div>
          <div>
            <label htmlFor="ed-sources" className="tf-label tf-field-label">
              Price sources (optional)
            </label>
            <input
              id="ed-sources"
              className="tf-field"
              maxLength={300}
              placeholder="e.g. Justintime, Ethos"
              value={priceSources}
              onChange={(e) => {
                setPriceSources(e.target.value)
                touch()
              }}
            />
          </div>
        </div>
        <div>
          <span className="tf-label tf-field-label">Tags</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {tags.map((t) => {
              const on = tagIds.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  className="tf-chip"
                  aria-pressed={on}
                  onClick={() => {
                    setTagIds(on ? tagIds.filter((x) => x !== t.id) : [...tagIds, t.id].slice(0, 20))
                    touch()
                  }}
                >
                  {on ? '✓ ' : ''}
                  {t.name}
                </button>
              )
            })}
            <form
              style={{ display: 'flex', gap: 4 }}
              onSubmit={(e) => {
                e.preventDefault()
                void createTag()
              }}
            >
              <input className="tf-field" style={{ minHeight: 30, width: 150, fontSize: 13, padding: '4px 8px' }} placeholder="New tag" value={newTag} maxLength={60} onChange={(e) => setNewTag(e.target.value)} />
              <button type="submit" className="tf-ghost tf-small">
                Add
              </button>
            </form>
          </div>
        </div>
        {post.sourceUrl ? (
          <p className="tf-note" style={{ fontSize: 13 }}>
            Imported from{' '}
            <a href={post.sourceUrl} target="_blank" rel="noreferrer">
              Instagram ↗
            </a>
          </p>
        ) : null}
      </section>

      <section className="tf-panel">
        <h2>Cover image</h2>
        <div className="tf-slide-grid">
          {imagesInPost.map((id) => (
            <button
              key={id}
              type="button"
              className="tf-thumb"
              aria-pressed={coverMediaId === id}
              aria-label="Use as cover"
              onClick={() => {
                setCoverMediaId(id)
                touch()
              }}
            >
              <span className="tf-slide" style={{ display: 'block', border: 0 }}>
                <Thumb m={media[id]} />
              </span>
              {coverMediaId === id ? (
                <span style={{ position: 'absolute', top: 0, left: 0, padding: '3px 7px', background: 'var(--gold)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--on-gold)' }}>COVER</span>
              ) : null}
            </button>
          ))}
          <button type="button" className="tf-ghost" style={{ aspectRatio: '4 / 5', height: 'auto' }} onClick={() => coverInput.current?.click()}>
            + Upload
          </button>
          <input
            ref={coverInput}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              try {
                const m = await uploadMedia(file)
                rememberMedia(m.mediaId, { path: m.path, kind: m.kind, alt: m.alt })
                setCoverMediaId(m.mediaId)
                touch()
              } catch (err) {
                setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Upload failed.' })
              }
            }}
          />
        </div>
      </section>

      <section style={{ display: 'grid', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 16, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-cream)' }}>Content</h2>
        {blocks.length === 0 ? <p className="tf-note">No sections yet. Add one below.</p> : null}
        {blocks.map((b, i) => (
          <div key={b.id} className="tf-block">
            <div className="tf-block-head">
              <span className="tf-label">{BLOCK_NAMES[b.type] ?? b.type}</span>
              <span style={{ display: 'flex', gap: 4 }}>
                <button type="button" className="tf-ghost tf-small" aria-label="Move up" disabled={i === 0} onClick={() => moveBlock(i, -1)}>
                  ↑
                </button>
                <button type="button" className="tf-ghost tf-small" aria-label="Move down" disabled={i === blocks.length - 1} onClick={() => moveBlock(i, 1)}>
                  ↓
                </button>
                <button type="button" className="tf-ghost tf-small" aria-label="Add text below" onClick={() => addBlock('rich_text', i)}>
                  + Text
                </button>
                <button type="button" className="tf-ghost tf-small" aria-label="Remove section" onClick={() => removeBlock(b.id)}>
                  ✕
                </button>
              </span>
            </div>
            <div className="tf-block-body">
              {b.type === 'rich_text' ? (
                <RichEditor
                  initial={(b.data as Data).doc as JSONContent}
                  onChange={(doc) => updateBlock(b.id, { doc })}
                  onUploaded={(id, path, kind) => rememberMedia(id, { path, kind, alt: '' })}
                />
              ) : b.type === 'gallery' ? (
                <GalleryEditor
                  data={b.data as Data}
                  media={media}
                  onChange={(d) => updateBlock(b.id, d)}
                  onUploaded={rememberMedia}
                  onCaptionToText={() => {
                    const caption = String((b.data as Data).caption ?? '')
                    updateBlock(b.id, { ...(b.data as Data), caption: '' })
                    addBlock('rich_text', i, { doc: captionToDoc(caption) })
                  }}
                />
              ) : b.type === 'verdict' ? (
                <VerdictEditor data={b.data as Data} onChange={(d) => updateBlock(b.id, d)} />
              ) : b.type === 'heading' ? (
                <input className="tf-field" value={String((b.data as Data).text ?? '')} maxLength={120} onChange={(e) => updateBlock(b.id, { ...(b.data as Data), text: e.target.value })} />
              ) : b.type === 'text' ? (
                <textarea className="tf-field" rows={6} value={String((b.data as Data).text ?? '')} maxLength={5000} onChange={(e) => updateBlock(b.id, { text: e.target.value })} />
              ) : b.type === 'instagram_embed' ? (
                <p className="tf-note">{String((b.data as Data).permalink ?? '')}</p>
              ) : (
                <p className="tf-note">This section type is shown on the site as it is. It can be moved or removed here.</p>
              )}
            </div>
          </div>
        ))}

        <div className="tf-panel" style={{ gap: 10 }}>
          <span className="tf-label">Add a section</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="tf-ghost tf-small" onClick={() => addBlock('rich_text')}>
              + Rich text
            </button>
            <button type="button" className="tf-ghost tf-small" onClick={() => addBlock('gallery')}>
              + Slide gallery
            </button>
            <button type="button" className="tf-ghost tf-small" onClick={() => addBlock('verdict')}>
              + Verdict
            </button>
          </div>
          <form
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault()
              const parsed = parseEmbed(igLink)
              if (parsed?.provider !== 'instagram') {
                setMessage({ kind: 'error', text: 'Paste an Instagram post or Reel link.' })
                return
              }
              addBlock('instagram_embed', undefined, { permalink: parsed.id })
              setIgLink('')
            }}
          >
            <input className="tf-field" style={{ flex: '1 1 260px' }} placeholder="Instagram post link to embed as it appears on Instagram" value={igLink} onChange={(e) => setIgLink(e.target.value)} />
            <button type="submit" className="tf-ghost tf-small">
              + Instagram embed
            </button>
          </form>
        </div>
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, paddingTop: 8, borderTop: '1px solid var(--rule-dark)' }}>
        <button type="button" className="tf-ghost tf-small" disabled={Boolean(busy)} onClick={() => void remove()} style={{ borderColor: 'var(--warn)' }}>
          {busy === 'delete' ? 'Deleting…' : 'Delete post'}
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="tf-ghost" disabled={Boolean(busy)} onClick={() => void run('save')}>
            Save
          </button>
          <button type="button" className="tf-gold" disabled={Boolean(busy)} onClick={() => void run('publish')}>
            {status === 'published' ? 'Save and keep live' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}

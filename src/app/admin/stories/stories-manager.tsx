'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ACCEPT, uploadMedia, type UploadedMedia } from '@/lib/upload'
import { createStoryAction, deleteStoryAction, updateStoryAction } from '@/server/actions/stories'
import { mediaUrl } from '@/lib/media-url'

export interface AdminStory {
  id: string
  src: string
  kind: 'image' | 'video'
  caption: string
  linkUrl: string | null
  linkLabel: string
  durationMs: number
  position: number
  status: string
  expiresAt: string | null
}

const LIFETIMES = [
  { label: '24 hours', hours: 24 },
  { label: '7 days', hours: 24 * 7 },
  { label: '30 days', hours: 24 * 30 },
  { label: 'Until I remove it', hours: null },
] as const

function timeLeft(iso: string | null): string {
  if (!iso) return 'Stays until removed'
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3_600_000)
  return h >= 48 ? `${Math.floor(h / 24)} days left` : h >= 1 ? `${h} h left` : `${Math.ceil(ms / 60_000)} min left`
}

export function StoriesManager({ stories, posts }: { stories: AdminStory[]; posts: { slug: string; title: string }[] }) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<UploadedMedia | null>(null)
  const [caption, setCaption] = useState('')
  const [link, setLink] = useState('')
  const [customLink, setCustomLink] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [seconds, setSeconds] = useState(6)
  const [lifetime, setLifetime] = useState<number | null>(24)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function take(files: File[]) {
    const f = files.find((x) => x.type.startsWith('image/') || x.type.startsWith('video/'))
    if (!f) return
    setBusy('upload')
    setError('')
    try {
      setFile(await uploadMedia(f))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setBusy('')
    }
  }

  // Paste a screenshot anywhere on this page to start a story.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const files = [...(e.clipboardData?.files ?? [])]
      if (files.length) {
        e.preventDefault()
        void take(files)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  async function create(status: 'published' | 'draft') {
    if (!file) return
    setBusy(status)
    setError('')
    const linkUrl = link === 'custom' ? customLink.trim() || null : link || null
    const result = await createStoryAction({
      mediaId: file.mediaId,
      caption,
      linkUrl,
      linkLabel,
      durationMs: Math.round(seconds * 1000),
      expiresInHours: lifetime,
      status,
    })
    setBusy('')
    if (!result.ok) {
      setError(result.error.fields ? Object.values(result.error.fields)[0]?.[0] ?? result.error.message : result.error.message)
      return
    }
    setFile(null)
    setCaption('')
    setLink('')
    setCustomLink('')
    setLinkLabel('')
    setNotice(status === 'published' ? 'Story is live on the homepage.' : 'Saved as a draft.')
    router.refresh()
  }

  async function update(id: string, values: Record<string, unknown>) {
    setBusy(id)
    const result = await updateStoryAction({ id, ...values })
    setBusy('')
    if (!result.ok) setError(result.error.message)
    else router.refresh()
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this story?')) return
    setBusy(id)
    const result = await deleteStoryAction({ id })
    setBusy('')
    if (!result.ok) setError(result.error.message)
    else router.refresh()
  }

  async function move(i: number, step: number) {
    const a = stories[i]
    const b = stories[i + step]
    if (!a || !b) return
    setBusy(a.id)
    await updateStoryAction({ id: a.id, position: b.position })
    await updateStoryAction({ id: b.id, position: a.position === b.position ? a.position + step : a.position })
    setBusy('')
    router.refresh()
  }

  return (
    <>
      <section className="tf-panel">
        <h2>New story</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 220px) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              void take([...e.dataTransfer.files])
            }}
            onClick={() => fileInput.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput.current?.click()}
            style={{ aspectRatio: '9 / 16', border: '1px dashed var(--stroke)', background: 'var(--bg)', display: 'grid', placeItems: 'center', cursor: 'pointer', overflow: 'hidden', textAlign: 'center', padding: file ? 0 : 12 }}
          >
            {file ? (
              file.kind === 'video' ? (
                <video src={mediaUrl(file.path)} muted autoPlay loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- preview of the upload
                <img src={mediaUrl(file.path)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )
            ) : (
              <span className="tf-note" style={{ fontSize: 13 }}>
                {busy === 'upload' ? 'Uploading…' : 'Drop a photo or video, paste a screenshot (Cmd+V), or click to choose'}
              </span>
            )}
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT}
              hidden
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const files = [...(e.target.files ?? [])]
                e.target.value = ''
                void take(files)
              }}
            />
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label className="tf-label tf-field-label" htmlFor="st-cap">
                Caption (optional)
              </label>
              <input id="st-cap" className="tf-field" maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. New verdict is up 🔥" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label className="tf-label tf-field-label" htmlFor="st-link">
                  Button links to
                </label>
                <select id="st-link" className="tf-field" value={link} onChange={(e) => setLink(e.target.value)}>
                  <option value="">No button</option>
                  {posts.map((p) => (
                    <option key={p.slug} value={`/posts/${p.slug}`}>
                      {p.title.slice(0, 70)}
                    </option>
                  ))}
                  <option value="custom">Another link…</option>
                </select>
              </div>
              <div>
                <label className="tf-label tf-field-label" htmlFor="st-label">
                  Button text
                </label>
                <input id="st-label" className="tf-field" maxLength={40} disabled={!link} value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Read the verdict" />
              </div>
            </div>
            {link === 'custom' ? <input className="tf-field" value={customLink} onChange={(e) => setCustomLink(e.target.value)} placeholder="https://…" /> : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label className="tf-label tf-field-label" htmlFor="st-sec">
                  Seconds on screen (photos)
                </label>
                <input id="st-sec" className="tf-field" type="number" min={2} max={60} value={seconds} onChange={(e) => setSeconds(Math.min(60, Math.max(2, Number(e.target.value) || 6)))} />
              </div>
              <div>
                <label className="tf-label tf-field-label" htmlFor="st-life">
                  Disappears after
                </label>
                <select id="st-life" className="tf-field" value={lifetime === null ? 'keep' : String(lifetime)} onChange={(e) => setLifetime(e.target.value === 'keep' ? null : Number(e.target.value))}>
                  {LIFETIMES.map((l) => (
                    <option key={l.label} value={l.hours === null ? 'keep' : String(l.hours)}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {error ? (
              <div className="tf-alert" role="alert">
                {error}
              </div>
            ) : null}
            {notice ? (
              <div className="tf-alert tf-success" role="status">
                {notice}
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="tf-gold" disabled={!file || Boolean(busy)} onClick={() => void create('published')}>
                {busy === 'published' ? 'Publishing…' : 'Publish story'}
              </button>
              <button type="button" className="tf-ghost" disabled={!file || Boolean(busy)} onClick={() => void create('draft')}>
                Save as draft
              </button>
              {file ? (
                <button type="button" className="tf-ghost" onClick={() => setFile(null)}>
                  Choose another
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-cream)' }}>Your stories</h2>
        {stories.length === 0 ? <p className="tf-note">No stories yet.</p> : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14 }}>
          {stories.map((s, i) => (
            <div key={s.id} className="tf-block" style={{ opacity: busy === s.id ? 0.5 : 1 }}>
              <div style={{ aspectRatio: '9 / 16', background: '#000', overflow: 'hidden' }}>
                {s.kind === 'video' ? (
                  <video src={`${s.src}#t=0.1`} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                  <img src={s.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
              <div style={{ padding: 10, display: 'grid', gap: 6 }}>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="tf-status" data-status={s.status}>
                    {s.status}
                  </span>
                  <span className="tf-note" style={{ fontSize: 12 }}>
                    {timeLeft(s.expiresAt)}
                  </span>
                </span>
                {s.caption ? <span style={{ fontSize: 13, color: 'var(--ink-cream)' }}>{s.caption}</span> : null}
                <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button type="button" className="tf-ghost tf-small" disabled={i === 0} aria-label="Move earlier" onClick={() => void move(i, -1)}>
                    ←
                  </button>
                  <button type="button" className="tf-ghost tf-small" disabled={i === stories.length - 1} aria-label="Move later" onClick={() => void move(i, 1)}>
                    →
                  </button>
                  {s.status === 'published' ? (
                    <button type="button" className="tf-ghost tf-small" onClick={() => void update(s.id, { status: 'draft' })}>
                      Hide
                    </button>
                  ) : (
                    <button type="button" className="tf-gold tf-small" onClick={() => void update(s.id, { status: 'published', expiresInHours: 24 })}>
                      Publish 24 h
                    </button>
                  )}
                  <button type="button" className="tf-ghost tf-small" aria-label="Delete story" onClick={() => void remove(s.id)}>
                    ✕
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

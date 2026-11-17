'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'

export interface Story {
  id: string
  src: string
  kind: 'image' | 'video'
  alt: string
  caption: string
  linkUrl: string | null
  linkLabel: string
  durationMs: number
}

const SEEN_KEY = 'tf-stories-seen'

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}
function markSeen(id: string) {
  try {
    const seen = readSeen()
    seen.add(id)
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200)))
  } catch {
    // Storage can be unavailable (private mode); seen rings are a nicety only.
  }
}

/** The full-screen viewer: progress bars, tap to move, hold to pause, swipe down or Esc to close. */
function Viewer({ stories, start, onClose }: { stories: Story[]; start: number; onClose: (lastSeen: number) => void }) {
  const [index, setIndex] = useState(start)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(true)
  const video = useRef<HTMLVideoElement>(null)
  const press = useRef<{ x: number; y: number; t: number } | null>(null)
  const story = stories[index]!

  const go = useCallback(
    (step: number) => {
      const next = index + step
      if (next < 0) {
        setProgress(0)
        return
      }
      if (next >= stories.length) {
        onClose(index)
        return
      }
      setIndex(next)
      setProgress(0)
    },
    [index, stories.length, onClose],
  )

  useEffect(() => {
    markSeen(story.id)
  }, [story.id])

  // Images advance on a timer; videos follow their own playback.
  useEffect(() => {
    if (story.kind === 'video' || paused) return
    const started = performance.now() - progress * story.durationMs
    let frame = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - started) / story.durationMs)
      setProgress(p)
      if (p >= 1) go(1)
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // progress is read once when (re)starting the timer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused, story.kind, story.durationMs, go])

  useEffect(() => {
    const v = video.current
    if (!v) return
    if (paused) v.pause()
    else void v.play().catch(() => undefined)
  }, [paused, index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(index)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === ' ') {
        e.preventDefault()
        setPaused((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [go, index, onClose])

  function onDown(e: PointerEvent<HTMLDivElement>) {
    press.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    setPaused(true)
  }
  function onUp(e: PointerEvent<HTMLDivElement>) {
    const p = press.current
    press.current = null
    setPaused(false)
    if (!p) return
    const dy = e.clientY - p.y
    const dx = e.clientX - p.x
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) return onClose(index)
    if (Date.now() - p.t > 350 && Math.abs(dx) < 10) return // a hold, not a tap
    if (Math.abs(dx) > 50) return go(dx < 0 ? 1 : -1)
    const rect = e.currentTarget.getBoundingClientRect()
    go(e.clientX - rect.left < rect.width * 0.33 ? -1 : 1)
  }

  return (
    <div className="tf-story-overlay" role="dialog" aria-modal="true" aria-label="Stories">
      <div className="tf-story-frame">
        <div className="tf-story-bars" aria-hidden="true">
          {stories.map((s, i) => (
            <span key={s.id}>
              <span style={{ transform: `scaleX(${i < index ? 1 : i > index ? 0 : progress})` }} />
            </span>
          ))}
        </div>
        <div className="tf-story-top">
          <span className="tf-story-brand">TALLYFIELD</span>
          <span style={{ display: 'flex', gap: 6 }}>
            {story.kind === 'video' ? (
              <button type="button" className="tf-story-icon" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((m) => !m)}>
                {muted ? '🔇' : '🔊'}
              </button>
            ) : null}
            <button type="button" className="tf-story-icon" aria-label={paused ? 'Play' : 'Pause'} onClick={() => setPaused((p) => !p)}>
              {paused ? '▶' : '❚❚'}
            </button>
            <button type="button" className="tf-story-icon" aria-label="Close stories" onClick={() => onClose(index)}>
              ✕
            </button>
          </span>
        </div>

        <div className="tf-story-media" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => setPaused(false)}>
          {story.kind === 'video' ? (
            <video
              key={story.id}
              ref={video}
              src={story.src}
              autoPlay
              playsInline
              muted={muted}
              onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
              onEnded={() => go(1)}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- full-bleed story image, already sized for phones
            <img key={story.id} src={story.src} alt={story.alt} draggable={false} />
          )}
        </div>

        {story.caption || story.linkUrl ? (
          <div className="tf-story-foot">
            {story.caption ? <p>{story.caption}</p> : null}
            {story.linkUrl ? (
              story.linkUrl.startsWith('/') ? (
                <Link className="tf-cta" href={story.linkUrl} onClick={() => onClose(index)}>
                  {story.linkLabel || 'Read more'} →
                </Link>
              ) : (
                <a className="tf-cta" href={story.linkUrl} target="_blank" rel="noopener noreferrer nofollow">
                  {story.linkLabel || 'Open'} ↗
                </a>
              )
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** A row of story circles. Unseen stories get a gold ring; seen ones turn grey (remembered in this browser). */
export function StoriesRow({ stories }: { stories: Story[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const [seen, setSeen] = useState<Set<string>>(new Set())

  useEffect(() => {
    const id = requestAnimationFrame(() => setSeen(readSeen()))
    return () => cancelAnimationFrame(id)
  }, [open])

  if (stories.length === 0) return null
  const firstUnseen = Math.max(0, stories.findIndex((s) => !seen.has(s.id)))

  return (
    <section className="tf-wrap tf-stories" aria-label="Stories">
      <button type="button" className="tf-story-ring tf-story-ring-all" onClick={() => setOpen(firstUnseen)} aria-label="Play all stories">
        <span className="tf-story-thumb tf-story-all">▶</span>
        <span className="tf-story-name">Stories</span>
      </button>
      {stories.map((s, i) => (
        <button key={s.id} type="button" className="tf-story-ring" data-seen={seen.has(s.id) ? 'true' : undefined} onClick={() => setOpen(i)} aria-label={`Open story: ${s.caption || s.alt || `story ${i + 1}`}`}>
          <span className="tf-story-thumb">
            {s.kind === 'video' ? (
              <video src={`${s.src}#t=0.1`} muted playsInline preload="metadata" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- tiny circular thumbnail
              <img src={s.src} alt="" loading="lazy" />
            )}
          </span>
          <span className="tf-story-name">{s.caption ? s.caption.slice(0, 14) : `Story ${i + 1}`}</span>
        </button>
      ))}
      {open !== null ? <Viewer stories={stories} start={open} onClose={() => setOpen(null)} /> : null}
    </section>
  )
}

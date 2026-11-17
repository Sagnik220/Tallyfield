'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'

export interface Issue {
  slug: string
  title: string
  deck: string
  label: string
  image: string | null
  imageAlt: string
}

const pad = (n: number) => String(n).padStart(2, '0')
/** Moves on to the next issue after this long without the visitor moving it themselves. */
const AUTO_MS = 7000
const DRAG_THRESHOLD = 6

/**
 * "The issues": a 3D cover-flow of recent posts.
 * Each card is the post's cover slide. Cards sit on a curved track in depth; the track glides with a long
 * eased transition, follows the pointer while dragging, and the front card tilts towards the cursor.
 * Moves to the next card every 7 seconds; any manual move restarts the countdown. It holds while dragging,
 * while a keyboard user is inside it, when it is off screen or the tab is hidden, and when paused with the
 * pause button. People who prefer reduced motion start paused (they can press play).
 */
function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const reducedNow = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function IssuesCarousel({ issues }: { issues: Issue[] }) {
  const count = issues.length
  // The track always has at least 5 slots (short lists repeat), so the card that wraps from one end to the
  // other does so out of sight instead of sliding across the front.
  const slots = count < 2 ? count : count * Math.ceil(5 / count)
  const [active, setActive] = useState(0) // slot index
  const [held, setHeld] = useState(false) // keyboard focus inside
  const [userPaused, setUserPaused] = useState<boolean | null>(null)
  const [onScreen, setOnScreen] = useState(true)
  const [tabVisible, setTabVisible] = useState(true)
  const reduced = useSyncExternalStore(subscribeReduced, reducedNow, () => false)
  const [drag, setDrag] = useState(0) // fractional cards moved during a drag
  const [dragging, setDragging] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const stage = useRef<HTMLDivElement>(null)
  const pointer = useRef<{ x: number; width: number; moved: boolean } | null>(null)
  const justDragged = useRef(false)

  const go = useCallback((step: number) => setActive((a) => (((a + step) % slots) + slots) % slots), [slots])

  const paused = userPaused ?? reduced
  const running = count > 1 && !paused && !held && !dragging && onScreen && tabVisible

  // One countdown per card: changing card (by hand or automatically) starts a fresh 7 seconds.
  useEffect(() => {
    if (!running) return
    const timer = window.setTimeout(() => go(1), AUTO_MS)
    return () => window.clearTimeout(timer)
  }, [running, active, go])

  useEffect(() => {
    const el = stage.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setOnScreen(Boolean(entry?.isIntersecting)), { threshold: 0.25 })
    io.observe(el)
    const onVis = () => setTabVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  if (count === 0) return null
  const shown = active % count
  const current = issues[shown] ?? issues[0]!
  const reach = count >= 5 ? 2 : 1 // how many cards show on each side

  /** Signed distance of slot i from the front, wrapped round the loop, including any drag in progress. */
  function offsetOf(i: number) {
    let off = i - active
    if (off > slots / 2) off -= slots
    if (off < -slots / 2) off += slots
    return off + drag
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (count < 2 || e.button !== 0) return
    const card = stage.current?.querySelector<HTMLElement>('[data-front="true"]')
    pointer.current = { x: e.clientX, width: card?.offsetWidth ?? 380, moved: false }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const p = pointer.current
    if (!p) {
      // Not dragging: tilt the front card towards the cursor.
      const rect = stage.current?.getBoundingClientRect()
      if (!rect || e.pointerType !== 'mouse') return
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      setTilt({ x: -y * 8, y: x * 12 })
      return
    }
    const dx = e.clientX - p.x
    if (!p.moved && Math.abs(dx) < DRAG_THRESHOLD) return
    if (!p.moved) {
      p.moved = true
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    setDrag(Math.max(-1.5, Math.min(1.5, dx / (p.width * 0.75))))
  }

  function endDrag() {
    const p = pointer.current
    pointer.current = null
    if (!p?.moved) return
    justDragged.current = true
    window.setTimeout(() => (justDragged.current = false), 0)
    const step = Math.round(-drag)
    setDragging(false)
    setDrag(0)
    if (step !== 0) go(step)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(-1)
    }
  }

  return (
    <>
      <div className="tf-wrap tf-reveal" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px 48px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="tf-eyebrow">The issues</div>
          <h2 className="tf-display" style={{ fontSize: 'var(--t-h2)' }}>
            Pick a comparison.
          </h2>
        </div>
        {count > 1 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 64 }}>
              <div aria-live={running ? 'off' : 'polite'} style={{ fontSize: 'var(--t-small)', fontWeight: 700, color: 'var(--grey-2)', fontVariantNumeric: 'tabular-nums' }}>
                {pad(shown + 1)} / {pad(count)}
              </div>
              <span className="tf-flow-progress" aria-hidden="true">
                <span key={`${active}-${String(running)}`} data-running={running ? 'true' : undefined} style={{ animationDuration: `${AUTO_MS}ms` }} />
              </span>
            </div>
            <button className="tf-btn tf-flow-play" type="button" aria-label={paused ? 'Play: move through the issues automatically' : 'Pause automatic scrolling'} aria-pressed={paused} onClick={() => setUserPaused(!paused)}>
              {paused ? '▶' : '❚❚'}
            </button>
            <button className="tf-btn" type="button" aria-label="Previous issue" onClick={() => go(-1)}>
              ←
            </button>
            <button className="tf-btn" type="button" aria-label="Next issue" onClick={() => go(1)}>
              →
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={stage}
        className="tf-flow"
        data-dragging={dragging ? 'true' : undefined}
        role="region"
        aria-roledescription="carousel"
        aria-label="Recent issues. Drag, or use the arrow keys."
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => {
          setTilt({ x: 0, y: 0 })
          endDrag()
        }}
        onFocus={(e) => {
          // Hold for keyboard users reading the cards; a mouse click should not stop the rotation.
          if (e.currentTarget.matches(':focus-visible') || e.target.matches(':focus-visible')) setHeld(true)
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false)
        }}
      >
        {Array.from({ length: slots }, (_, slot) => {
          const i = slot % count
          const issue = issues[i]!
          const off = offsetOf(slot)
          const dist = Math.abs(off)
          const front = Math.round(off) === 0
          const visible = dist <= reach + 0.5
          const style = {
            '--off': off.toFixed(3),
            '--dist': dist.toFixed(3),
            '--tx': front && !dragging ? `${tilt.x.toFixed(2)}deg` : '0deg',
            '--ty': front && !dragging ? `${tilt.y.toFixed(2)}deg` : '0deg',
            zIndex: 100 - Math.round(dist * 10),
            opacity: visible ? Math.max(0, 1 - dist * 0.25) : 0,
            pointerEvents: visible ? 'auto' : 'none',
          } as CSSProperties

          const inner = (
            <>
              <span className="tf-flow-img">
                {issue.image ? (
                  <Image src={issue.image} alt={issue.imageAlt} fill sizes="(max-width: 700px) 72vw, 400px" style={{ objectFit: 'cover' }} draggable={false} priority={slot === 0} />
                ) : null}
                <span className="tf-flow-sheen" aria-hidden="true" />
              </span>
              <span className="tf-flow-foot">
                <span className="tf-label" style={{ fontSize: 12 }}>
                  {issue.label}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--grey-2)', fontVariantNumeric: 'tabular-nums' }}>
                  {pad(i + 1)} / {pad(count)}
                </span>
              </span>
            </>
          )

          return front ? (
            <Link
              key={slot}
              className="tf-flow-card"
              data-front="true"
              href={`/posts/${issue.slug}`}
              style={style}
              aria-label={`Read: ${issue.title}`}
              draggable={false}
              onClick={(e) => {
                if (justDragged.current) e.preventDefault()
              }}
            >
              {inner}
            </Link>
          ) : (
            <button
              key={slot}
              className="tf-flow-card"
              type="button"
              style={style}
              tabIndex={-1}
              aria-label={`Show issue: ${issue.title}`}
              onClick={() => {
                if (!justDragged.current) setActive(slot)
              }}
            >
              {inner}
            </button>
          )
        })}
      </div>

      <div key={current.slug} className="tf-flow-caption">
        <div className="tf-display tf-clamp-3" style={{ fontSize: 'clamp(20px, 2vw, 28px)', lineHeight: 1.06 }}>
          {current.title}
        </div>
        {current.deck ? <p style={{ margin: 0, fontSize: 'var(--t-lead)', lineHeight: 1.45, color: 'var(--grey-1)' }}>{current.deck}</p> : null}
        <Link className="tf-nav" href={`/posts/${current.slug}`} style={{ color: 'var(--gold-light)' }}>
          Read it →
        </Link>
      </div>
    </>
  )
}

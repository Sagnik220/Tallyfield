'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export interface Issue {
  slug: string
  title: string
  deck: string
  label: string
  image: string | null
  imageAlt: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "The issues": a 3D carousel of recent posts. Rotates on its own, pauses on hover, respects reduced motion. */
export function IssuesCarousel({ issues }: { issues: Issue[] }) {
  const count = issues.length
  const [active, setActive] = useState(0)
  const [held, setHeld] = useState(false)

  useEffect(() => {
    if (count < 2 || held) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setActive((a) => (a + 1) % count), 5200)
    return () => clearInterval(timer)
  }, [count, held])

  if (count === 0) return null
  const current = issues[active] ?? issues[0]!

  function offsetOf(i: number) {
    let off = i - active
    if (off > count / 2) off -= count
    if (off < -count / 2) off += count
    return off
  }

  return (
    <>
      <div className="tf-wrap tf-reveal" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px 48px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="tf-eyebrow">The issues</div>
          <h2 className="tf-display" style={{ fontSize: 'clamp(44px, 5.4vw, 80px)' }}>
            Pick a comparison.
          </h2>
        </div>
        {count > 1 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div aria-live="polite" style={{ fontSize: 18, fontWeight: 700, color: 'var(--grey-2)', minWidth: 76 }}>
              {pad(active + 1)} / {pad(count)}
            </div>
            <button className="tf-btn" type="button" aria-label="Previous issue" onClick={() => setActive((active + count - 1) % count)}>
              ←
            </button>
            <button className="tf-btn" type="button" aria-label="Next issue" onClick={() => setActive((active + 1) % count)}>
              →
            </button>
          </div>
        ) : null}
      </div>

      <div
        onMouseEnter={() => setHeld(true)}
        onMouseLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={() => setHeld(false)}
        style={{ position: 'relative', height: 600, marginTop: 64, perspective: 1600, overflow: 'hidden' }}
      >
        {issues.map((issue, i) => {
          const off = offsetOf(i)
          const isActive = off === 0
          const visible = Math.abs(off) <= 1
          const card = (
            <>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 0' }}>
                <span style={{ fontFamily: 'var(--display)', fontSize: 18, letterSpacing: '0.08em', color: 'var(--ink-cream)' }}>TALLYFIELD</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--grey-2)' }}>
                  {pad(i + 1)} / {pad(count)}
                </span>
              </span>
              <span className="tf-display" style={{ display: 'block', padding: '18px 22px 20px', fontSize: 40 }}>
                {issue.title}
              </span>
              <span style={{ position: 'relative', display: 'block', flex: '1 1 0', minHeight: 0, background: 'var(--panel)' }}>
                {issue.image ? <Image src={issue.image} alt={issue.imageAlt} fill sizes="400px" style={{ objectFit: 'cover' }} /> : null}
              </span>
              <span className="tf-label" style={{ display: 'block', padding: '14px 22px 18px', fontSize: 12, letterSpacing: '0.12em' }}>
                {issue.label}
              </span>
            </>
          )
          const style = {
            position: 'absolute' as const,
            top: 20,
            left: '50%',
            width: 'min(400px, 74vw)',
            height: 540,
            marginLeft: 'calc(min(400px, 74vw) / -2)',
            padding: 0,
            border: '1px solid var(--stroke)',
            background: 'var(--bg)',
            color: 'inherit',
            fontFamily: 'inherit',
            textAlign: 'left' as const,
            textDecoration: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column' as const,
            boxShadow: '0 50px 90px rgba(0, 0, 0, 0.8)',
            transform: isActive ? 'translateX(0) translateZ(0) rotateY(0deg)' : `translateX(${off * 78}%) translateZ(-300px) rotateY(${off * -40}deg)`,
            opacity: isActive ? 1 : visible ? 0.5 : 0,
            zIndex: isActive ? 3 : 1,
            pointerEvents: visible ? ('auto' as const) : ('none' as const),
          }
          return isActive ? (
            <Link key={issue.slug} className="tf-card" href={`/posts/${issue.slug}`} style={style} aria-label={`Read: ${issue.title}`}>
              {card}
            </Link>
          ) : (
            <button key={issue.slug} className="tf-card" type="button" style={style} tabIndex={visible ? 0 : -1} aria-label={`Show issue: ${issue.title}`} onClick={() => setActive(i)}>
              {card}
            </button>
          )
        })}
      </div>

      <div style={{ maxWidth: 760, margin: '28px auto 0', padding: '0 24px', minHeight: 120, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        {current.deck ? <p style={{ margin: 0, fontSize: 24, lineHeight: 1.35, color: 'var(--ink-cream)' }}>{current.deck}</p> : null}
        <Link className="tf-nav" href={`/posts/${current.slug}`} style={{ color: 'var(--gold-light)' }}>
          Read it →
        </Link>
      </div>
    </>
  )
}

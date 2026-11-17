'use client'

import Image from 'next/image'
import { useState, type MouseEvent } from 'react'

interface Props {
  src: string | null
  alt: string
  badge: string
  caption?: string
  maxTilt?: number
}

/** The homepage cover: a layered card that tilts towards the pointer, with a slow light sheen. */
export function HeroCard({ src, alt, badge, caption, maxTilt = 10 }: Props) {
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })

  function onMove(event: MouseEvent<HTMLDivElement>) {
    const r = event.currentTarget.getBoundingClientRect()
    const px = (event.clientX - r.left) / r.width - 0.5
    const py = (event.clientY - r.top) / r.height - 0.5
    setTilt({ rx: -py * maxTilt, ry: px * maxTilt * 1.3 })
  }

  return (
    <div onMouseMove={onMove} onMouseLeave={() => setTilt({ rx: 0, ry: 0 })} style={{ perspective: 1400, display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
      <div className="tf-float" style={{ width: 'min(560px, 100%)', transformStyle: 'preserve-3d' }}>
        <div
          style={{
            position: 'relative',
            aspectRatio: '4 / 5',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.25s ease-out',
            transform: `rotateX(${tilt.rx.toFixed(2)}deg) rotateY(${tilt.ry.toFixed(2)}deg)`,
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'var(--panel)', border: '1px solid var(--stroke)', transform: 'translateZ(-90px) translate(34px, 34px)' }} />
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'var(--panel)', boxShadow: '0 60px 120px rgba(0, 0, 0, 0.75)' }}>
            {src ? (
              <Image src={src} alt={alt} fill priority sizes="(max-width: 900px) 100vw, 560px" style={{ objectFit: 'cover' }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: 'var(--display)', fontSize: 'clamp(40px, 5vw, 64px)', color: 'var(--stroke)', textTransform: 'uppercase' }}>
                Tallyfield
              </div>
            )}
            <div
              className="tf-sheen"
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '-10%',
                left: 0,
                width: '34%',
                height: '120%',
                background: 'linear-gradient(90deg, rgba(246, 231, 212, 0), rgba(246, 231, 212, 0.16), rgba(246, 231, 212, 0))',
              }}
            />
          </div>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 18, border: '1px solid var(--gold)', opacity: 0.7, transform: 'translateZ(46px)' }} />
          <div
            className="tf-label"
            style={{ position: 'absolute', top: 34, left: 34, padding: '10px 14px', background: 'rgba(6, 20, 18, 0.78)', letterSpacing: '0.16em', transform: 'translateZ(84px)' }}
          >
            {badge}
          </div>
          {caption ? (
            <div
              style={{
                position: 'absolute',
                left: -22,
                right: 40,
                bottom: 44,
                padding: '16px 20px',
                background: 'rgba(6, 20, 18, 0.9)',
                transform: 'translateZ(70px)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div className="tf-label">Latest</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink-cream)' }}>{caption}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

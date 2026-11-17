import Link from 'next/link'
import { site } from '@/config/site'

/** Text wordmark. Swap for the logo file once it is added to /public. */
export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <span
      style={{
        fontFamily: 'var(--display)',
        fontSize: size,
        letterSpacing: '0.08em',
        lineHeight: 1,
        color: 'var(--ink-cream)',
        textTransform: 'uppercase',
      }}
    >
      Tallyfield
    </span>
  )
}

/** The Tallyfield mark: two cream tally strokes crossed by a sage slash. */
export function Mark({ size = 80, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Tallyfield mark">
      <rect x="30" y="14" width="10" height="72" rx="2" fill="var(--ink-cream)" />
      <rect x="56" y="14" width="10" height="72" rx="2" fill="var(--ink-cream)" />
      <rect x="44" y="4" width="10" height="92" rx="2" fill="#7E9470" transform="rotate(52 49 50)" />
    </svg>
  )
}

/** The four thin corner arcs from the carousel identity. */
export function Ornaments() {
  const stroke = { fill: 'none', stroke: 'var(--ornament)', strokeWidth: 2 }
  return (
    <>
      <svg aria-hidden="true" width="63" height="68" viewBox="0 0 63 68" style={{ position: 'absolute', top: 0, left: 0 }}>
        <path d="M10 52 A44 44 0 0 0 46 12" {...stroke} />
      </svg>
      <svg aria-hidden="true" width="63" height="68" viewBox="0 0 63 68" style={{ position: 'absolute', top: 0, right: 0 }}>
        <path d="M17 12 A44 44 0 0 0 53 52" {...stroke} />
      </svg>
      <svg aria-hidden="true" width="63" height="51" viewBox="0 0 63 51" style={{ position: 'absolute', bottom: 0, left: 0 }}>
        <path d="M10 6 A40 40 0 0 1 46 40" {...stroke} />
      </svg>
      <svg aria-hidden="true" width="63" height="51" viewBox="0 0 63 51" style={{ position: 'absolute', bottom: 0, right: 0 }}>
        <path d="M17 40 A40 40 0 0 1 53 6" {...stroke} />
      </svg>
    </>
  )
}

export function SiteHeader({ latestHref }: { latestHref?: string | null }) {
  return (
    <header
      className="tf-wrap"
      style={{ paddingTop: 'clamp(18px, 3vw, 36px)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px 40px' }}
    >
      <Link href="/" aria-label="Tallyfield home" style={{ display: 'flex', alignItems: 'center', minHeight: 44, textDecoration: 'none' }}>
        <Wordmark size={26} />
      </Link>
      <nav aria-label="Sections" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 36px' }}>
        <Link className="tf-nav" href="/">
          Home
        </Link>
        <Link className="tf-nav" href="/archive">
          Archive
        </Link>
        {latestHref ? (
          <Link className="tf-nav" href={latestHref}>
            Latest verdict
          </Link>
        ) : null}
        <Link className="tf-nav" href="/about">
          About
        </Link>
      </nav>
      <a className="tf-nav" href={site.instagram} style={{ color: 'var(--gold-light)' }}>
        Instagram
      </a>
    </header>
  )
}

export function SiteFooter({ prompt = 'Which one would you pick? Tell us on Instagram.' }: { prompt?: string }) {
  return (
    <footer className="tf-wrap" style={{ paddingTop: 'var(--sp-section)', paddingBottom: 48, display: 'flex', flexDirection: 'column', gap: 40 }}>
      <a
        className="tf-cta tf-reveal"
        href={site.instagram}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: '12px 32px',
          minHeight: 'clamp(72px, 8vw, 96px)',
          padding: '18px clamp(20px, 3vw, 32px)',
          fontSize: 'clamp(17px, 1.8vw, 24px)',
          letterSpacing: 0,
          textTransform: 'none',
        }}
      >
        <span>{prompt}</span>
        <span aria-hidden="true">→</span>
      </a>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '32px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Mark size={56} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Wordmark size={30} />
            <div style={{ fontSize: 'var(--t-small)', color: 'var(--grey-1)' }}>Watches · Reviews · Buying guides</div>
          </div>
        </div>
        <nav aria-label="Footer" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 32px' }}>
          <Link className="tf-nav" href="/">
            Home
          </Link>
          <Link className="tf-nav" href="/archive">
            Archive
          </Link>
          <Link className="tf-nav" href="/about">
            About
          </Link>
          <a className="tf-nav" href={site.instagram}>
            Instagram
          </a>
        </nav>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="tf-rule-line" style={{ maxWidth: 'none' }} />
        <div style={{ fontSize: 'var(--t-small)', color: 'var(--grey-3)' }}>{site.tagline}</div>
      </div>
    </footer>
  )
}

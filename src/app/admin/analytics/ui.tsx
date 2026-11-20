import Link from 'next/link'
import type { AdsSetup } from '@/integrations/meta-ads/ads'

export const fmt = (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString('en-IN'))
export const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '0%')
export const money = (n: number | null | undefined, currency: string, digits = 0) =>
  n == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n)

export function SectionTitle({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h2 style={{ margin: 0, fontSize: 16, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-cream)' }}>{children}</h2>
      {note ? (
        <p className="tf-note" style={{ fontSize: 12, margin: 0 }}>
          {note}
        </p>
      ) : null}
    </div>
  )
}

export function Tiles({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>{children}</div>
}

export function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="tf-panel" style={{ gap: 6, padding: '16px 18px' }}>
      <span className="tf-label">{label}</span>
      <span style={{ fontFamily: 'var(--display)', fontSize: 34, lineHeight: 1, color: 'var(--ink-cream)' }}>{value}</span>
      {note ? (
        <span className="tf-note" style={{ fontSize: 12 }}>
          {note}
        </span>
      ) : null}
    </div>
  )
}

/**
 * A combined total with its organic / paid split: the big number, a two-part bar, and both parts in text
 * (so the split never depends on colour alone). additive=false for reach, where people can overlap.
 */
export function SplitTile({ label, organic, paid, additive = true, paidReady }: { label: string; organic: number | null; paid: number | null; additive?: boolean; paidReady: boolean }) {
  const o = organic ?? 0
  const p = paidReady ? (paid ?? 0) : 0
  const total = o + p
  const share = total ? p / total : 0
  return (
    <div className="tf-panel tf-splittile" style={{ gap: 8, padding: '16px 18px' }}>
      <span className="tf-label">{label}</span>
      <span style={{ fontFamily: 'var(--display)', fontSize: 34, lineHeight: 1, color: 'var(--ink-cream)', whiteSpace: 'nowrap' }}>
        {!additive && (organic != null || paidReady) ? <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--grey-2)', marginRight: 6, textTransform: 'uppercase' }}>up to</span> : null}
        {organic == null && !paidReady ? '—' : fmt(total)}
      </span>
      <span className="tf-split-bar" aria-hidden="true">
        <span className="tf-split-organic" style={{ flexGrow: total ? o : 1 }} />
        {paidReady && p > 0 ? <span className="tf-split-paid" style={{ flexGrow: p }} /> : null}
      </span>
      <span className="tf-split-legend">
        <span>
          <i className="tf-split-key tf-split-organic" aria-hidden="true" />
          Organic {fmt(organic)}
        </span>
        <span>
          <i className="tf-split-key tf-split-paid" aria-hidden="true" />
          Paid {paidReady ? `${fmt(paid)} · ${Math.round(share * 100)}%` : '—'}
        </span>
      </span>
      {!additive ? (
        <span className="tf-note" style={{ fontSize: 11 }}>
          Some people see a post both ways, so the true total is at most this.
        </span>
      ) : null}
    </div>
  )
}

/** A ranked list with a thin single-colour bar for magnitude and the number in text colour. */
export function Ranked({ title, rows, total, empty, format = fmt }: { title: string; rows: { label: string; value: number; href?: string }[]; total: number; empty: string; format?: (n: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <section className="tf-panel" style={{ gap: 10 }}>
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="tf-note" style={{ fontSize: 13 }}>
          {empty}
        </p>
      ) : null}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td style={{ padding: '6px 0', fontSize: 14, color: 'var(--ink-cream)', width: '45%', maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.href ? (
                  <Link href={r.href} style={{ color: 'inherit' }}>
                    {r.label}
                  </Link>
                ) : (
                  r.label
                )}
              </td>
              <td style={{ padding: '6px 10px' }}>
                <span style={{ display: 'block', height: 8, width: `${Math.max(2, (r.value / max) * 100)}%`, background: 'var(--gold-light)', borderRadius: '0 4px 4px 0' }} />
              </td>
              <td style={{ padding: '6px 0', fontSize: 13, color: 'var(--grey-1)', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {format(r.value)} <span style={{ color: 'var(--grey-3)' }}>· {pct(r.value, total)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

/** What to do when ad numbers can't be read yet. */
export function AdsSetupCard({ setup, error }: { setup: AdsSetup; error: string | null }) {
  return (
    <div className="tf-alert" role="status" style={{ display: 'grid', gap: 8 }}>
      <strong>Ad numbers aren’t connected yet.</strong>
      {setup === 'no_account' ? (
        <span>
          The connection works, but it can’t see any ad account. In Meta Business settings, open <em>Accounts → Ad accounts</em>, pick the account your boosts and ads are paid from, and assign
          it to the Tallyfield system user (with “View performance”). If your boosts were paid from the Instagram app, first add that ad account to the Tallyfield business portfolio.
        </span>
      ) : setup === 'no_permission' ? (
        <span>
          The connection needs the <code>ads_read</code> permission and access to your ad account. Ask Claude to walk you through it; it takes about five minutes.
        </span>
      ) : (
        <span>Meta didn’t respond: {error ?? 'unknown error'}. Try again in a minute.</span>
      )}
    </div>
  )
}

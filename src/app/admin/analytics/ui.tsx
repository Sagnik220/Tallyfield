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
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>{children}</div>
}

export function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="tf-panel" style={{ gap: 6, padding: '16px 18px' }}>
      <span className="tf-label">{label}</span>
      <span style={BIG}>{value}</span>
      {note ? (
        <span className="tf-note" style={{ fontSize: 12 }}>
          {note}
        </span>
      ) : null}
    </div>
  )
}

const BIG = { fontFamily: 'var(--display)', fontSize: 'clamp(26px, 2.3vw, 34px)', lineHeight: 1, color: 'var(--ink-cream)', overflowWrap: 'anywhere' } as const

/**
 * A total and how much of it came from ads. Instagram's account totals already include ad activity, so
 * organic = total − paid (never below zero). Without ad data it simply shows Instagram's total.
 */
export function SplitTile({ label, total, paid, paidReady, note }: { label: string; total: number | null; paid: number | null; paidReady: boolean; note?: string }) {
  const t = total ?? 0
  const p = paidReady ? Math.min(paid ?? 0, t) : 0
  const o = Math.max(0, t - p)
  const showSplit = paidReady && total != null
  return (
    <div className="tf-panel tf-splittile" style={{ gap: 8, padding: '16px 18px' }}>
      <span className="tf-label">{label}</span>
      <span style={BIG}>{fmt(total)}</span>
      {showSplit ? (
        <>
          <span className="tf-split-bar" aria-hidden="true">
            <span className="tf-split-organic" style={{ flexGrow: t ? o : 1 }} />
            {p > 0 ? <span className="tf-split-paid" style={{ flexGrow: p }} /> : null}
          </span>
          <span className="tf-split-legend">
            <span>
              <i className="tf-split-key tf-split-organic" aria-hidden="true" />
              Organic {fmt(o)}
            </span>
            <span>
              <i className="tf-split-key tf-split-paid" aria-hidden="true" />
              Ads {fmt(p)} · {t ? Math.round((p / t) * 100) : 0}%
            </span>
          </span>
        </>
      ) : null}
      {note ? (
        <span className="tf-note" style={{ fontSize: 12 }}>
          {note}
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

/** What to do when ad numbers can't be read yet: one line, with the steps folded away. */
export function AdsSetupCard({ setup, error, compact = false }: { setup: AdsSetup; error: string | null; compact?: boolean }) {
  const steps =
    setup === 'no_account' ? (
      <ol style={{ margin: '6px 0 0', paddingLeft: 18, display: 'grid', gap: 4 }}>
        <li>If your boosts are paid from the Instagram app, add that ad account to the Tallyfield business portfolio (Business settings → Accounts → Ad accounts → Add).</li>
        <li>Open the ad account → Assign people → choose the Tallyfield system user → allow “View performance”.</li>
        <li>Reload this page. No new token is needed.</li>
      </ol>
    ) : setup === 'no_permission' ? (
      <p style={{ margin: '6px 0 0' }}>
        The connection needs the <code>ads_read</code> permission and access to your ad account.
      </p>
    ) : (
      <p style={{ margin: '6px 0 0' }}>Meta didn’t respond: {error ?? 'unknown error'}. Try again in a minute.</p>
    )
  return (
    <details className="tf-ads-setup" open={!compact}>
      <summary>
        <strong>Ads not connected yet.</strong> Totals below are Instagram’s own (they already include any ads); the paid split appears once your ad account is shared.{' '}
        <span className="tf-ads-setup-how">How to connect</span>
      </summary>
      <div style={{ fontSize: 13, color: 'var(--grey-1)' }}>{steps}</div>
    </details>
  )
}

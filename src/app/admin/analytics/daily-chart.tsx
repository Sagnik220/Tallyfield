'use client'

import { useState } from 'react'

export interface DayPoint {
  day: string
  value: number
  extra?: number
}

const plain = (n: number) => Math.round(n).toLocaleString('en-IN')
const label = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

function niceMax(n: number): number {
  if (n <= 5) return 5
  const p = 10 ** Math.floor(Math.log10(n))
  const steps = [1, 2, 2.5, 5, 10]
  return (steps.find((s) => s * p >= n) ?? 10) * p
}

/** One gold series per day (page views, ad spend…), hover for the day's numbers, with a table for screen readers. */
export function DailyChart({ points, valueLabel = 'views', extraLabel, currency, ariaLabel = 'Page views per day' }: { points: DayPoint[]; valueLabel?: string; extraLabel?: string; currency?: string; ariaLabel?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const fmt = (n: number) => (currency ? new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n) : plain(n))
  const W = 900
  const H = 240
  const pad = { l: 44, r: 8, t: 12, b: 28 }
  const max = niceMax(Math.max(...points.map((p) => p.value), 0))
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b
  const band = innerW / Math.max(points.length, 1)
  const bar = Math.max(2, Math.min(24, band - 2))
  const y = (v: number) => pad.t + innerH - (v / max) * innerH
  const ticks = [0, max / 2, max]
  const every = Math.ceil(points.length / 8)
  const h = hover !== null ? points[hover] : null

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} style={{ width: '100%', height: 'auto', display: 'block' }} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--rule-dark)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--grey-2)">
              {t >= 10_000 && !currency ? `${Math.round(t / 1000)}K` : fmt(Math.round(t))}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const x = pad.l + i * band + (band - bar) / 2
          const top = y(p.value)
          const hgt = pad.t + innerH - top
          const r = Math.min(4, bar / 2, hgt)
          return (
            <g key={p.day} onMouseEnter={() => setHover(i)}>
              <rect x={pad.l + i * band} y={pad.t} width={band} height={innerH} fill="transparent" />
              {p.value > 0 ? (
                <path
                  d={`M${x},${pad.t + innerH} V${top + r} Q${x},${top} ${x + r},${top} H${x + bar - r} Q${x + bar},${top} ${x + bar},${top + r} V${pad.t + innerH} Z`}
                  fill="var(--gold-light)"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              ) : null}
              {i % every === 0 ? (
                <text x={pad.l + i * band + band / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--grey-2)">
                  {label(p.day)}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
      {h ? (
        <div
          role="status"
          style={{
            position: 'absolute',
            top: 4,
            left: `${Math.min(80, Math.max(8, ((pad.l + (hover! + 0.5) * band) / W) * 100))}%`,
            transform: 'translateX(-50%)',
            padding: '8px 10px',
            background: 'var(--bg)',
            border: '1px solid var(--stroke)',
            fontSize: 13,
            color: 'var(--ink-cream)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <strong>{label(h.day)}</strong> · {fmt(h.value)} {valueLabel}
          {extraLabel ? ` · ${plain(h.extra ?? 0)} ${extraLabel}` : ''}
        </div>
      ) : null}
      <details style={{ marginTop: 8 }}>
        <summary className="tf-note" style={{ fontSize: 12, cursor: 'pointer' }}>
          Show as a table
        </summary>
        <table className="tf-table" style={{ minWidth: 0, marginTop: 8 }}>
          <thead>
            <tr>
              <th>Day</th>
              <th style={{ textTransform: 'capitalize' }}>{valueLabel}</th>
              {extraLabel ? <th style={{ textTransform: 'capitalize' }}>{extraLabel}</th> : null}
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.day}>
                <td>{label(p.day)}</td>
                <td>{fmt(p.value)}</td>
                {extraLabel ? <td>{plain(p.extra ?? 0)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

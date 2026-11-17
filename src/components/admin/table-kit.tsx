'use client'

import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

/**
 * Shared pieces for the admin's long tables: search, filters, sortable headers, pages and CSV download.
 * Table state lives in the page address (?q=…&sort=…&page=…), so Back, refresh and shared links keep it.
 * Updates use history.replaceState, which Next keeps in sync with useSearchParams without reloading the page.
 */

export const PAGE_SIZE = 15

export type Dir = 'asc' | 'desc'

export function useTableState<K extends string>(defaults: Record<K, string>) {
  const params = useSearchParams()
  const get = useCallback((key: K) => params.get(key) ?? defaults[key], [params, defaults])
  const set = useCallback(
    (patch: Partial<Record<K | 'page', string>>) => {
      const next = new URLSearchParams(window.location.search)
      for (const [k, v] of Object.entries(patch) as [string, string | undefined][]) {
        const fallback = k === 'page' ? '1' : (defaults as Record<string, string>)[k]
        if (v === undefined || v === '' || v === fallback) next.delete(k)
        else next.set(k, v)
      }
      // Any change other than the page itself starts again at page 1.
      if (!('page' in patch)) next.delete('page')
      const qs = next.toString()
      window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
    },
    [defaults],
  )
  const page = Math.max(1, Number(params.get('page')) || 1)
  const reset = useCallback(() => {
    const next = new URLSearchParams(window.location.search)
    for (const k of [...Object.keys(defaults), 'page']) next.delete(k)
    const qs = next.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
  }, [defaults])
  const isFiltered = (Object.keys(defaults) as K[]).some((k) => k !== ('sort' as K) && k !== ('dir' as K) && get(k) !== defaults[k])
  return { get, set, page, reset, isFiltered }
}

/** Search box: updates as you type (short delay), "/" jumps to it, Esc clears it. */
export function SearchBox({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  const [text, setText] = useState(value)
  // Follow outside changes (Clear filters, Back button) without fighting the user's typing.
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    if (value !== text.trim()) setText(value)
  }
  const ref = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (e.key === '/' && !(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function change(v: string) {
    setText(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(v.trim()), 200)
  }

  return (
    <label className="tf-tk-search">
      <span className="tf-sr">{label}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        ref={ref}
        type="search"
        value={text}
        placeholder={placeholder}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && text) {
            e.preventDefault()
            change('')
          }
        }}
      />
      <kbd aria-hidden="true">/</kbd>
    </label>
  )
}

export function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <label className="tf-tk-select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Toolbar({ children, count, total, noun, onReset, showReset, actions }: { children: ReactNode; count: number; total: number; noun: string; onReset: () => void; showReset: boolean; actions?: ReactNode }) {
  return (
    <div className="tf-tk-bar">
      <div className="tf-tk-controls">{children}</div>
      <div className="tf-tk-meta">
        <span role="status" aria-live="polite">
          {count === total ? `${total.toLocaleString('en-IN')} ${noun}` : `${count.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')} ${noun}`}
        </span>
        {showReset ? (
          <button type="button" className="tf-tk-link" onClick={onReset}>
            Clear filters
          </button>
        ) : null}
        {actions}
      </div>
    </div>
  )
}

/** A column header that sorts the table. Click once for the natural order, again to flip it. */
export function SortTh({ id, label, sort, dir, onSort, align = 'left', first = 'desc' }: { id: string; label: string; sort: string; dir: Dir; onSort: (id: string, dir: Dir) => void; align?: 'left' | 'right'; first?: Dir }) {
  const active = sort === id
  const next: Dir = active ? (dir === 'desc' ? 'asc' : 'desc') : first
  return (
    <th aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} style={{ textAlign: align }}>
      <button type="button" className="tf-tk-sort" data-active={active || undefined} onClick={() => onSort(id, next)} style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
        {label}
        <span aria-hidden="true" className="tf-tk-arrow">
          {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  )
}

/** "Showing 16–30 of 84" with previous/next and a few page numbers. */
export function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const current = Math.min(page, pages)
  const nums = useMemo(() => {
    const set = new Set([1, pages, current - 1, current, current + 1].filter((n) => n >= 1 && n <= pages))
    return [...set].sort((a, b) => a - b)
  }, [current, pages])
  if (total === 0) return null
  const from = (current - 1) * PAGE_SIZE + 1
  const to = Math.min(total, current * PAGE_SIZE)
  return (
    <nav className="tf-tk-pager" aria-label="Pages">
      <span className="tf-note" style={{ fontSize: 13 }}>
        Showing {from}–{to} of {total.toLocaleString('en-IN')}
      </span>
      {pages > 1 ? (
        <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button type="button" className="tf-chip" disabled={current === 1} onClick={() => onPage(current - 1)} aria-label="Previous page">
            ← Prev
          </button>
          {nums.map((n, i) => (
            <span key={n} style={{ display: 'contents' }}>
              {i > 0 && n - nums[i - 1]! > 1 ? <span className="tf-tk-gap">…</span> : null}
              <button type="button" className="tf-chip" aria-pressed={n === current} aria-current={n === current ? 'page' : undefined} onClick={() => onPage(n)}>
                {n}
              </button>
            </span>
          ))}
          <button type="button" className="tf-chip" disabled={current === pages} onClick={() => onPage(current + 1)} aria-label="Next page">
            Next →
          </button>
        </span>
      ) : null}
    </nav>
  )
}

export function pageSlice<T>(rows: T[], page: number): T[] {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  return rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
}

/** Compare for sorting; empty values always go last. */
export function compare(a: string | number | null | undefined, b: string | number | null | undefined, dir: Dir): number {
  const ea = a === null || a === undefined || a === ''
  const eb = b === null || b === undefined || b === ''
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1
  const r = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' })
  return dir === 'asc' ? r : -r
}

/** Download rows as a CSV file (opens in Excel and Google Sheets). */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v)
    // Quote everything; neutralise leading characters spreadsheets treat as formulas.
    return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`
  }
  const csv = '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function CsvButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="tf-ghost tf-small" onClick={onClick}>
      Download CSV
    </button>
  )
}

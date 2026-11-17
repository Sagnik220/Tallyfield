'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

/**
 * Sends one anonymous page view per page shown. No cookies, no third parties.
 * Skipped for the admin, and for visitors who ask not to be tracked (Do Not Track / Global Privacy Control).
 */
export function Tracker() {
  const path = usePathname()
  const last = useRef<string | null>(null)

  useEffect(() => {
    if (!path || path === last.current) return
    if (/^\/(admin|login|auth)/.test(path)) return
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
    if (nav.doNotTrack === '1' || nav.globalPrivacyControl) return
    // The first page keeps the outside referrer (e.g. Instagram); later in-site moves have none.
    const referrer = last.current === null ? document.referrer : ''
    last.current = path
    const body = JSON.stringify({ p: path, r: referrer })
    if (!navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'application/json' }))) {
      void fetch('/api/track', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => undefined)
    }
  }, [path])

  return null
}

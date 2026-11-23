import { describe, expect, it } from 'vitest'
import { safeNext } from '@/lib/safe-next'

const O = 'https://tallyfield.vercel.app'

describe('sign-in redirect (open redirect protection)', () => {
  it('allows paths on this site', () => {
    expect(safeNext('/admin', O)).toBe('/admin')
    expect(safeNext('/admin/analytics?range=7', O)).toBe('/admin/analytics?range=7')
  })
  it.each(['//evil.example', '/\\evil.example', '/\\/evil.example', 'https://evil.example', 'javascript:alert(1)', '/%5Cevil.example', ' /admin', '/admin\n//evil', ''])('blocks %j', (v) => {
    const out = safeNext(v, O)
    expect(new URL(out, O).origin).toBe(O)
  })
  it('falls back to the admin for anything unsafe', () => {
    expect(safeNext('//evil.example', O)).toBe('/admin')
    expect(safeNext('/\\evil.example', O)).toBe('/admin')
    expect(safeNext(null, O)).toBe('/admin')
  })
})

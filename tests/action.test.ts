import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { AppError } from '@/domain/result'
import { STAFF } from '@/domain/roles'
import { makeAction, type ActionDeps } from '@/lib/action'

function setup(overrides: Partial<ActionDeps<string>> = {}) {
  const order: string[] = []
  const deps: ActionDeps<string> = {
    getDb: async () => 'db',
    requireRole: async () => (order.push('auth'), { id: 'u1', role: 'editor' as const }),
    hitRateLimit: async () => (order.push('limit'), true),
    logError: vi.fn(),
    ...overrides,
  }
  const handler = vi.fn(async (input: { n: number }) => (order.push('handler'), input.n * 2))
  const run = makeAction(deps)({ name: 'test', roles: STAFF, schema: z.object({ n: z.number() }), rateLimit: { bucket: 't', max: 1, windowSeconds: 60 }, handler })
  return { run, handler, deps, order }
}

describe('action wrapper', () => {
  it('validates, authorises, rate limits, then runs', async () => {
    const { run, order } = setup()
    expect(await run({ n: 21 })).toEqual({ ok: true, data: 42 })
    expect(order).toEqual(['auth', 'limit', 'handler'])
  })

  it('rejects bad input before touching auth or the handler', async () => {
    const { run, handler, order } = setup()
    const result = await run({ n: 'x' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('invalid_input')
    expect(order).toEqual([])
    expect(handler).not.toHaveBeenCalled()
  })

  it('stops when the person is not allowed', async () => {
    const { run, handler } = setup({ requireRole: async () => { throw new AppError('forbidden', 'No access') } })
    expect(await run({ n: 1 })).toEqual({ ok: false, error: { code: 'forbidden', message: 'No access' } })
    expect(handler).not.toHaveBeenCalled()
  })

  it('stops when the rate limit is hit', async () => {
    const { run, handler } = setup({ hitRateLimit: async () => false })
    const result = await run({ n: 1 })
    expect(!result.ok && result.error.code).toBe('rate_limited')
    expect(handler).not.toHaveBeenCalled()
  })

  it('hides unexpected errors and logs them', async () => {
    const { run, deps } = setup({ requireRole: async () => { throw new Error('connection string postgres://secret') } })
    const result = await run({ n: 1 })
    expect(result).toEqual({ ok: false, error: { code: 'internal', message: 'Something went wrong. Please try again.' } })
    expect(deps.logError).toHaveBeenCalledOnce()
  })
})

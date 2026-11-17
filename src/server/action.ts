import 'server-only'
import { makeAction } from '@/lib/action'
import { requireRole } from '@/lib/auth/session'
import { createSessionClient, type Db } from '@/lib/supabase/server'

/** The action wrapper wired to the real session, database and rate limiter. */
export const action = makeAction<Db>({
  getDb: createSessionClient,
  requireRole,
  async hitRateLimit(db, limit) {
    const { data, error } = await db.rpc('hit_rate_limit', {
      p_bucket: limit.bucket,
      p_max: limit.max,
      p_window_seconds: limit.windowSeconds,
    })
    if (error) throw error
    return data === true
  },
  logError(name, error) {
    console.error(`[action:${name}]`, error instanceof Error ? error.message : error)
  },
})

import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { publicEnv } from '@/config/env.public'
import type { Db } from './server'

/**
 * Anonymous client for public pages. It sends no cookies, so the pages that use it can be cached and served statically.
 * It reads exactly what a signed-out visitor may read: row level security applies as for anyone else.
 */
export function createPublicClient(): Db {
  const env = publicEnv()
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return client as unknown as Db
}

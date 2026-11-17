import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { publicEnv } from '@/config/env.public'
import { serverEnv } from '@/config/env.server'

/**
 * Client with the secret key. It BYPASSES row level security.
 * Allowed use: reading integration tokens (src/data/tokens.repo.ts). Do not use it for content reads or writes;
 * those go through the session client so the database rules apply.
 */
export function createServiceClient() {
  return createClient(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

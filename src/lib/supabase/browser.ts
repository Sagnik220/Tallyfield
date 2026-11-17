import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/config/env.public'

/** Browser client. Holds only the publishable key; the database decides what it may read. */
export function createClient() {
  const env = publicEnv()
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
}

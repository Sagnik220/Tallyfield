import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { publicEnv } from '@/config/env.public'

/**
 * Supabase client for the current request, acting as the signed-in person (or as an anonymous visitor).
 * Every query through it is filtered by the database's row level security.
 */
export async function createSessionClient() {
  const env = publicEnv()
  const cookieStore = await cookies()
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options)
        } catch {
          // Called while rendering a page, where cookies are read-only. src/proxy.ts refreshes the session instead.
        }
      },
    },
  })
}

export type Db = Awaited<ReturnType<typeof createSessionClient>>

import { z } from 'zod'

/** Values that are safe to ship to the browser. Read lazily so a build without them still works. */
const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
})

export type PublicEnv = z.infer<typeof schema>
let cached: PublicEnv | undefined

export function publicEnv(): PublicEnv {
  // Each variable is named in full so the bundler can inline it for the browser.
  cached ??= schema.parse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  })
  return cached
}

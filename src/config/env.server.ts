import 'server-only'
import { z } from 'zod'

/** Secrets. Importing this file from browser code fails the build ("server-only"). */
const schema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20),
  INSTAGRAM_API_VERSION: z.string().regex(/^v\d+\.\d+$/).default('v25.0'),
})

export type ServerEnv = z.infer<typeof schema>
let cached: ServerEnv | undefined

export function serverEnv(): ServerEnv {
  cached ??= schema.parse(process.env)
  return cached
}

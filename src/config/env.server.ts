import 'server-only'
import { z } from 'zod'

/** Secrets. Importing this file from browser code fails the build ("server-only"). */
const schema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20),
  INSTAGRAM_API_VERSION: z.string().regex(/^v\d+\.\d+$/).default('v25.0'),
  /** Numeric ID of the connected Instagram account. Only needed for Facebook-issued ("EAA...") tokens. */
  INSTAGRAM_ACCOUNT_ID: z.string().regex(/^\d{5,30}$/).optional(),
})

export type ServerEnv = z.infer<typeof schema>
let cached: ServerEnv | undefined

export function serverEnv(): ServerEnv {
  cached ??= schema.parse(process.env)
  return cached
}

import type { z } from 'zod'
import { AppError, fail, ok, type ActionResult } from '@/domain/result'
import type { Role, SessionUser } from '@/domain/roles'

export interface RateLimit {
  bucket: string
  max: number
  windowSeconds: number
}

/** Everything an action needs from the outside world. Injected so actions can be tested without a database. */
export interface ActionDeps<TDb> {
  getDb: () => Promise<TDb>
  requireRole: (db: TDb, allowed: readonly Role[]) => Promise<SessionUser>
  hitRateLimit: (db: TDb, limit: RateLimit) => Promise<boolean>
  logError: (name: string, error: unknown) => void
}

export interface ActionContext<TDb> {
  db: TDb
  user: SessionUser
}

interface ActionOptions<TSchema extends z.ZodType, TOut, TDb> {
  name: string
  roles: readonly Role[]
  schema: TSchema
  rateLimit?: RateLimit
  handler: (input: z.output<TSchema>, ctx: ActionContext<TDb>) => Promise<TOut>
}

/**
 * Builds the wrapper every server action goes through, in this fixed order:
 *   1. validate the input   2. check who is asking   3. apply the rate limit   4. run the handler
 * Unexpected errors are logged and reported as a generic failure, so internals never reach the browser.
 */
export function makeAction<TDb>(deps: ActionDeps<TDb>) {
  return function action<TSchema extends z.ZodType, TOut>(options: ActionOptions<TSchema, TOut, TDb>) {
    return async (rawInput: unknown): Promise<ActionResult<TOut>> => {
      try {
        const parsed = options.schema.safeParse(rawInput)
        if (!parsed.success) {
          const fields: Record<string, string[]> = {}
          for (const issue of parsed.error.issues) (fields[issue.path.join('.') || '_'] ??= []).push(issue.message)
          return fail('invalid_input', 'Some fields need attention.', fields)
        }
        const db = await deps.getDb()
        const user = await deps.requireRole(db, options.roles)
        if (options.rateLimit && !(await deps.hitRateLimit(db, options.rateLimit))) {
          return fail('rate_limited', 'Too many attempts. Please wait a little and try again.')
        }
        return ok(await options.handler(parsed.data, { db, user }))
      } catch (error) {
        if (error instanceof AppError) return fail(error.code, error.message, error.fields)
        deps.logError(options.name, error)
        return fail('internal', 'Something went wrong. Please try again.')
      }
    }
  }
}

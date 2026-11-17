/** Every server action returns this shape, so the UI handles success and failure the same way everywhere. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; fields?: Record<string, string[]> } }

export type ErrorCode = 'invalid_input' | 'unauthenticated' | 'forbidden' | 'rate_limited' | 'not_found' | 'conflict' | 'upstream' | 'internal'

/** An error that is safe to show to the person using the admin. Anything else is reported as a generic failure. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data })
export const fail = (code: ErrorCode, message: string, fields?: Record<string, string[]>): ActionResult<never> => ({
  ok: false,
  error: fields ? { code, message, fields } : { code, message },
})

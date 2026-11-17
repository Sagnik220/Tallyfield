import 'server-only'
import { AppError } from '@/domain/result'
import { hasRole, ROLES, type Role, type SessionUser } from '@/domain/roles'
import type { Db } from '@/lib/supabase/server'

/** Who is making this request. The token is verified (getClaims), never just read from the cookie. */
export async function getSessionUser(db: Db): Promise<SessionUser | null> {
  const { data, error } = await db.auth.getClaims()
  const id = data?.claims?.sub
  if (error || !id) return null
  const { data: profile } = await db.from('profiles').select('role').eq('id', id).maybeSingle()
  const role = ROLES.find((r) => r === profile?.role) ?? null
  return { id, role }
}

/** Throws unless the person is signed in and holds one of the allowed roles. */
export async function requireRole(db: Db, allowed: readonly Role[]): Promise<SessionUser> {
  const user = await getSessionUser(db)
  if (!user) throw new AppError('unauthenticated', 'Please sign in.')
  if (!hasRole(user, allowed)) throw new AppError('forbidden', 'You do not have access to this.')
  return user
}

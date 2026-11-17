export const ROLES = ['admin', 'editor'] as const
export type Role = (typeof ROLES)[number]

export const STAFF: readonly Role[] = ['admin', 'editor']
export const ADMIN_ONLY: readonly Role[] = ['admin']

export interface SessionUser {
  id: string
  role: Role | null
}

export function hasRole(user: SessionUser | null, allowed: readonly Role[]): boolean {
  return user?.role != null && allowed.includes(user.role)
}

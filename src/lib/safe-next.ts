/**
 * Where to go after signing in: a path on this site only. Resolves the value the way a browser would
 * (so '/\\evil.com', '//evil.com', 'https://evil.com' and encoded tricks all fail) and checks the origin.
 */
export function safeNext(value: string | null, origin: string): string {
  if (!value || !value.startsWith('/') || /[\\\s]/.test(value)) return '/admin'
  try {
    const target = new URL(value, origin)
    return target.origin === origin ? `${target.pathname}${target.search}` : '/admin'
  } catch {
    return '/admin'
  }
}


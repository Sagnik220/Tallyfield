import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Runs before /admin and /login only (public pages stay static and cacheable).
 *   1. Adds a strict Content-Security-Policy with a fresh nonce.
 *   2. Refreshes the sign-in session.
 *   3. Sends signed-out visitors away from /admin.
 * This is a first gate, not the only one: the admin layout, every server action and the database check again.
 */
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isDev = process.env.NODE_ENV === 'development'
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : ''

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // style="" attributes (set by React and next/image) cannot carry a nonce; they cannot run script.
    "style-src-attr 'unsafe-inline'",
    // Instagram's image servers: post thumbnails on the analytics and import screens.
    `img-src 'self' blob: data: ${supabaseOrigin} https://*.cdninstagram.com https://*.fbcdn.net`,
    "font-src 'self'",
    `media-src 'self' blob: ${supabaseOrigin}`,
    `connect-src 'self' ${supabaseOrigin}`,
    "frame-src https://www.instagram.com https://www.youtube-nocookie.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)
  let response = NextResponse.next({ request: { headers: requestHeaders } })

  let signedIn = false
  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
          response = NextResponse.next({ request: { headers: requestHeaders } })
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
        },
      },
    })
    const { data } = await supabase.auth.getClaims()
    signedIn = Boolean(data?.claims?.sub)
  }

  if (!signedIn && request.nextUrl.pathname.startsWith('/admin')) {
    const login = request.nextUrl.clone()
    login.pathname = '/login'
    login.search = ''
    response = NextResponse.redirect(login)
  }

  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}

export const config = { matcher: ['/admin/:path*', '/login'] }

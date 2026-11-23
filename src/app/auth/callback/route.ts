import { NextResponse, type NextRequest } from 'next/server'
import { safeNext } from '@/lib/safe-next'
import { createSessionClient } from '@/lib/supabase/server'

/** The sign-in email links here. Swaps the one-time code for a session cookie, then continues to the admin. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'), url.origin)

  if (code) {
    const db = await createSessionClient()
    const { error } = await db.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
  }
  return NextResponse.redirect(new URL('/login?error=link', url.origin))
}

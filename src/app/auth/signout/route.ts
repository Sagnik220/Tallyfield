import { NextResponse, type NextRequest } from 'next/server'
import { createSessionClient } from '@/lib/supabase/server'

/** POST only, so a link or image on another site cannot sign someone out. */
export async function POST(request: NextRequest) {
  const db = await createSessionClient()
  await db.auth.signOut()
  return NextResponse.redirect(new URL('/login', request.nextUrl.origin), { status: 303 })
}

import { createHash } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { serverEnv } from '@/config/env.server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * POST /api/track  { p: "/posts/slug", r: "https://www.instagram.com/" }
 * Records one anonymous page view. No cookies are set and no IP address is stored: a visitor is recognised only
 * within one day, through a hash of (day, secret salt, IP, browser) that cannot be reversed and changes daily.
 */
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|monitor|curl|wget|python|axios|node-fetch/i
const PATH = /^\/[A-Za-z0-9/_-]{0,299}$/

function device(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return 'tablet'
  if (/mobi|iphone|android/i.test(ua)) return 'mobile'
  return 'desktop'
}

function referrerHost(raw: unknown, ownHost: string): string {
  if (typeof raw !== 'string' || !raw) return ''
  try {
    const host = new URL(raw).hostname.replace(/^www\.|^m\.|^l\./, '')
    if (host === ownHost.replace(/^www\./, '')) return ''
    // Group the many Instagram/Facebook link hosts under one name.
    if (/(^|\.)instagram\.com$/.test(host)) return 'instagram.com'
    if (/(^|\.)facebook\.com$/.test(host)) return 'facebook.com'
    if (/(^|\.)google\./.test(host)) return 'google'
    return host.slice(0, 120)
  } catch {
    return ''
  }
}

export async function POST(request: NextRequest) {
  const ua = request.headers.get('user-agent') ?? ''
  if (!ua || BOT.test(ua) || request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1') return new NextResponse(null, { status: 204 })

  let body: { p?: unknown; r?: unknown }
  try {
    body = (await request.json()) as { p?: unknown; r?: unknown }
  } catch {
    return new NextResponse(null, { status: 204 })
  }
  const path = typeof body.p === 'string' ? body.p.split('?')[0]!.replace(/\/+$/, '') || '/' : ''
  if (!PATH.test(path) || path.startsWith('/admin') || path.startsWith('/api') || path.startsWith('/auth')) return new NextResponse(null, { status: 204 })

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0]!.trim()
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const salt = createHash('sha256').update(`tallyfield-analytics:${serverEnv().SUPABASE_SECRET_KEY}`).digest('hex')
  const visitor = createHash('sha256').update(`${day}|${salt}|${ip}|${ua}`).digest('hex').slice(0, 32)
  const country = (request.headers.get('x-vercel-ip-country') ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2)

  try {
    const { error } = await createServiceClient().rpc('track_page_view', {
      p_path: path,
      p_referrer_host: referrerHost(body.r, request.nextUrl.hostname),
      p_country: country,
      p_device: device(ua),
      p_visitor_hash: visitor,
    })
    if (error) console.error('[track]', error.message)
  } catch (e) {
    console.error('[track]', e instanceof Error ? e.message : e)
  }
  return new NextResponse(null, { status: 204 })
}

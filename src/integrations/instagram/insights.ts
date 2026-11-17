import 'server-only'

/**
 * Reads @tallyfield's account and post numbers from Meta's Graph API for the admin dashboard.
 * Likes and comments need only basic access. Reach, views, saves and shares need the instagram_manage_insights
 * permission on the token; without it those numbers come back empty and the dashboard says how to turn them on.
 * Responses are cached for 15 minutes so opening the dashboard repeatedly does not hit Meta each time.
 */

export interface IgAccount {
  username: string
  name: string
  followers: number | null
  following: number | null
  posts: number | null
  picture: string | null
}

export interface IgPost {
  id: string
  permalink: string
  caption: string
  type: string
  timestamp: string
  thumbnail: string | null
  likes: number | null
  comments: number | null
  reach: number | null
  views: number | null
  saves: number | null
  shares: number | null
  interactions: number | null
}

export interface IgTotals {
  reach: number | null
  views: number | null
  engaged: number | null
  interactions: number | null
  profileViews: number | null
}

export interface IgReport {
  ok: boolean
  error: string | null
  insightsAvailable: boolean
  account: IgAccount | null
  totals: IgTotals | null
  posts: IgPost[]
}

interface Options {
  token: string
  accountId: string
  apiVersion: string
  days: number
}

const CACHE = { next: { revalidate: 900 } } as const

async function graph<T>(o: Options, path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://graph.facebook.com/${o.apiVersion}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const response = await fetch(url, { ...CACHE, headers: { Authorization: `Bearer ${o.token}` }, signal: AbortSignal.timeout(15_000) })
  const json = (await response.json().catch(() => ({}))) as T & { error?: { message?: string; code?: number } }
  if (!response.ok || json.error) {
    const err = new Error(json.error?.message ?? `Instagram returned ${response.status}`) as Error & { code?: number }
    err.code = json.error?.code
    throw err
  }
  return json
}

type InsightValue = { name: string; values?: { value: number }[]; total_value?: { value: number } }

function pick(data: InsightValue[] | undefined, name: string): number | null {
  const m = data?.find((d) => d.name === name)
  if (!m) return null
  if (m.total_value) return m.total_value.value
  return m.values?.reduce((sum, v) => sum + (typeof v.value === 'number' ? v.value : 0), 0) ?? null
}

export async function instagramReport(o: Options): Promise<IgReport> {
  const report: IgReport = { ok: false, error: null, insightsAvailable: false, account: null, totals: null, posts: [] }
  try {
    const a = await graph<{ username?: string; name?: string; followers_count?: number; follows_count?: number; media_count?: number; profile_picture_url?: string }>(o, o.accountId, {
      fields: 'username,name,followers_count,follows_count,media_count,profile_picture_url',
    })
    report.account = {
      username: a.username ?? 'tallyfield',
      name: a.name ?? '',
      followers: a.followers_count ?? null,
      following: a.follows_count ?? null,
      posts: a.media_count ?? null,
      picture: a.profile_picture_url ?? null,
    }

    const media = await graph<{ data: { id: string; permalink: string; caption?: string; media_type: string; timestamp: string; thumbnail_url?: string; media_url?: string; like_count?: number; comments_count?: number }[] }>(
      o,
      `${o.accountId}/media`,
      { fields: 'id,permalink,caption,media_type,timestamp,thumbnail_url,media_url,like_count,comments_count', limit: '30' },
    )
    report.posts = media.data.map((m) => ({
      id: m.id,
      permalink: m.permalink,
      caption: (m.caption ?? '').split('\n')[0]!.slice(0, 140),
      type: m.media_type,
      timestamp: m.timestamp,
      thumbnail: m.thumbnail_url ?? (m.media_type === 'VIDEO' ? null : (m.media_url ?? null)),
      likes: m.like_count ?? null,
      comments: m.comments_count ?? null,
      reach: null,
      views: null,
      saves: null,
      shares: null,
      interactions: null,
    }))
    report.ok = true
  } catch (e) {
    report.error = e instanceof Error ? e.message : 'Instagram did not respond.'
    return report
  }

  // Per-post insights (needs instagram_manage_insights). One request per post, newest 24 only.
  const results = await Promise.allSettled(
    report.posts.slice(0, 24).map((p) => graph<{ data: InsightValue[] }>(o, `${p.id}/insights`, { metric: 'reach,views,saved,shares,total_interactions' })),
  )
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') return
    const p = report.posts[i]!
    p.reach = pick(r.value.data, 'reach')
    p.views = pick(r.value.data, 'views')
    p.saves = pick(r.value.data, 'saved')
    p.shares = pick(r.value.data, 'shares')
    p.interactions = pick(r.value.data, 'total_interactions')
    report.insightsAvailable = true
  })

  // Account totals for the chosen period (Meta allows up to 30 days per request).
  try {
    const until = Math.floor(Date.now() / 1000)
    const since = until - Math.min(o.days, 30) * 86_400
    const t = await graph<{ data: InsightValue[] }>(o, `${o.accountId}/insights`, {
      metric: 'reach,views,accounts_engaged,total_interactions,profile_views',
      period: 'day',
      metric_type: 'total_value',
      since: String(since),
      until: String(until),
    })
    report.totals = {
      reach: pick(t.data, 'reach'),
      views: pick(t.data, 'views'),
      engaged: pick(t.data, 'accounts_engaged'),
      interactions: pick(t.data, 'total_interactions'),
      profileViews: pick(t.data, 'profile_views'),
    }
    report.insightsAvailable = true
  } catch {
    // Missing permission or metric not available yet: leave totals empty.
  }
  return report
}

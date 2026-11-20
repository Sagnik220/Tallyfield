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
  /** FEED, REELS or STORY. */
  product: string
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
  /** When these numbers were fetched from Instagram. */
  fetchedAt: string
}

interface Options {
  token: string
  accountId: string
  apiVersion: string
  days: number
}

/** Account and post list: 15 minutes. Per-post insights change slowly and cost one request each: 1 hour. */
const LIST_SECONDS = 900
const INSIGHT_SECONDS = 3600
/** Most posts read from Instagram (a few years of daily posting). */
const MAX_POSTS = 600

async function graph<T>(o: Options, path: string, params: Record<string, string>, revalidate = LIST_SECONDS): Promise<T> {
  const url = new URL(path.startsWith('https://') ? path : `https://graph.facebook.com/${o.apiVersion}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const response = await fetch(url, { next: { revalidate }, headers: { Authorization: `Bearer ${o.token}` }, signal: AbortSignal.timeout(15_000) })
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
  const report: IgReport = { ok: false, error: null, insightsAvailable: false, account: null, totals: null, posts: [], fetchedAt: new Date().toISOString() }
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

    type MediaPage = {
      data: { id: string; permalink: string; caption?: string; media_type: string; media_product_type?: string; timestamp: string; thumbnail_url?: string; media_url?: string; like_count?: number; comments_count?: number }[]
      paging?: { cursors?: { after?: string }; next?: string }
    }
    const fields = 'id,permalink,caption,media_type,media_product_type,timestamp,thumbnail_url,media_url,like_count,comments_count'
    const all: MediaPage['data'] = []
    let after: string | undefined
    do {
      const page: MediaPage = await graph<MediaPage>(o, `${o.accountId}/media`, { fields, limit: '100', ...(after ? { after } : {}) })
      all.push(...page.data)
      after = page.paging?.next ? page.paging.cursors?.after : undefined
    } while (after && all.length < MAX_POSTS)
    report.posts = all.map((m) => ({
      id: m.id,
      permalink: m.permalink,
      caption: (m.caption ?? '').split('\n')[0]!.slice(0, 160),
      type: m.media_type,
      product: m.media_product_type ?? 'FEED',
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

  // Per-post insights (needs instagram_manage_insights). One request per post, a few at a time, cached for an hour.
  const queue = [...report.posts]
  async function worker() {
    for (let p = queue.shift(); p; p = queue.shift()) {
      try {
        const r = await graph<{ data: InsightValue[] }>(o, `${p.id}/insights`, { metric: 'reach,views,saved,shares,total_interactions' }, INSIGHT_SECONDS)
        p.reach = pick(r.data, 'reach')
        p.views = pick(r.data, 'views')
        p.saves = pick(r.data, 'saved')
        p.shares = pick(r.data, 'shares')
        p.interactions = pick(r.data, 'total_interactions')
        report.insightsAvailable = true
      } catch (e) {
        // No permission: stop asking for every remaining post.
        if ((e as { code?: number }).code === 10 || (e as { code?: number }).code === 200) queue.length = 0
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))

  // Account totals for the chosen period. Meta allows 30 days per request: views, interactions and profile views
  // add up across 30-day windows; reach and accounts engaged count unique people, so they cover the last 30 days.
  try {
    const now = Math.floor(Date.now() / 1000)
    const windows: [number, number][] = []
    for (let left = o.days, end = now; left > 0; left -= 30, end -= 30 * 86_400) windows.push([end - Math.min(left, 30) * 86_400, end])
    const results = await Promise.all(
      windows.map(([since, until], i) =>
        graph<{ data: InsightValue[] }>(o, `${o.accountId}/insights`, {
          metric: i === 0 ? 'reach,views,accounts_engaged,total_interactions,profile_views' : 'views,total_interactions,profile_views',
          period: 'day',
          metric_type: 'total_value',
          since: String(since),
          until: String(until),
        }),
      ),
    )
    const add = (name: string) => {
      const vals = results.map((r) => pick(r.data, name)).filter((v): v is number => v !== null)
      return vals.length ? vals.reduce((x, y) => x + y, 0) : null
    }
    report.totals = {
      reach: pick(results[0]!.data, 'reach'),
      views: add('views'),
      engaged: pick(results[0]!.data, 'accounts_engaged'),
      interactions: add('total_interactions'),
      profileViews: add('profile_views'),
    }
    report.insightsAvailable = true
  } catch {
    // Missing permission or metric not available yet: leave totals empty.
  }
  return report
}

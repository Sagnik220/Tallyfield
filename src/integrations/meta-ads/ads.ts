import 'server-only'

/**
 * Paid results from Meta's Marketing API (ads and boosted posts) for the admin dashboard.
 * Instagram's own insights count organic activity only, so paid numbers here can be added to them without
 * double counting — except reach, where the same person can be reached both ways.
 *
 * Needs the ads_read permission on the token and the ad account assigned to the token's system user.
 * Responses are cached for 15 minutes.
 */

export type AdsSetup = 'no_permission' | 'no_account' | null

export interface AdMetrics {
  spend: number
  impressions: number
  reach: number
  clicks: number
  linkClicks: number
  likes: number
  comments: number
  saves: number
  shares: number
  /** likes + comments + saves + shares */
  interactions: number
  videoViews: number
}

export interface AdRow extends AdMetrics {
  id: string
  name: string
  status: string
  account: string
  /** Instagram media ids this ad promotes (to match it to an organic post). */
  mediaIds: string[]
  permalink: string | null
  thumbnail: string | null
}

export interface AdsReport {
  ok: boolean
  error: string | null
  setup: AdsSetup
  accounts: { id: string; name: string; currency: string }[]
  currency: string
  totals: AdMetrics | null
  /** Paid results on Instagram placements only (the part of Instagram's own totals that came from ads). */
  instagram: AdMetrics | null
  daily: { day: string; spend: number; impressions: number }[]
  platforms: { platform: string; impressions: number; spend: number }[]
  /** Every ad with its lifetime results (most recent first). */
  ads: AdRow[]
}

interface Options {
  token: string
  apiVersion: string
  since: string // YYYY-MM-DD
  until: string // YYYY-MM-DD
}

type Action = { action_type: string; value: string }
type InsightRow = {
  spend?: string
  impressions?: string
  reach?: string
  clicks?: string
  inline_link_clicks?: string
  actions?: Action[]
  date_start?: string
  publisher_platform?: string
}

class GraphError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message)
  }
}

async function graph<T>(o: Options, path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://graph.facebook.com/${o.apiVersion}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const response = await fetch(url, { next: { revalidate: 900 }, headers: { Authorization: `Bearer ${o.token}` }, signal: AbortSignal.timeout(20_000) })
  const json = (await response.json().catch(() => ({}))) as T & { error?: { message?: string; code?: number } }
  if (!response.ok || json.error) throw new GraphError(json.error?.message ?? `Meta returned ${response.status}`, json.error?.code)
  return json
}

const num = (v: string | undefined) => (v ? Number(v) || 0 : 0)
const act = (actions: Action[] | undefined, ...types: string[]) => actions?.filter((a) => types.includes(a.action_type)).reduce((s, a) => s + num(a.value), 0) ?? 0

export function metricsOf(r: InsightRow | undefined): AdMetrics {
  const likes = act(r?.actions, 'post_reaction', 'onsite_conversion.post_net_like')
  const comments = act(r?.actions, 'comment')
  const saves = act(r?.actions, 'onsite_conversion.post_save', 'onsite_conversion.post_net_save')
  const shares = act(r?.actions, 'post')
  return {
    spend: num(r?.spend),
    impressions: num(r?.impressions),
    reach: num(r?.reach),
    clicks: num(r?.clicks),
    linkClicks: num(r?.inline_link_clicks) || act(r?.actions, 'link_click'),
    likes,
    comments,
    saves,
    shares,
    interactions: likes + comments + saves + shares,
    videoViews: act(r?.actions, 'video_view'),
  }
}

export function addMetrics(a: AdMetrics, b: AdMetrics): AdMetrics {
  const out = { ...a }
  for (const k of Object.keys(out) as (keyof AdMetrics)[]) out[k] += b[k]
  return out
}

const ZERO = metricsOf(undefined)
const FIELDS = 'spend,impressions,reach,clicks,inline_link_clicks,actions'

export async function adsReport(o: Options): Promise<AdsReport> {
  const report: AdsReport = { ok: false, error: null, setup: null, accounts: [], currency: 'INR', totals: null, instagram: null, daily: [], platforms: [], ads: [] }
  const range = JSON.stringify({ since: o.since, until: o.until })

  try {
    const accounts = await graph<{ data: { id: string; name?: string; currency?: string; account_status?: number }[] }>(o, 'me/adaccounts', { fields: 'name,currency,account_status', limit: '50' })
    report.accounts = accounts.data.map((a) => ({ id: a.id, name: a.name ?? a.id, currency: a.currency ?? 'INR' }))
  } catch (e) {
    const code = (e as GraphError).code
    report.setup = code === 200 || code === 10 || code === 100 || code === 190 ? 'no_permission' : null
    report.error = e instanceof Error ? e.message : 'Meta did not respond.'
    return report
  }
  if (report.accounts.length === 0) {
    report.setup = 'no_account'
    return report
  }
  report.currency = report.accounts[0]!.currency

  const daily = new Map<string, { day: string; spend: number; impressions: number }>()
  const platforms = new Map<string, { platform: string; impressions: number; spend: number }>()
  let totals = ZERO
  let instagram = ZERO
  try {
    await Promise.all(
      report.accounts.map(async (a) => {
        const [sum, days, plats, ads] = await Promise.all([
          graph<{ data: InsightRow[] }>(o, `${a.id}/insights`, { fields: FIELDS, time_range: range, level: 'account' }),
          graph<{ data: InsightRow[] }>(o, `${a.id}/insights`, { fields: 'spend,impressions', time_range: range, time_increment: '1', limit: '100' }),
          graph<{ data: InsightRow[] }>(o, `${a.id}/insights`, { fields: FIELDS, time_range: range, breakdowns: 'publisher_platform' }),
          listAds(o, a.id),
        ])
        totals = addMetrics(totals, metricsOf(sum.data[0]))
        for (const d of days.data) {
          const k = d.date_start ?? ''
          const cur = daily.get(k) ?? { day: k, spend: 0, impressions: 0 }
          cur.spend += num(d.spend)
          cur.impressions += num(d.impressions)
          daily.set(k, cur)
        }
        for (const p of plats.data) {
          const k = p.publisher_platform ?? 'other'
          if (k === 'instagram') instagram = addMetrics(instagram, metricsOf(p))
          const cur = platforms.get(k) ?? { platform: k, impressions: 0, spend: 0 }
          cur.impressions += num(p.impressions)
          cur.spend += num(p.spend)
          platforms.set(k, cur)
        }
        report.ads.push(...ads)
      }),
    )
  } catch (e) {
    report.error = e instanceof Error ? e.message : 'Meta did not respond.'
    report.setup = (e as GraphError).code === 200 || (e as GraphError).code === 10 ? 'no_permission' : null
    return report
  }
  report.ok = true
  report.totals = totals
  report.instagram = instagram
  report.daily = [...daily.values()].sort((a, b) => a.day.localeCompare(b.day))
  report.platforms = [...platforms.values()].sort((a, b) => b.impressions - a.impressions)
  return report
}

type AdNode = {
  id: string
  name?: string
  effective_status?: string
  created_time?: string
  creative?: { source_instagram_media_id?: string; effective_instagram_media_id?: string; instagram_permalink_url?: string; thumbnail_url?: string }
  insights?: { data: InsightRow[] }
}

/** Every ad in an account (up to 500) with lifetime results and the Instagram post it promotes. */
async function listAds(o: Options, accountId: string): Promise<AdRow[]> {
  const out: AdRow[] = []
  let after: string | undefined
  for (let page = 0; page < 5; page += 1) {
    const res = await graph<{ data: AdNode[]; paging?: { cursors?: { after?: string }; next?: string } }>(o, `${accountId}/ads`, {
      fields: `name,effective_status,created_time,creative{source_instagram_media_id,effective_instagram_media_id,instagram_permalink_url,thumbnail_url},insights.date_preset(maximum){${FIELDS}}`,
      limit: '100',
      ...(after ? { after } : {}),
    })
    for (const ad of res.data) {
      const c = ad.creative ?? {}
      out.push({
        id: ad.id,
        name: ad.name ?? ad.id,
        status: ad.effective_status ?? '',
        account: accountId,
        mediaIds: [c.source_instagram_media_id, c.effective_instagram_media_id].filter((x): x is string => Boolean(x)),
        permalink: c.instagram_permalink_url ?? null,
        thumbnail: c.thumbnail_url ?? null,
        ...metricsOf(ad.insights?.data[0]),
      })
    }
    after = res.paging?.next ? res.paging.cursors?.after : undefined
    if (!after) break
  }
  return out
}

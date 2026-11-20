import 'server-only'
import { serverEnv } from '@/config/env.server'
import { listDailyViews, type DailyRow } from '@/data/analytics.repo'
import { listPostSummariesForAdmin, type PostSummary } from '@/data/posts.repo'
import { getIntegrationToken } from '@/data/tokens.repo'
import { instagramReport, type IgReport } from '@/integrations/instagram/insights'
import { adsReport, type AdsReport } from '@/integrations/meta-ads/ads'
import type { Db } from '@/lib/supabase/server'

export const RANGES = [7, 30, 90] as const

export function parseDays(range: string | undefined): number {
  const raw = Number(range)
  return (RANGES as readonly number[]).includes(raw) ? raw : 30
}

/** First day of the range (computed per request; these pages are never cached). */
export function rangeStart(days: number): Date {
  return new Date(Date.now() - (days - 1) * 86_400_000)
}
export const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
export { normalisePermalink, paidByMedia } from './merge'

export async function loadInstagram(days: number): Promise<IgReport> {
  const empty: IgReport = { ok: false, error: null, insightsAvailable: false, account: null, totals: null, posts: [], fetchedAt: new Date().toISOString() }
  try {
    const env = serverEnv()
    if (!env.INSTAGRAM_ACCOUNT_ID) return { ...empty, error: 'INSTAGRAM_ACCOUNT_ID is not set.' }
    const token = await getIntegrationToken('instagram')
    return await instagramReport({ token, accountId: env.INSTAGRAM_ACCOUNT_ID, apiVersion: env.INSTAGRAM_API_VERSION, days })
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : 'Instagram is not connected.' }
  }
}

export async function loadAds(days: number): Promise<AdsReport> {
  const empty: AdsReport = { ok: false, error: null, setup: null, accounts: [], currency: 'INR', totals: null, instagram: null, daily: [], platforms: [], ads: [] }
  try {
    const token = await getIntegrationToken('instagram')
    return await adsReport({ token, apiVersion: serverEnv().INSTAGRAM_API_VERSION, since: dayKey(rangeStart(days)), until: dayKey(new Date()) })
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : 'Meta Ads is not connected.' }
  }
}

export async function loadSite(db: Db, days: number): Promise<{ rows: DailyRow[]; posts: PostSummary[] }> {
  const [rows, posts] = await Promise.all([listDailyViews(db, dayKey(rangeStart(days))).catch(() => [] as DailyRow[]), listPostSummariesForAdmin(db).catch(() => [] as PostSummary[])])
  return { rows, posts }
}

export function siteViewsByPost(rows: DailyRow[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) if (r.post_id) m.set(r.post_id, (m.get(r.post_id) ?? 0) + r.views)
  return m
}

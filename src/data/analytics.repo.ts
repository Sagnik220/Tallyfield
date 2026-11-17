import type { Db } from '@/lib/supabase/server'
import { raise } from './errors'

export interface DailyRow {
  day: string
  path: string
  post_id: string | null
  referrer_host: string
  country: string
  device: 'mobile' | 'tablet' | 'desktop'
  views: number
  visitors: number
}

/** Daily site totals since a date (staff only, through row level security). */
export async function listDailyViews(db: Db, fromDay: string): Promise<DailyRow[]> {
  const rows: DailyRow[] = []
  // Page through in chunks so a busy month is not cut off by the API's row limit.
  for (let offset = 0; offset < 50_000; offset += 1000) {
    const { data, error } = await db
      .from('page_views_daily')
      .select('day, path, post_id, referrer_host, country, device, views, visitors')
      .gte('day', fromDay)
      .order('day')
      .range(offset, offset + 999)
    if (error) raise(error, 'listDailyViews')
    rows.push(...((data ?? []) as DailyRow[]))
    if (!data || data.length < 1000) break
  }
  return rows
}

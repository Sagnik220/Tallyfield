import type { Metadata } from 'next'
import { AdsTable, type AdTableRow } from '../ads-table'
import { DailyChart, type DayPoint } from '../daily-chart'
import { dayKey, loadAds, loadInstagram, normalisePermalink, parseDays, rangeStart } from '../data'
import { AdsSetupCard, fmt, money, Ranked, SectionTitle, Tile, Tiles } from '../ui'

export const metadata: Metadata = { title: 'Ads · Analytics' }

const PLATFORM: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', audience_network: 'Audience Network', messenger: 'Messenger', threads: 'Threads' }

export default async function AdsAnalytics({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const days = parseDays((await searchParams).range)
  const [ads, ig] = await Promise.all([loadAds(days), loadInstagram(days)])

  if (!ads.ok) {
    return (
      <section style={{ display: 'grid', gap: 14 }}>
        <SectionTitle>Ads &amp; boosted posts</SectionTitle>
        <AdsSetupCard setup={ads.setup} error={ads.error} />
      </section>
    )
  }

  const c = ads.currency
  const t = ads.totals!
  const from = rangeStart(days)
  const byDay = new Map<string, DayPoint>()
  for (let i = 0; i < days; i += 1) {
    const d = dayKey(new Date(from.getTime() + i * 86_400_000))
    byDay.set(d, { day: d, value: 0, extra: 0 })
  }
  for (const d of ads.daily) {
    const p = byDay.get(d.day)
    if (p) {
      p.value += d.spend
      p.extra = (p.extra ?? 0) + d.impressions
    }
  }
  const igById = new Map(ig.posts.map((p) => [p.id, p]))
  const igByPermalink = new Map(ig.posts.map((p) => [normalisePermalink(p.permalink), p]))
  const rows: AdTableRow[] = ads.ads.map((a) => {
    const post = a.mediaIds.map((id) => igById.get(id)).find(Boolean) ?? (a.permalink ? igByPermalink.get(normalisePermalink(a.permalink)) : undefined)
    return { ...a, postCaption: post?.caption ?? null, postPermalink: post?.permalink ?? null }
  })
  const platformTotal = ads.platforms.reduce((s, p) => s + p.impressions, 0)

  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <SectionTitle note={`Only ads promoting @tallyfield posts${ads.hidden ? ` (${ads.hidden} ad${ads.hidden === 1 ? '' : 's'} for other accounts, such as Minted Store, are hidden)` : ''}. Paid results only; refreshes every 15 minutes.`}>Ads &amp; boosted posts · last {days} days</SectionTitle>
      <Tiles>
        <Tile label="Spend" value={money(t.spend, c)} />
        <Tile label="Impressions" value={fmt(t.impressions)} note="Times your ads were seen" />
        <Tile label="Reach" value={fmt(t.reach)} note={t.reach ? `Seen ${(t.impressions / t.reach).toFixed(1)}× each on average` : undefined} />
        <Tile label="Interactions" value={fmt(t.interactions)} note={`${fmt(t.likes)} likes · ${fmt(t.comments)} comments · ${fmt(t.saves)} saves · ${fmt(t.shares)} shares`} />
        <Tile label="Link clicks" value={fmt(t.linkClicks)} note={t.impressions ? `${((t.linkClicks / t.impressions) * 100).toFixed(2)}% click-through` : undefined} />
        <Tile label="Cost / 1,000 views" value={t.impressions ? money((t.spend / t.impressions) * 1000, c, 2) : '—'} />
        <Tile label="Cost / interaction" value={t.interactions ? money(t.spend / t.interactions, c, 2) : '—'} />
        <Tile label="Cost / link click" value={t.linkClicks ? money(t.spend / t.linkClicks, c, 2) : '—'} />
      </Tiles>
      <section className="tf-panel">
        <h2>Spend per day</h2>
        {t.spend === 0 ? (
          <p className="tf-note" style={{ fontSize: 13 }}>
            No ad spend in this period.
          </p>
        ) : null}
        <DailyChart points={[...byDay.values()]} valueLabel="spent" extraLabel="impressions" currency={c} ariaLabel="Ad spend per day" />
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <Ranked title="Where ads were seen" rows={ads.platforms.map((p) => ({ label: PLATFORM[p.platform] ?? p.platform, value: p.impressions }))} total={platformTotal} empty="No impressions in this period." />
      </div>
      <AdsTable rows={rows} currency={c} />
    </section>
  )
}

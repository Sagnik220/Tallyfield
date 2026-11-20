import type { Metadata } from 'next'
import Link from 'next/link'
import { createSessionClient } from '@/lib/supabase/server'
import { CombinedTable, type CombinedRow } from './combined-table'
import { loadAds, loadInstagram, loadSite, normalisePermalink, paidByMedia, parseDays, siteViewsByPost } from './data'
import { AdsSetupCard, fmt, money, pct, SectionTitle, SplitTile, Tile, Tiles } from './ui'

export const metadata: Metadata = { title: 'Analytics' }

/** Overview: organic (Instagram) + paid (Meta Ads) added together, plus the website, for the chosen period. */
export default async function AnalyticsOverview({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const sp = await searchParams
  const days = parseDays(sp.range)
  const db = await createSessionClient()
  const [ig, ads, site] = await Promise.all([loadInstagram(days), loadAds(days), loadSite(db, days)])
  const paidReady = ads.ok
  const t = ads.totals
  const c = ads.currency
  const q = days === 30 ? '' : `?range=${days}`

  const siteViews = site.rows.reduce((s, r) => s + r.views, 0)
  const fromInstagram = site.rows.filter((r) => r.referrer_host === 'instagram.com').reduce((s, r) => s + r.views, 0)

  const paid = paidByMedia(ads.ads, ig.posts)
  const views = siteViewsByPost(site.rows)
  const byPermalink = new Map(site.posts.filter((p) => p.source_url).map((p) => [normalisePermalink(p.source_url), p]))
  const rows: CombinedRow[] = ig.posts.map((p) => {
    const m = paid.get(p.id)
    const sitePost = byPermalink.get(normalisePermalink(p.permalink))
    const organicInteractions = p.saves === null && p.shares === null ? (p.likes ?? 0) + (p.comments ?? 0) : (p.likes ?? 0) + (p.comments ?? 0) + (p.saves ?? 0) + (p.shares ?? 0)
    return {
      id: p.id,
      permalink: p.permalink,
      caption: p.caption,
      timestamp: p.timestamp,
      thumbnail: p.thumbnail,
      organicViews: p.views,
      paidViews: m?.impressions ?? 0,
      organicInteractions,
      paidInteractions: m?.interactions ?? 0,
      spend: m?.spend ?? 0,
      ads: m?.ads ?? 0,
      sitePostId: sitePost?.id ?? null,
      siteViews: sitePost ? (views.get(sitePost.id) ?? 0) : null,
    }
  })

  return (
    <>
      <section style={{ display: 'grid', gap: 14 }}>
        <SectionTitle
          note={
            <>
              Organic numbers come from Instagram, paid from Meta Ads (boosts and ads), added together. <span className="tf-split-key tf-split-organic" /> Organic <span className="tf-split-key tf-split-paid" style={{ marginLeft: 10 }} /> Paid
            </>
          }
        >
          Organic + paid · last {days} days
        </SectionTitle>
        {!paidReady ? <AdsSetupCard setup={ads.setup} error={ads.error} /> : null}
        {!ig.ok ? (
          <div className="tf-alert" role="alert">
            Instagram numbers are unavailable: {ig.error ?? 'unknown error'}
          </div>
        ) : null}
        <Tiles>
          <SplitTile label="Views" organic={ig.totals?.views ?? null} paid={t?.impressions ?? null} paidReady={paidReady} />
          <SplitTile label="Interactions" organic={ig.totals?.interactions ?? null} paid={t?.interactions ?? null} paidReady={paidReady} />
          <SplitTile label={days > 30 ? 'Reach (organic: last 30 days)' : 'Reach'} organic={ig.totals?.reach ?? null} paid={t?.reach ?? null} paidReady={paidReady} additive={false} />
          <Tile
            label="Ad spend"
            value={paidReady ? money(t!.spend, c) : '—'}
            note={paidReady && t!.impressions ? `${money((t!.spend / t!.impressions) * 1000, c, 2)} per 1,000 paid views${t!.interactions ? ` · ${money(t!.spend / t!.interactions, c, 2)} per interaction` : ''}` : undefined}
          />
          <Tile label="Followers" value={fmt(ig.account?.followers)} note="Current total" />
          <Tile label="Website page views" value={fmt(siteViews)} note={`${pct(fromInstagram, siteViews)} came from Instagram`} />
        </Tiles>
        <p className="tf-note" style={{ fontSize: 12, margin: 0 }}>
          Details:{' '}
          <Link href={`/admin/analytics/instagram${q}`} style={{ color: 'var(--gold-light)' }}>
            Instagram
          </Link>{' '}
          ·{' '}
          <Link href={`/admin/analytics/ads${q}`} style={{ color: 'var(--gold-light)' }}>
            Ads
          </Link>{' '}
          ·{' '}
          <Link href={`/admin/analytics/website${q}`} style={{ color: 'var(--gold-light)' }}>
            Website
          </Link>
        </p>
      </section>

      {ig.ok ? (
        <section style={{ display: 'grid', gap: 14 }}>
          <SectionTitle note="Which posts did best once ads are counted, and what each paid result cost.">Posts · organic + paid</SectionTitle>
          <CombinedTable rows={rows} currency={c} adsReady={paidReady} />
        </section>
      ) : null}
    </>
  )
}

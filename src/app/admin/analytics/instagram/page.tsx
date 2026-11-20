import type { Metadata } from 'next'
import { createSessionClient } from '@/lib/supabase/server'
import { loadInstagram, loadSite, normalisePermalink, parseDays, siteViewsByPost } from '../data'
import { IgPostsTable, type IgRow } from '../ig-posts-table'
import { fmt, SectionTitle, Tile, Tiles } from '../ui'

export const metadata: Metadata = { title: 'Instagram · Analytics' }

export default async function InstagramAnalytics({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const days = parseDays((await searchParams).range)
  const db = await createSessionClient()
  const [ig, site] = await Promise.all([loadInstagram(days), loadSite(db, days)])
  const views = siteViewsByPost(site.rows)
  const byPermalink = new Map(site.posts.filter((p) => p.source_url).map((p) => [normalisePermalink(p.source_url), p]))
  const rows: IgRow[] = ig.posts.map((p) => {
    const sitePost = byPermalink.get(normalisePermalink(p.permalink))
    return { ...p, sitePostId: sitePost?.id ?? null, siteViews: sitePost ? (views.get(sitePost.id) ?? 0) : null }
  })
  const d = Math.min(days, 30)

  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <SectionTitle note={ig.ok ? 'Account totals include activity from ads; the per-post table counts organic activity only (ad results are on the Ads tab). Refreshes every 15 minutes; per-post insights hourly.' : undefined}>
        Instagram {ig.account ? `· @${ig.account.username}` : ''}
      </SectionTitle>
      {!ig.ok ? (
        <div className="tf-alert" role="alert">
          Instagram numbers are unavailable: {ig.error ?? 'unknown error'}
        </div>
      ) : (
        <>
          <Tiles>
            <Tile label="Followers" value={fmt(ig.account?.followers)} />
            <Tile label="Posts" value={fmt(ig.account?.posts)} />
            <Tile label={`Reach · ${d} days`} value={fmt(ig.totals?.reach)} note={days > 30 ? "Unique accounts, last 30 days (Instagram's limit)" : "Accounts that saw your content"} />
            <Tile label={`Views · ${days} days`} value={fmt(ig.totals?.views)} />
            <Tile label="Accounts engaged" value={fmt(ig.totals?.engaged)} />
            <Tile label="Profile views" value={fmt(ig.totals?.profileViews)} />
          </Tiles>
          {!ig.insightsAvailable ? (
            <div className="tf-alert">
              Likes and comments are showing. <strong>Reach, views, saves and shares</strong> need the <code>instagram_manage_insights</code> permission on your token.
            </div>
          ) : null}
          <IgPostsTable rows={rows} insights={ig.insightsAvailable} siteDays={days} />
        </>
      )}
    </section>
  )
}

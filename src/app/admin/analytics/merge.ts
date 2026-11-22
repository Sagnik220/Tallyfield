import { addMetrics, type AdMetrics, type AdRow } from '@/integrations/meta-ads/ads'
import type { IgPost } from '@/integrations/instagram/insights'

/**
 * One key per Instagram post, whatever shape its link has (www or not, /p/ /reel/ /reels/ /tv/, tracking query):
 * the post's short code. Other links fall back to the link without its query string.
 */
export function normalisePermalink(url: string | null): string {
  if (!url) return ''
  const m = /instagram\.com\/(?:[\w.]+\/)?(?:p|reels?|tv)\/([A-Za-z0-9_-]+)/.exec(url)
  return m ? `ig:${m[1]}` : url.replace(/[?#].*$/, '').replace(/\/?$/, '/')
}

/** Ad results per Instagram post (several ads can promote the same post). */
export function paidByMedia(ads: AdRow[], ig: IgPost[]): Map<string, AdMetrics & { ads: number }> {
  const byPermalink = new Map(ig.map((p) => [normalisePermalink(p.permalink), p.id]))
  const out = new Map<string, AdMetrics & { ads: number }>()
  for (const ad of ads) {
    const mediaId = ad.mediaIds.find((id) => ig.some((p) => p.id === id)) ?? (ad.permalink ? byPermalink.get(normalisePermalink(ad.permalink)) : undefined)
    if (!mediaId) continue
    const { spend, impressions, reach, clicks, linkClicks, likes, comments, saves, shares, interactions, videoViews } = ad
    const cur = out.get(mediaId)
    const m = { spend, impressions, reach, clicks, linkClicks, likes, comments, saves, shares, interactions, videoViews }
    out.set(mediaId, cur ? { ...addMetrics(cur, m), ads: cur.ads + 1 } : { ...m, ads: 1 })
  }
  return out
}


/** True for ads that promote one of the account's own posts (by media id or by link). */
export function isOwnAd(posts: { id: string; permalink: string }[]) {
  const ids = new Set(posts.map((p) => p.id))
  const links = new Set(posts.map((p) => normalisePermalink(p.permalink)))
  return (ad: { mediaIds: string[]; permalink: string | null }) => ad.mediaIds.some((id) => ids.has(id)) || (ad.permalink !== null && links.has(normalisePermalink(ad.permalink)))
}

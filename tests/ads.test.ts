import { describe, expect, it } from 'vitest'
import { addMetrics, metricsOf, type AdRow } from '@/integrations/meta-ads/ads'
import { paidByMedia } from '@/app/admin/analytics/merge'

describe('Meta Ads metrics', () => {
  it('reads spend, delivery and post interactions from Marketing API action types', () => {
    const m = metricsOf({
      spend: '1250.50',
      impressions: '40000',
      reach: '22000',
      clicks: '900',
      inline_link_clicks: '310',
      actions: [
        { action_type: 'post_reaction', value: '800' },
        { action_type: 'comment', value: '40' },
        { action_type: 'onsite_conversion.post_save', value: '120' },
        { action_type: 'post', value: '35' },
        { action_type: 'page_engagement', value: '5000' }, // not counted as an interaction
        { action_type: 'video_view', value: '7000' },
      ],
    })
    expect(m).toMatchObject({ spend: 1250.5, impressions: 40000, reach: 22000, linkClicks: 310, likes: 800, comments: 40, saves: 120, shares: 35, interactions: 995, videoViews: 7000 })
  })
  it('treats missing numbers as zero and adds metrics field by field', () => {
    const empty = metricsOf(undefined)
    expect(empty.spend).toBe(0)
    expect(addMetrics(metricsOf({ spend: '10', impressions: '100' }), metricsOf({ spend: '5', impressions: '50' }))).toMatchObject({ spend: 15, impressions: 150 })
  })
})

describe('matching ads to Instagram posts', () => {
  const ad = (id: string, over: Partial<AdRow>): AdRow => ({ ...metricsOf({ spend: '100', impressions: '1000', actions: [{ action_type: 'post_reaction', value: '10' }] }), id, name: id, status: 'ACTIVE', account: 'act_1', mediaIds: [], permalink: null, thumbnail: null, ...over })
  const ig = [
    { id: '111', permalink: 'https://www.instagram.com/p/AAA/' },
    { id: '222', permalink: 'https://www.instagram.com/reel/BBB/' },
  ] as never
  it('matches by media id or by permalink, and adds up several ads for the same post', () => {
    const m = paidByMedia(
      [
        ad('a1', { mediaIds: ['999', '111'] }), // boost: effective id differs, source id matches
        ad('a2', { mediaIds: ['111'] }),
        ad('a3', { permalink: 'https://instagram.com/reels/BBB?igsh=x' }), // matched through the link
        ad('a4', { mediaIds: ['333'] }), // a post not on the account: ignored
      ],
      ig,
    )
    expect(m.get('111')).toMatchObject({ ads: 2, spend: 200, impressions: 2000, interactions: 20 })
    expect(m.get('222')).toMatchObject({ ads: 1, spend: 100 })
    expect(m.has('333')).toBe(false)
  })
})

describe('normalisePermalink', () => {
  it('gives every link to the same post the same key', async () => {
    const { normalisePermalink } = await import('@/app/admin/analytics/merge')
    const keys = ['https://www.instagram.com/p/AbC_1/', 'https://instagram.com/p/AbC_1?igsh=xyz', 'https://www.instagram.com/tallyfield/p/AbC_1/', 'https://www.instagram.com/reel/AbC_1'].map(normalisePermalink)
    expect(new Set(keys).size).toBe(1)
    expect(normalisePermalink('https://www.instagram.com/reels/XyZ/')).toBe(normalisePermalink('https://www.instagram.com/reel/XyZ/'))
    expect(normalisePermalink(null)).toBe('')
  })
})

describe('keeping only @tallyfield ads', () => {
  it('keeps ads promoting the account’s own posts and drops ads for other brands', async () => {
    const { isOwnAd } = await import('@/app/admin/analytics/merge')
    const keep = isOwnAd([
      { id: '111', permalink: 'https://www.instagram.com/p/TALLY1/' },
      { id: '222', permalink: 'https://www.instagram.com/reel/TALLY2/' },
    ])
    expect(keep({ mediaIds: ['111'], permalink: null })).toBe(true) // boosted post, by media id
    expect(keep({ mediaIds: ['legacy-999'], permalink: 'https://instagram.com/reels/TALLY2?igsh=a' })).toBe(true) // by link
    expect(keep({ mediaIds: ['555'], permalink: 'https://www.instagram.com/p/MINTED1/' })).toBe(false) // Minted Store
    expect(keep({ mediaIds: [], permalink: null })).toBe(false)
  })
})

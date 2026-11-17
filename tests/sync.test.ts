import { beforeEach, describe, expect, it, vi } from 'vitest'

// In-memory stand-ins for the database layer.
const state = vi.hoisted(() => ({
  sources: [] as { external_id: string; post_id: string | null; caption: string }[],
  posts: new Map<string, { id: string; slug: string; title: string; deck: string; status: string; body: unknown; content_edited_at: string | null }>(),
  updates: [] as { id: string; values: Record<string, unknown> }[],
  sourceUpdates: [] as { externalId: string; caption: string }[],
  created: [] as { externalId: string; status: string }[],
}))

vi.mock('@/data/sources.repo', () => ({
  listSources: async () => state.sources,
  updateSourceCaption: async (_db: unknown, _p: string, externalId: string, caption: string) => void state.sourceUpdates.push({ externalId, caption }),
}))
vi.mock('@/data/posts.repo', () => ({
  getPostsForSync: async (_db: unknown, ids: string[]) => ids.map((id) => state.posts.get(id)).filter(Boolean),
  getPostById: async (_db: unknown, id: string) => state.posts.get(id),
  updatePost: async (_db: unknown, id: string, values: Record<string, unknown>) => {
    state.updates.push({ id, values })
    return { ...state.posts.get(id), ...values }
  },
  setPostTags: async () => undefined,
  setPostMedia: async () => undefined,
}))
vi.mock('@/services/import.service', async (orig) => {
  const real = await orig<typeof import('@/services/import.service')>()
  return {
    ...real,
    createFromImported: async (_ctx: unknown, imported: { externalId: string; imageUrls: string[] }, opts: { status: string }) => {
      if (imported.externalId === 'bad') throw new Error('download failed')
      state.created.push({ externalId: imported.externalId, status: opts.status })
      return { postId: `post-${imported.externalId}`, slides: imported.imageUrls.length }
    },
  }
})

const { planSync, runSyncBatch, withNewCaption } = await import('@/services/sync.service')
const { updatePost, stableJson } = await import('@/services/posts.service')

const img = (id: string, caption: string, extra: Record<string, unknown> = {}) => ({ id, permalink: `https://www.instagram.com/p/${id}x/`, caption, media_type: 'IMAGE', media_url: `https://scontent.cdninstagram.com/${id}.jpg`, ...extra })
const gallery = (caption: string) => ({ version: 1, blocks: [{ id: 'b', type: 'gallery', data: { mediaIds: ['m'], caption } }] })
const ctx = { db: {} as never, user: { id: 'u' } as never }

beforeEach(() => {
  state.sources = [
    { external_id: '2', post_id: 'p2', caption: 'Same caption' },
    { external_id: '3', post_id: 'p3', caption: 'Old caption\nmore' },
    { external_id: '4', post_id: 'p4', caption: 'Old caption' },
    { external_id: '5', post_id: null, caption: 'Deleted one' },
  ]
  state.posts = new Map([
    ['p2', { id: 'p2', slug: 's2', title: 'Same caption', deck: '', status: 'published', body: gallery('Same caption'), content_edited_at: null }],
    ['p3', { id: 'p3', slug: 's3', title: 'Old caption', deck: '', status: 'published', body: gallery('Old caption\nmore'), content_edited_at: null }],
    ['p4', { id: 'p4', slug: 's4', title: 'My own headline', deck: '', status: 'draft', body: gallery('Old caption'), content_edited_at: '2026-11-17T10:00:00Z' }],
  ])
  state.updates = []
  state.sourceUpdates = []
  state.created = []
})

const media = () => [
  img('9', 'Newest new post'),
  img('8', 'Second new post'),
  { id: '7', permalink: 'https://www.instagram.com/reel/7x/', caption: 'A reel', media_type: 'VIDEO', media_url: 'https://x.cdninstagram.com/v.mp4' },
  img('2', 'Same caption'),
  img('3', 'New caption on Instagram\nmore'),
  img('4', 'Changed on Instagram too'),
  img('5', 'Deleted one'),
  img('6', 'Oldest new post'),
]
const deps = { listMedia: async () => media() as never, imageHosts: ['cdninstagram.com'] }

describe('Instagram sync plan', () => {
  it('sorts every post into the right status', async () => {
    const items = await planSync({} as never, deps)
    const status = Object.fromEntries(items.map((i) => [i.externalId, i.status]))
    expect(status).toEqual({ '9': 'new', '8': 'new', '7': 'no_images', '2': 'current', '3': 'changed', '4': 'edited', '5': 'removed', '6': 'new' })
  })
})

describe('Instagram sync run', () => {
  it('refreshes captions only on posts not edited on the site, and leaves edited posts alone', async () => {
    await runSyncBatch(ctx, { categoryId: 'c', publish: false, updateCaptions: true, maxNew: 0, skip: [] }, deps)
    expect(state.updates.map((u) => u.id)).toEqual(['p3'])
    const u = state.updates[0]!.values as { title: string; body: { blocks: { data: { caption: string } }[] } }
    expect(u.body.blocks[0]!.data.caption).toBe('New caption on Instagram\nmore')
    expect(u.title).toBe('New caption on Instagram') // title was still the imported one, so it follows
    expect(u).not.toHaveProperty('content_edited_at') // sync never marks a post as edited
    expect(state.sourceUpdates).toEqual([{ externalId: '3', caption: 'New caption on Instagram\nmore' }])
  })

  it('imports new posts oldest first in small batches, never re-imports deleted posts, and skips failures', async () => {
    const first = await runSyncBatch(ctx, { categoryId: 'c', publish: true, updateCaptions: false, maxNew: 2, skip: [] }, deps)
    expect(state.created).toEqual([
      { externalId: '6', status: 'published' },
      { externalId: '8', status: 'published' },
    ])
    expect(first.remainingNew).toBe(1)
    expect(state.created.some((c) => c.externalId === '5')).toBe(false)
    expect(state.updates).toEqual([])
  })

  it('reports a failing post and lets later batches skip it', async () => {
    const withBad = { ...deps, listMedia: async () => [img('bad', 'Broken'), ...media()] as never }
    const r = await runSyncBatch(ctx, { categoryId: 'c', publish: false, updateCaptions: false, maxNew: 10, skip: [] }, withBad)
    expect(r.failed.map((f) => f.externalId)).toEqual(['bad'])
    state.created = []
    const again = await runSyncBatch(ctx, { categoryId: 'c', publish: false, updateCaptions: false, maxNew: 10, skip: ['bad'] }, withBad)
    expect(again.failed).toEqual([])
  })

  it('treats a post whose site caption was changed by hand, or that was unpacked, as edited', async () => {
    state.posts.get('p3')!.body = gallery('I tweaked this caption on the site')
    state.posts.get('p2')!.body = { version: 1, blocks: [{ id: 'r', type: 'rich_text', data: {} }] }
    const items = await planSync({} as never, deps)
    const status = Object.fromEntries(items.map((i) => [i.externalId, i.status]))
    expect(status['3']).toBe('edited')
    expect(status['2']).toBe('edited')
  })

  it('only rewrites a post with exactly one gallery', () => {
    expect(withNewCaption(gallery('a') as never, 'b')).not.toBeNull()
    expect(withNewCaption({ version: 1, blocks: [{ id: 'r', type: 'rich_text', data: {} }] } as never, 'b')).toBeNull()
  })
})

describe('marking posts as edited', () => {
  it('a save that changes the words marks the post; a save with no real change does not', async () => {
    state.posts.set('p9', { id: 'p9', slug: 's9', title: 'T', deck: '', status: 'draft', body: { version: 1, blocks: [{ type: 'gallery', id: 'b', data: { caption: 'x', mediaIds: ['m'] } }] }, content_edited_at: null })
    // Same content, keys in a different order (as the database returns them).
    await updatePost(ctx as never, { id: 'p9', title: 'T', body: { version: 1, blocks: [{ id: 'b', type: 'gallery', data: { mediaIds: ['m'], caption: 'x' } }] } } as never)
    expect(state.updates.at(-1)!.values).not.toHaveProperty('content_edited_at')
    await updatePost(ctx as never, { id: 'p9', title: 'A new headline' } as never)
    expect(state.updates.at(-1)!.values).toHaveProperty('content_edited_at')
  })
  it('stableJson ignores key order', () => {
    expect(stableJson({ a: 1, b: { c: 2, d: 3 } })).toBe(stableJson({ b: { d: 3, c: 2 }, a: 1 }))
  })
})

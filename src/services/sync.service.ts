import { CAPTION_MAX } from '@/blocks'
import type { Body } from '@/blocks'
import type { ActionContext } from '@/lib/action'
import type { Db } from '@/lib/supabase/server'
import * as posts from '@/data/posts.repo'
import { listSources, updateSourceCaption } from '@/data/sources.repo'
import type { InstagramMedia } from '@/integrations/importers/instagram/client'
import { toImportedPost } from '@/integrations/importers/instagram/importer'
import type { safeDownload } from '@/integrations/safe-fetch'
import { createFromImported, headlineFromCaption } from './import.service'

/**
 * Bulk sync with Instagram.
 *  - new:       on Instagram, not on the site yet → imported (as drafts, or published if asked).
 *  - changed:   caption changed on Instagram, post not edited on the site → caption (and an untouched title) refreshed.
 *  - current:   nothing to do.
 *  - edited:    changed by hand on the site → never overwritten.
 *  - removed:   deleted from the site → not brought back.
 *  - no_images: videos/reels with no photos → skipped.
 */
export type SyncStatus = 'new' | 'changed' | 'current' | 'edited' | 'removed' | 'no_images'

export interface SyncItem {
  externalId: string
  permalink: string
  caption: string
  timestamp: string | null
  thumbnail: string | null
  slides: number
  status: SyncStatus
  postId: string | null
  postTitle: string | null
  postStatus: string | null
}

export interface SyncDeps {
  listMedia: () => Promise<InstagramMedia[]>
  imageHosts: readonly string[]
  download?: typeof safeDownload
}

const PROVIDER = 'instagram'
const norm = (s: string) => s.replace(/\r\n?/g, '\n').trim()

interface Plan {
  items: SyncItem[]
  media: Map<string, InstagramMedia>
  postsById: Map<string, posts.SyncPost>
  sourceCaption: Map<string, string>
}

/**
 * The caption the site shows, or null when the post no longer has exactly one gallery (unpacked into an article).
 * If it differs from the caption last taken from Instagram, someone changed it by hand: the post counts as edited.
 */
function siteCaption(body: Body): string | null {
  const galleries = (body?.blocks ?? []).filter((b) => b.type === 'gallery')
  return galleries.length === 1 ? norm(String((galleries[0]!.data as { caption?: unknown }).caption ?? '')) : null
}

async function plan(db: Db, deps: SyncDeps): Promise<Plan> {
  const [media, sources] = await Promise.all([deps.listMedia(), listSources(db, PROVIDER)])
  const sourceById = new Map(sources.map((s) => [s.external_id, s]))
  const linked = await posts.getPostsForSync(db, sources.map((s) => s.post_id).filter((x): x is string => Boolean(x)))
  const postsById = new Map(linked.map((p) => [p.id, p]))
  const items: SyncItem[] = media.map((m) => {
    const imported = toImportedPost(m)
    const source = sourceById.get(m.id)
    const post = source?.post_id ? postsById.get(source.post_id) : undefined
    let status: SyncStatus
    if (!source) status = imported.imageUrls.length ? 'new' : 'no_images'
    else if (!source.post_id || !post) status = 'removed'
    else if (post.content_edited_at || siteCaption(post.body as Body) !== norm(source.caption)) status = 'edited'
    else status = norm(source.caption) === norm(m.caption ?? '') ? 'current' : 'changed'
    return {
      externalId: m.id,
      permalink: imported.permalink,
      caption: (m.caption ?? '').split('\n').find((l) => l.trim())?.trim().slice(0, 140) ?? '',
      timestamp: m.timestamp ?? null,
      thumbnail: m.thumbnail_url ?? m.media_url ?? m.children?.data.find((c) => c.media_type === 'IMAGE')?.media_url ?? null,
      slides: imported.imageUrls.length,
      status,
      postId: post?.id ?? null,
      postTitle: post?.title ?? null,
      postStatus: post?.status ?? null,
    }
  })
  return { items, media: new Map(media.map((m) => [m.id, m])), postsById, sourceCaption: new Map(sources.map((s) => [s.external_id, s.caption])) }
}

export async function planSync(db: Db, deps: SyncDeps): Promise<SyncItem[]> {
  return (await plan(db, deps)).items
}

/** The gallery caption replaced with Instagram's new caption; null if the post has no single gallery to update. */
export function withNewCaption(body: Body, caption: string): Body | null {
  const galleries = body.blocks.filter((b) => b.type === 'gallery')
  if (galleries.length !== 1) return null
  return { ...body, blocks: body.blocks.map((b) => (b.type === 'gallery' ? { ...b, data: { ...(b.data as Record<string, unknown>), caption: caption.slice(0, CAPTION_MAX) } } : b)) }
}

export interface SyncOptions {
  categoryId: string
  publish: boolean
  updateCaptions: boolean
  /** Most new posts to import in this call (each copies its images, so batches stay short). */
  maxNew: number
  /** Instagram ids that failed earlier in this run; skipped so one bad post cannot stall the rest. */
  skip: string[]
}

export interface SyncResult {
  imported: { externalId: string; postId: string; slides: number }[]
  updated: { postId: string; slug: string }[]
  failed: { externalId: string; permalink: string; message: string }[]
  remainingNew: number
}

export async function runSyncBatch(ctx: ActionContext<Db>, options: SyncOptions, deps: SyncDeps): Promise<SyncResult> {
  const { db } = ctx
  const p = await plan(db, deps)
  const result: SyncResult = { imported: [], updated: [], failed: [], remainingNew: 0 }
  const skip = new Set(options.skip)

  if (options.updateCaptions) {
    for (const item of p.items.filter((i) => i.status === 'changed')) {
      const post = p.postsById.get(item.postId!)!
      const caption = p.media.get(item.externalId)?.caption ?? ''
      const body = withNewCaption(post.body as Body, caption)
      if (!body) continue
      const oldCaption = p.sourceCaption.get(item.externalId) ?? ''
      // The title follows the caption only if nobody changed it from the one made at import.
      const title = post.title === headlineFromCaption(oldCaption) ? headlineFromCaption(caption) : post.title
      try {
        await posts.updatePost(db, post.id, { body, title })
        await updateSourceCaption(db, PROVIDER, item.externalId, caption)
        result.updated.push({ postId: post.id, slug: post.slug })
      } catch (e) {
        result.failed.push({ externalId: item.externalId, permalink: item.permalink, message: e instanceof Error ? e.message : 'Could not update.' })
      }
    }
  }

  // Oldest first, so the site's order matches Instagram's.
  const pending = p.items.filter((i) => i.status === 'new' && !skip.has(i.externalId)).reverse()
  for (const item of pending.slice(0, options.maxNew)) {
    try {
      const imported = toImportedPost(p.media.get(item.externalId)!)
      const r = await createFromImported(ctx, imported, { categoryId: options.categoryId, status: options.publish ? 'published' : 'draft', imageHosts: deps.imageHosts, download: deps.download })
      result.imported.push({ externalId: item.externalId, ...r })
    } catch (e) {
      result.failed.push({ externalId: item.externalId, permalink: item.permalink, message: e instanceof Error ? e.message : 'Could not import.' })
    }
  }
  result.remainingNew = Math.max(0, pending.length - options.maxNew)
  return result
}

/** Lets Instagram update a post again (clears the "edited on the site" mark). */
export async function allowSync(db: Db, postId: string): Promise<void> {
  await posts.updatePost(db, postId, { content_edited_at: null })
}

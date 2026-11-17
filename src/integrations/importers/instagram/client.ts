import { z } from 'zod'
import { AppError } from '@/domain/result'

const child = z.object({ id: z.string(), media_type: z.string(), media_url: z.string().optional() })
const media = z.object({
  id: z.string(),
  permalink: z.string(),
  caption: z.string().optional(),
  media_type: z.string(),
  media_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  timestamp: z.string().optional(),
  children: z.object({ data: z.array(child) }).optional(),
})
const page = z.object({
  data: z.array(media),
  paging: z.object({ cursors: z.object({ after: z.string().optional() }).optional(), next: z.string().optional() }).optional(),
})
export type InstagramMedia = z.infer<typeof media>

const FIELDS = 'id,permalink,caption,media_type,media_url,thumbnail_url,timestamp,children{id,media_type,media_url}'

export interface InstagramClientOptions {
  apiVersion: string
  /**
   * The Instagram account's numeric ID. Needed for Facebook-issued tokens (Meta's "Unified login" /
   * system-user tokens, which start with "EAA"): those read from graph.facebook.com/{id}/media.
   * Instagram-issued tokens read from graph.instagram.com/me/media and do not need it.
   */
  accountId?: string | undefined
  fetchImpl?: typeof fetch
  /** How far back to look: maxPages x 50 most recent posts. */
  maxPages?: number
}

/** Facebook-issued tokens start with "EAA"; Instagram-issued ones start with "IG". */
export function mediaListUrl(accessToken: string, options: InstagramClientOptions): URL {
  if (accessToken.startsWith('EAA')) {
    if (!options.accountId) throw new AppError('upstream', 'Set INSTAGRAM_ACCOUNT_ID to use this kind of Instagram token.')
    return new URL(`https://graph.facebook.com/${options.apiVersion}/${encodeURIComponent(options.accountId)}/media`)
  }
  return new URL(`https://graph.instagram.com/${options.apiVersion}/me/media`)
}

/**
 * Finds one of the connected account's own posts by its short code.
 * The Instagram API has no "look up by link" call, so this walks the account's recent posts until it finds the match.
 */
export async function findOwnMediaByShortcode(accessToken: string, shortcode: string, options: InstagramClientOptions): Promise<InstagramMedia> {
  const doFetch = options.fetchImpl ?? fetch
  let after: string | undefined
  for (let i = 0; i < (options.maxPages ?? 6); i += 1) {
    const url = mediaListUrl(accessToken, options)
    url.searchParams.set('fields', FIELDS)
    url.searchParams.set('limit', '50')
    if (after) url.searchParams.set('after', after)
    // The token goes in a header, not the address, so it cannot end up in request logs.
    const response = await doFetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000) })
    if (response.status === 401 || response.status === 403) throw new AppError('upstream', 'Instagram rejected the connection. Reconnect the account.')
    if (!response.ok) throw new AppError('upstream', 'Instagram did not respond. Try again in a minute.')
    const parsed = page.safeParse(await response.json())
    if (!parsed.success) throw new AppError('upstream', 'Instagram returned something unexpected.')
    const hit = parsed.data.data.find((m) => m.permalink.includes(`/${shortcode}/`))
    if (hit) return hit
    after = parsed.data.paging?.next ? parsed.data.paging.cursors?.after : undefined
    if (!after) break
  }
  throw new AppError('not_found', 'That post was not found on the connected Instagram account.')
}

async function fetchPage(accessToken: string, options: InstagramClientOptions, after: string | undefined) {
  const doFetch = options.fetchImpl ?? fetch
  const url = mediaListUrl(accessToken, options)
  url.searchParams.set('fields', FIELDS)
  url.searchParams.set('limit', '50')
  if (after) url.searchParams.set('after', after)
  const response = await doFetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000) })
  if (response.status === 401 || response.status === 403) throw new AppError('upstream', 'Instagram rejected the connection. Reconnect the account.')
  if (!response.ok) throw new AppError('upstream', 'Instagram did not respond. Try again in a minute.')
  const parsed = page.safeParse(await response.json())
  if (!parsed.success) throw new AppError('upstream', 'Instagram returned something unexpected.')
  return parsed.data
}

/** Every post on the connected account, newest first (up to maxPages x 50; default 600). Used by bulk sync. */
export async function listOwnMedia(accessToken: string, options: InstagramClientOptions): Promise<InstagramMedia[]> {
  const all: InstagramMedia[] = []
  let after: string | undefined
  for (let i = 0; i < (options.maxPages ?? 12); i += 1) {
    const p = await fetchPage(accessToken, options, after)
    all.push(...p.data)
    after = p.paging?.next ? p.paging.cursors?.after : undefined
    if (!after) break
  }
  return all
}

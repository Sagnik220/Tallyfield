import type { Db } from '@/lib/supabase/server'
import { raise } from './errors'

export interface SourceRecord {
  postId: string
  provider: string
  externalId: string
  permalink: string
  caption: string
}

export async function findSource(db: Db, provider: string, externalId: string): Promise<{ post_id: string | null } | null> {
  const { data, error } = await db.from('social_sources').select('post_id').eq('provider', provider).eq('external_id', externalId).maybeSingle()
  if (error) raise(error, 'findSource')
  return data
}

export async function insertSource(db: Db, source: SourceRecord): Promise<void> {
  const { error } = await db.from('social_sources').insert({
    post_id: source.postId,
    provider: source.provider,
    external_id: source.externalId,
    permalink: source.permalink,
    caption: source.caption,
  })
  if (error) raise(error, 'insertSource')
}

export interface SourceRow {
  external_id: string
  post_id: string | null
  caption: string
}

/** Every post imported from a provider (post_id is null when the post was later deleted from the site). */
export async function listSources(db: Db, provider: string): Promise<SourceRow[]> {
  const { data, error } = await db.from('social_sources').select('external_id, post_id, caption').eq('provider', provider).limit(5000)
  if (error) raise(error, 'listSources')
  return (data ?? []) as SourceRow[]
}

export async function updateSourceCaption(db: Db, provider: string, externalId: string, caption: string): Promise<void> {
  const { error } = await db.from('social_sources').update({ caption, fetched_at: new Date().toISOString() }).eq('provider', provider).eq('external_id', externalId)
  if (error) raise(error, 'updateSourceCaption')
}

/** A post imported again after its earlier copy was deleted: point the existing source record at the new post. */
export async function relinkSource(db: Db, provider: string, externalId: string, postId: string, caption: string): Promise<void> {
  const { error } = await db.from('social_sources').update({ post_id: postId, caption, fetched_at: new Date().toISOString() }).eq('provider', provider).eq('external_id', externalId)
  if (error) raise(error, 'relinkSource')
}

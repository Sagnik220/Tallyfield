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

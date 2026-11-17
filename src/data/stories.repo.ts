import type { Db } from '@/lib/supabase/server'
import { raise } from './errors'

export interface StoryRow {
  id: string
  caption: string
  link_url: string | null
  link_label: string
  duration_ms: number
  position: number
  status: 'draft' | 'published' | 'archived'
  expires_at: string | null
  created_at: string
  media: { id: string; storage_path: string; mime_type: string; alt: string; width: number | null; height: number | null } | null
}

const COLUMNS = 'id, caption, link_url, link_label, duration_ms, position, status, expires_at, created_at, media:media_id(id, storage_path, mime_type, alt, width, height)'

/** Stories visitors can see right now. Row level security already hides drafts and expired stories. */
export async function listLiveStories(db: Db): Promise<StoryRow[]> {
  const { data, error } = await db.from('stories').select(COLUMNS).eq('status', 'published').order('position').order('created_at', { ascending: false }).limit(30)
  if (error) raise(error, 'listLiveStories')
  const now = Date.now()
  return ((data ?? []) as unknown as StoryRow[]).filter((s) => s.media && (!s.expires_at || new Date(s.expires_at).getTime() > now))
}

export async function listStoriesForAdmin(db: Db): Promise<StoryRow[]> {
  const { data, error } = await db.from('stories').select(COLUMNS).order('position').order('created_at', { ascending: false }).limit(200)
  if (error) raise(error, 'listStoriesForAdmin')
  return (data ?? []) as unknown as StoryRow[]
}

export interface StoryWrite {
  media_id?: string
  caption?: string
  link_url?: string | null
  link_label?: string
  duration_ms?: number
  position?: number
  status?: 'draft' | 'published' | 'archived'
  expires_at?: string | null
}

export async function insertStory(db: Db, values: StoryWrite & { media_id: string; created_by: string }): Promise<string> {
  const { data, error } = await db.from('stories').insert(values).select('id').single()
  if (error) raise(error, 'insertStory')
  return (data as { id: string }).id
}

export async function updateStory(db: Db, id: string, values: StoryWrite): Promise<void> {
  const { error } = await db.from('stories').update(values).eq('id', id)
  if (error) raise(error, 'updateStory')
}

export async function deleteStory(db: Db, id: string): Promise<void> {
  const { error } = await db.from('stories').delete().eq('id', id)
  if (error) raise(error, 'deleteStory')
}

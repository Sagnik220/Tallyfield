import type { Metadata } from 'next'
import { listPostsForAdmin } from '@/data/posts.repo'
import { listStoriesForAdmin } from '@/data/stories.repo'
import { mediaUrl } from '@/lib/media-url'
import { createSessionClient } from '@/lib/supabase/server'
import { StoriesManager, type AdminStory } from './stories-manager'

export const metadata: Metadata = { title: 'Stories' }

export default async function StoriesPage() {
  const db = await createSessionClient()
  const [rows, posts] = await Promise.all([listStoriesForAdmin(db), listPostsForAdmin(db, 'published')])
  const stories: AdminStory[] = rows
    .filter((s) => s.media)
    .map((s) => ({
      id: s.id,
      src: mediaUrl(s.media!.storage_path),
      kind: s.media!.mime_type.startsWith('video/') ? 'video' : 'image',
      caption: s.caption,
      linkUrl: s.link_url,
      linkLabel: s.link_label,
      durationMs: s.duration_ms,
      position: s.position,
      status: s.status,
      expiresAt: s.expires_at,
    }))
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="tf-eyebrow">Admin</div>
        <h1 className="tf-display">Stories</h1>
        <p className="tf-body" style={{ maxWidth: 680 }}>
          Full-screen vertical photos and short videos, shown as circles at the top of the homepage. Best at 1080 × 1920. Paste, drop or upload.
        </p>
      </div>
      <StoriesManager stories={stories} posts={posts.map((p) => ({ slug: p.slug, title: p.title }))} />
    </>
  )
}

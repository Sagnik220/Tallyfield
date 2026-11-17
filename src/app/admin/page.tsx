import Link from 'next/link'
import { listDailyViews } from '@/data/analytics.repo'
import { listPostSummariesForAdmin } from '@/data/posts.repo'
import { getMediaByIds, listCategories } from '@/data/public.repo'
import { mediaUrl } from '@/lib/media-url'
import { createSessionClient } from '@/lib/supabase/server'
import { PostsTable, type PostListRow } from './posts-table'

function thirtyDaysAgo(): string {
  return new Date(Date.now() - 29 * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export default async function AdminPostsPage() {
  const db = await createSessionClient()
  const [posts, categories, daily] = await Promise.all([listPostSummariesForAdmin(db), listCategories(db), listDailyViews(db, thirtyDaysAgo()).catch(() => [])])
  const covers = await getMediaByIds(db, posts.map((p) => p.cover_media_id).filter((x): x is string => Boolean(x)))
  const categoryName = Object.fromEntries(categories.map((c) => [c.id, c.name]))
  const views = new Map<string, number>()
  for (const d of daily) if (d.post_id) views.set(d.post_id, (views.get(d.post_id) ?? 0) + d.views)
  const rows: PostListRow[] = posts.map((p) => {
    const cover = p.cover_media_id ? covers[p.cover_media_id] : undefined
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: p.status,
      category: categoryName[p.category_id] ?? 'Uncategorised',
      source: p.source_url ? 'instagram' : 'site',
      cover: cover ? mediaUrl(cover.storage_path) : null,
      updatedAt: p.updated_at,
      publishedAt: p.published_at,
      views: views.get(p.id) ?? 0,
    }
  })
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="tf-eyebrow">Admin</div>
          <h1 className="tf-display" style={{ fontSize: 'clamp(44px, 4.6vw, 68px)' }}>
            Posts
          </h1>
        </div>
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="tf-ghost" href="/admin/import">
            Import from Instagram
          </Link>
          <Link className="tf-gold" href="/admin/new">
            Write a post
          </Link>
        </span>
      </div>

      {posts.length === 0 ? (
        <section style={{ border: '1px dashed var(--stroke)', padding: '56px 28px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-cream)' }}>No posts yet</div>
          <p className="tf-note">Import a carousel from Instagram, or write a post for the site.</p>
        </section>
      ) : (
        <PostsTable rows={rows} categories={categories.map((c) => c.name)} />
      )}
    </>
  )
}

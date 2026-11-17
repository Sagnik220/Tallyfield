import Link from 'next/link'
import { listPostsForAdmin } from '@/data/posts.repo'
import { getMediaByIds, listCategories } from '@/data/public.repo'
import { mediaUrl } from '@/lib/media-url'
import { createSessionClient } from '@/lib/supabase/server'
import { StatusButtons } from './status-buttons'

const when = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })

export default async function AdminPostsPage() {
  const db = await createSessionClient()
  const [posts, categories] = await Promise.all([listPostsForAdmin(db), listCategories(db)])
  const covers = await getMediaByIds(db, posts.map((p) => p.cover_media_id).filter((x): x is string => Boolean(x)))
  const categoryName = Object.fromEntries(categories.map((c) => [c.id, c.name]))

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="tf-eyebrow">Admin</div>
          <h1 className="tf-display" style={{ fontSize: 'clamp(44px, 4.6vw, 68px)' }}>
            Posts
          </h1>
        </div>
        <Link className="tf-gold" href="/admin/import">
          Import from Instagram
        </Link>
      </div>

      {posts.length === 0 ? (
        <section style={{ border: '1px dashed var(--stroke)', padding: '56px 28px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-cream)' }}>No posts yet</div>
          <p className="tf-note">Import your first carousel from Instagram to get started.</p>
        </section>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', borderTop: '2px solid var(--gold)' }}>
          {posts.map((post) => {
            const cover = post.cover_media_id ? covers[post.cover_media_id] : undefined
            return (
              <div key={post.id} style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr) auto', gap: 18, alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--rule-dark)' }}>
                <span style={{ width: 72, height: 90, background: 'var(--panel)', overflow: 'hidden', display: 'block' }}>
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail, no optimisation needed
                    <img src={mediaUrl(cover.storage_path)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : null}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                    <span className="tf-status" data-status={post.status}>
                      {post.status}
                    </span>
                    <span className="tf-label">{categoryName[post.category_id] ?? ''}</span>
                    <span className="tf-note" style={{ fontSize: 13 }}>
                      Updated {when(post.updated_at)}
                    </span>
                  </span>
                  <Link href={`/admin/import?post=${post.id}`} style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-cream)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {post.title}
                  </Link>
                  {post.status === 'published' ? (
                    <Link href={`/posts/${post.slug}`} className="tf-note" style={{ fontSize: 14, color: 'var(--gold-light)' }}>
                      /posts/{post.slug} ↗
                    </Link>
                  ) : null}
                </span>
                <StatusButtons id={post.id} status={post.status} />
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

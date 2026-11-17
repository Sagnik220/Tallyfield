import { listPostsForAdmin } from '@/data/posts.repo'
import { createSessionClient } from '@/lib/supabase/server'

// Minimal working list. The designed Posts screen replaces this markup in the UI phase.
export default async function AdminPostsPage() {
  const posts = await listPostsForAdmin(await createSessionClient())
  return (
    <main style={{ maxWidth: 1296, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ color: 'var(--ink-cream)', margin: 0 }}>Posts</h1>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            {post.title} · {post.status}
          </li>
        ))}
      </ul>
    </main>
  )
}

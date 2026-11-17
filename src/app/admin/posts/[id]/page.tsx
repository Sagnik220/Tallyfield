import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPostById } from '@/data/posts.repo'
import { getMediaByIds, getPostTagIds, listAllTags, listCategories, mediaIdsInBody } from '@/data/public.repo'
import { AppError } from '@/domain/result'
import { createSessionClient } from '@/lib/supabase/server'
import { PostEditor, type EditorMedia } from './post-editor'

export const metadata: Metadata = { title: 'Edit post' }

type Props = { params: Promise<{ id: string }> }

export default async function EditPostPage({ params }: Props) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const db = await createSessionClient()
  let post
  try {
    post = await getPostById(db, id)
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') notFound()
    throw e
  }
  const ids = mediaIdsInBody(post.body)
  if (post.cover_media_id) ids.push(post.cover_media_id)
  const [categories, tags, tagIds, mediaRows] = await Promise.all([listCategories(db), listAllTags(db), getPostTagIds(db, id), getMediaByIds(db, ids)])
  const media: Record<string, EditorMedia> = {}
  for (const m of Object.values(mediaRows)) media[m.id] = { path: m.storage_path, kind: m.mime_type.startsWith('video/') ? 'video' : 'image', alt: m.alt, width: m.width, height: m.height }

  return (
    <>
      <div className="tf-eyebrow">
        <Link href="/admin" style={{ color: 'inherit', textDecoration: 'none' }}>
          Posts
        </Link>{' '}
        · Edit
      </div>
      <PostEditor
        key={post.id}
        post={{
          id: post.id,
          slug: post.slug,
          title: post.title,
          deck: post.deck,
          status: post.status,
          kind: post.kind,
          categoryId: post.category_id,
          coverMediaId: post.cover_media_id,
          sourceUrl: post.source_url,
          pricesCheckedOn: post.prices_checked_on,
          priceSources: post.price_sources,
          published: Boolean(post.published_at),
          blocks: post.body.blocks,
        }}
        tagIds={tagIds}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        tags={tags}
        media={media}
      />
    </>
  )
}

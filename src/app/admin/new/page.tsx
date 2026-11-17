import type { Metadata } from 'next'
import { listCategories } from '@/data/public.repo'
import { createSessionClient } from '@/lib/supabase/server'
import { NewPostForm } from './new-post-form'

export const metadata: Metadata = { title: 'Write a post' }

export default async function NewPostPage() {
  const categories = await listCategories(await createSessionClient())
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="tf-eyebrow">Posts · New</div>
        <h1 className="tf-display">Write a post</h1>
        <p className="tf-body" style={{ maxWidth: 640 }}>
          A post written for the site: a story, a buying guide, a long-form verdict. Start with a headline; you can change everything after.
        </p>
      </div>
      <NewPostForm categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))} />
    </>
  )
}

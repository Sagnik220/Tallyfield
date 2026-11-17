import type { Metadata } from 'next'
import Link from 'next/link'
import { listCategories } from '@/data/public.repo'
import { createSessionClient } from '@/lib/supabase/server'
import { getDraftAction } from '@/server/actions/drafts'
import { ImportFlow } from './import-flow'

export const metadata: Metadata = { title: 'Import from Instagram' }

type Props = { searchParams: Promise<{ post?: string }> }

export default async function ImportPage({ searchParams }: Props) {
  const { post } = await searchParams
  const categories = await listCategories(await createSessionClient())
  const editing = typeof post === 'string' && /^[0-9a-f-]{36}$/i.test(post) ? post : null
  const loaded = editing ? await getDraftAction({ id: editing }) : null
  if (loaded && !loaded.ok) {
    return (
      <div className="tf-alert" role="alert">
        {loaded.error.message} <Link href="/admin">Back to posts</Link>
      </div>
    )
  }
  const initial = loaded?.ok ? loaded.data : null
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="tf-eyebrow">
          <Link href="/admin" style={{ color: 'inherit', textDecoration: 'none' }}>
            Posts
          </Link>{' '}
          · {editing ? 'Edit' : 'New'}
        </div>
        <h1 className="tf-display" style={{ fontSize: 'clamp(44px, 4.6vw, 68px)' }}>
          {editing ? 'Edit post' : 'Import from Instagram'}
        </h1>
        <p className="tf-body" style={{ maxWidth: 720 }}>
          {editing
            ? 'Change the headline, deck line, category or cover, then publish or save.'
            : 'Paste the link to one of your posts. The slides and caption come across, and you choose how it appears on the site.'}
        </p>
      </div>
      <ImportFlow key={editing ?? 'new'} categories={categories.map((c) => ({ id: c.id, name: c.name }))} initial={initial} />
    </>
  )
}

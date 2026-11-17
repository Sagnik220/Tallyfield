'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { createPostAction } from '@/server/actions/posts'

export function NewPostForm({ categories }: { categories: { id: string; name: string; slug: string }[] }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState(categories.find((c) => c.slug === 'story')?.id ?? categories[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const result = await createPostAction({
      title: title.trim() || 'Untitled post',
      categoryId,
      kind: 'article',
      body: { version: 1, blocks: [{ id: crypto.randomUUID(), type: 'rich_text', data: { doc: { type: 'doc', content: [{ type: 'paragraph' }] } } }] },
    })
    if (!result.ok) {
      setBusy(false)
      setError(result.error.message)
      return
    }
    router.push(`/admin/posts/${result.data.id}`)
  }

  return (
    <form className="tf-panel" onSubmit={onSubmit} style={{ maxWidth: 720 }}>
      <div>
        <label htmlFor="np-title" className="tf-label tf-field-label">
          Headline
        </label>
        <input id="np-title" className="tf-field" autoFocus maxLength={160} placeholder="e.g. Which Santos should you buy?" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label htmlFor="np-cat" className="tf-label tf-field-label">
          Category
        </label>
        <select id="np-cat" className="tf-field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <div className="tf-alert" role="alert">
          {error}
        </div>
      ) : null}
      <button className="tf-gold" type="submit" disabled={busy} style={{ alignSelf: 'flex-start' }}>
        {busy ? 'Creating…' : 'Start writing →'}
      </button>
    </form>
  )
}

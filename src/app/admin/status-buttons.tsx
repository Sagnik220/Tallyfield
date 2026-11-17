'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { setPostStatusAction } from '@/server/actions/posts'

/** Publish / unpublish one post from the list. */
export function StatusButtons({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')

  function change(next: 'published' | 'draft') {
    setError('')
    start(async () => {
      const result = await setPostStatusAction({ id, status: next })
      if (!result.ok) setError(result.error.message)
      else router.refresh()
    })
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      {status === 'published' ? (
        <button className="tf-ghost tf-small" type="button" disabled={pending} onClick={() => change('draft')}>
          Unpublish
        </button>
      ) : (
        <button className="tf-gold tf-small" type="button" disabled={pending} onClick={() => change('published')}>
          Publish
        </button>
      )}
      {error ? (
        <span role="alert" style={{ fontSize: 13, color: 'var(--warn)' }}>
          {error}
        </span>
      ) : null}
    </span>
  )
}

'use client'

import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/browser'

/** Email sign-in link. No passwords to leak or reuse; the link signs you in on this device. */
export function LoginForm({ error }: { error?: string | undefined }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [message, setMessage] = useState(error ?? '')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setState('sending')
    setMessage('')
    const { error: sendError } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      // Existing accounts only: the form never creates new users.
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/admin`, shouldCreateUser: false },
    })
    // Unknown addresses get the same answer as known ones, so the form can't be used to find out who has an account.
    const unknownAccount = sendError && (sendError.status === 400 || sendError.status === 422) && /signup|not allowed|not found/i.test(sendError.message)
    if (sendError && !unknownAccount) {
      setState('failed')
      setMessage(sendError.status === 429 ? 'Too many sign-in emails. Wait a few minutes and try again.' : 'Could not send the sign-in email. Check the address and try again.')
      return
    }
    setState('sent')
  }

  if (state === 'sent') {
    return (
      <div className="tf-alert tf-success" role="status">
        If <strong>{email}</strong> has access, a sign-in link is on its way. Open it on this device. It expires in an hour.
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {message ? (
        <div className="tf-alert" role="alert">
          {message}
        </div>
      ) : null}
      <div>
        <label htmlFor="email" className="tf-label tf-field-label">
          Email
        </label>
        <input id="email" className="tf-field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <button className="tf-gold" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
      </button>
    </form>
  )
}

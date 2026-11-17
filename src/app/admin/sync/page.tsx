import type { Metadata } from 'next'
import { listCategories } from '@/data/public.repo'
import { getIntegrationToken } from '@/data/tokens.repo'
import { INSTAGRAM_IMAGE_HOSTS, instagramLister } from '@/integrations/importers'
import { createSessionClient } from '@/lib/supabase/server'
import { planSync, type SyncItem } from '@/services/sync.service'
import { SyncPanel } from './sync-panel'

export const metadata: Metadata = { title: 'Sync with Instagram' }

export default async function SyncPage() {
  const db = await createSessionClient()
  const categories = await listCategories(db)
  let items: SyncItem[] = []
  let error: string | null = null
  try {
    const token = await getIntegrationToken('instagram')
    items = await planSync(db, { listMedia: instagramLister(token), imageHosts: INSTAGRAM_IMAGE_HOSTS })
  } catch (e) {
    error = e instanceof Error ? e.message : 'Instagram did not respond.'
  }
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="tf-eyebrow">Admin</div>
        <h1 className="tf-display">Sync with Instagram</h1>
        <p className="tf-note" style={{ maxWidth: 760, margin: 0, fontSize: 15 }}>
          Brings every Instagram post onto the site in one go. New posts are imported; posts whose caption changed on Instagram are refreshed.
          <strong style={{ color: 'var(--ink-cream)' }}> Posts you have edited on the site are never overwritten</strong>, and posts you deleted are not brought back.
        </p>
      </div>
      {error ? (
        <div className="tf-alert" role="alert">
          Could not read Instagram: {error}
        </div>
      ) : (
        <SyncPanel items={items} categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
      )}
    </>
  )
}

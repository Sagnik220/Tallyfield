'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getIntegrationToken } from '@/data/tokens.repo'
import { STAFF } from '@/domain/roles'
import { INSTAGRAM_IMAGE_HOSTS, instagramLister } from '@/integrations/importers'
import { allowSync, runSyncBatch } from '@/services/sync.service'
import { action } from '../action'

const batch = action({
  name: 'sync.instagramBatch',
  roles: STAFF,
  schema: z.object({
    categoryId: z.uuid(),
    publish: z.boolean(),
    updateCaptions: z.boolean(),
    skip: z.array(z.string().regex(/^\d{1,40}$/)).max(1000),
  }),
  // The Sync screen calls this repeatedly (a few posts per call) until everything is in.
  rateLimit: { bucket: 'sync', max: 200, windowSeconds: 600 },
  handler: async (input, ctx) => {
    const token = await getIntegrationToken('instagram')
    const result = await runSyncBatch(ctx, { ...input, maxNew: 3 }, { listMedia: instagramLister(token), imageHosts: INSTAGRAM_IMAGE_HOSTS })
    if (result.imported.length || result.updated.length) {
      revalidatePath('/')
      revalidatePath('/archive')
      for (const u of result.updated) revalidatePath(`/posts/${u.slug}`)
    }
    return result
  },
})

const allow = action({
  name: 'sync.allow',
  roles: STAFF,
  schema: z.object({ postId: z.uuid() }),
  handler: async ({ postId }, ctx) => {
    await allowSync(ctx.db, postId)
    return { postId }
  },
})

export async function syncInstagramBatchAction(input: unknown) {
  return batch(input)
}

export async function allowInstagramSyncAction(input: unknown) {
  return allow(input)
}

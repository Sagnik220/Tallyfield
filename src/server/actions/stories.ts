'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { deleteStory, insertStory, updateStory } from '@/data/stories.repo'
import { STAFF } from '@/domain/roles'
import { action } from '../action'

const fields = {
  caption: z.string().trim().max(200),
  linkUrl: z
    .string()
    .trim()
    .max(500)
    .regex(/^(https:\/\/|\/(?!\/))/, 'Links must start with https:// or /')
    .nullable(),
  linkLabel: z.string().trim().max(40),
  durationMs: z.number().int().min(2000).max(60000),
  /** Hours until the story disappears; null keeps it until removed. */
  expiresInHours: z.number().int().min(1).max(24 * 30).nullable(),
  status: z.enum(['draft', 'published']),
}

function expiry(hours: number | null | undefined) {
  if (hours === undefined) return undefined
  return hours === null ? null : new Date(Date.now() + hours * 3_600_000).toISOString()
}

const create = action({
  name: 'stories.create',
  roles: STAFF,
  schema: z.object({ mediaId: z.uuid(), ...fields }),
  handler: async (input, { db, user }) => {
    const id = await insertStory(db, {
      media_id: input.mediaId,
      caption: input.caption,
      link_url: input.linkUrl || null,
      link_label: input.linkLabel,
      duration_ms: input.durationMs,
      status: input.status,
      expires_at: expiry(input.expiresInHours) ?? null,
      position: Math.floor(Date.now() / 1000) % 1_000_000_000,
      created_by: user.id,
    })
    revalidatePath('/')
    return { id }
  },
})

const update = action({
  name: 'stories.update',
  roles: STAFF,
  schema: z.object({ id: z.uuid(), ...fields, position: z.number().int() }).partial().required({ id: true }),
  handler: async ({ id, caption, linkUrl, linkLabel, durationMs, expiresInHours, status, position }, { db }) => {
    await updateStory(db, id, {
      ...(caption !== undefined ? { caption } : {}),
      ...(linkUrl !== undefined ? { link_url: linkUrl || null } : {}),
      ...(linkLabel !== undefined ? { link_label: linkLabel } : {}),
      ...(durationMs !== undefined ? { duration_ms: durationMs } : {}),
      ...(expiresInHours !== undefined ? { expires_at: expiry(expiresInHours) ?? null } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(position !== undefined ? { position } : {}),
    })
    revalidatePath('/')
    return { id }
  },
})

const remove = action({
  name: 'stories.remove',
  roles: STAFF,
  schema: z.object({ id: z.uuid() }),
  handler: async ({ id }, { db }) => {
    await deleteStory(db, id)
    revalidatePath('/')
    return { id }
  },
})

export async function createStoryAction(input: unknown) {
  return create(input)
}
export async function updateStoryAction(input: unknown) {
  return update(input)
}
export async function deleteStoryAction(input: unknown) {
  return remove(input)
}

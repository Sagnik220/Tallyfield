'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { postIdSchema, postInputSchema, postUpdateSchema, POST_STATUSES } from '@/domain/post'
import { ADMIN_ONLY, STAFF } from '@/domain/roles'
import { createPost, removePost, setPostStatus, updatePost } from '@/services/posts.service'
import { action } from '../action'

function refresh(slug?: string) {
  revalidatePath('/')
  revalidatePath('/archive')
  if (slug) revalidatePath(`/posts/${slug}`)
}

const create = action({
  name: 'posts.create',
  roles: STAFF,
  schema: postInputSchema,
  handler: async (input, ctx) => {
    const post = await createPost(ctx, input)
    return { id: post.id, slug: post.slug }
  },
})

const update = action({
  name: 'posts.update',
  roles: STAFF,
  schema: postUpdateSchema,
  handler: async (input, ctx) => {
    const post = await updatePost(ctx, input)
    refresh(post.slug)
    return { id: post.id, slug: post.slug }
  },
})

const setStatus = action({
  name: 'posts.setStatus',
  roles: STAFF,
  schema: postIdSchema.extend({ status: z.enum(POST_STATUSES) }),
  handler: async ({ id, status }, ctx) => {
    const post = await setPostStatus(ctx, id, status)
    refresh(post.slug)
    return { id: post.id, status: post.status }
  },
})

const remove = action({
  name: 'posts.remove',
  roles: ADMIN_ONLY,
  schema: postIdSchema,
  handler: async ({ id }, ctx) => {
    await removePost(ctx, id)
    refresh()
    return { id }
  },
})

// A "use server" file may only export async functions, so each action is wrapped explicitly.
export async function createPostAction(input: unknown) {
  return create(input)
}
export async function updatePostAction(input: unknown) {
  return update(input)
}
export async function setPostStatusAction(input: unknown) {
  return setStatus(input)
}
export async function deletePostAction(input: unknown) {
  return remove(input)
}

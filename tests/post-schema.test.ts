import { describe, expect, it } from 'vitest'
import { postInputSchema, postUpdateSchema } from '@/domain/post'

const id = '00000000-0000-4000-8000-000000000001'
const categoryId = '00000000-0000-4000-8000-000000000002'

describe('post schemas', () => {
  it('fills defaults for a new post', () => {
    const parsed = postInputSchema.parse({ title: 'Hello', categoryId, body: { version: 1, blocks: [] } })
    expect(parsed).toMatchObject({ deck: '', kind: 'article', tagIds: [], sourceUrl: null, priceSources: '' })
  })

  it('an update carries only the fields that were sent', () => {
    const parsed = postUpdateSchema.parse({ id, title: 'New title' })
    // Regression: defaults inside .partial() used to wipe tags, the source link and price sources on every edit.
    expect(parsed).toEqual({ id, title: 'New title' })
  })
})

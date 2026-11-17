import { describe, expect, it } from 'vitest'
import { slugify, SLUG_PATTERN } from '@/domain/slug'

describe('slugify', () => {
  it.each([
    ['Tissot PRX or Citizen Tsuyosa?', 'tissot-prx-or-citizen-tsuyosa'],
    ["HMT shut down. Its movements didn't.", 'hmt-shut-down-its-movements-didn-t'],
    ['Under ₹5K: which watch wins?', 'under-rs-5k-which-watch-wins'],
    ['  Café  Crème  ', 'cafe-creme'],
    ['???', 'post'],
  ])('%s -> %s', (input, expected) => {
    expect(slugify(input)).toBe(expected)
    expect(slugify(input)).toMatch(SLUG_PATTERN)
  })

  it('never exceeds the database limit', () => {
    const slug = slugify('word '.repeat(100))
    expect(slug.length).toBeLessThanOrEqual(120)
    expect(slug).toMatch(SLUG_PATTERN)
  })
})

const MAX = 120

/** Turns a headline into a web address segment: "Tissot PRX or Citizen Tsuyosa?" -> "tissot-prx-or-citizen-tsuyosa". */
export function slugify(input: string): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/₹/g, ' rs ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX)
    .replace(/-+$/g, '')
  return slug || 'post'
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

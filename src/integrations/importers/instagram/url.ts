import { AppError } from '@/domain/result'

const HOSTS = new Set(['instagram.com', 'www.instagram.com'])
// /p/<code>/, /reel/<code>/ and the newer /<username>/p/<code>/ form
const PATH = /^\/(?:[A-Za-z0-9._]{1,30}\/)?(p|reel)\/([A-Za-z0-9_-]{5,40})\/?$/

export function isInstagramUrl(url: URL): boolean {
  return HOSTS.has(url.hostname.toLowerCase())
}

/** Extracts the post's short code and rebuilds a clean address without tracking parameters. */
export function parseInstagramPermalink(url: URL): { shortcode: string; permalink: string } {
  const match = isInstagramUrl(url) ? PATH.exec(url.pathname) : null
  if (!match) throw new AppError('invalid_input', 'Paste the link to a single Instagram post, for example https://www.instagram.com/p/…/')
  const [, kind, shortcode] = match
  return { shortcode: shortcode!, permalink: `https://www.instagram.com/${kind}/${shortcode}/` }
}

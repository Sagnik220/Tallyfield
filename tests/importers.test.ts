import { describe, expect, it } from 'vitest'
import { AppError } from '@/domain/result'
import { findOwnMediaByShortcode } from '@/integrations/importers/instagram/client'
import { createInstagramImporter } from '@/integrations/importers/instagram/importer'
import { parseInstagramPermalink } from '@/integrations/importers/instagram/url'
import { ImporterRegistry } from '@/integrations/importers/registry'
import { assertSafeUrl, isAllowedHost, safeDownload } from '@/integrations/safe-fetch'
import { headlineFromCaption } from '@/services/import.service'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('instagram links', () => {
  it.each([
    ['https://www.instagram.com/p/DAbc123_xY/?img_index=3&igsh=abc', 'DAbc123_xY', 'https://www.instagram.com/p/DAbc123_xY/'],
    ['https://instagram.com/reel/Cxyz98765/', 'Cxyz98765', 'https://www.instagram.com/reel/Cxyz98765/'],
    ['https://www.instagram.com/tallyfield/p/DAbc123_xY/', 'DAbc123_xY', 'https://www.instagram.com/p/DAbc123_xY/'],
  ])('parses %s', (link, shortcode, permalink) => {
    expect(parseInstagramPermalink(new URL(link))).toEqual({ shortcode, permalink })
  })

  it.each(['https://www.instagram.com/tallyfield/', 'https://instagram.com.evil.example/p/DAbc123_xY/', 'https://www.instagram.com/p/../../etc/'])(
    'rejects %s',
    (link) => expect(() => parseInstagramPermalink(new URL(link))).toThrow(AppError),
  )
})

describe('importer registry', () => {
  const registry = new ImporterRegistry().register(createInstagramImporter({ apiVersion: 'v25.0' }))
  it('resolves instagram links and refuses everything else', () => {
    expect(registry.resolve(' https://www.instagram.com/p/DAbc123_xY/ ').importer.provider).toBe('instagram')
    expect(() => registry.resolve('http://www.instagram.com/p/DAbc123_xY/')).toThrow(AppError)
    expect(() => registry.resolve('https://example.com/p/DAbc123_xY/')).toThrow(AppError)
    expect(() => registry.resolve('javascript:alert(1)')).toThrow(AppError)
    expect(() => registry.resolve('not a link')).toThrow(AppError)
  })
})

describe('instagram client', () => {
  const carousel = {
    id: '1789',
    permalink: 'https://www.instagram.com/p/DAbc123_xY/',
    caption: 'Tissot PRX or Citizen Tsuyosa?\n\nTwo icons.',
    media_type: 'CAROUSEL_ALBUM',
    children: { data: [
      { id: 'a', media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/1.jpg' },
      { id: 'b', media_type: 'VIDEO', media_url: 'https://scontent.cdninstagram.com/2.mp4' },
      { id: 'c', media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/3.jpg' },
    ] },
  }

  it('pages through the account until it finds the post, sending the token in a header', async () => {
    const calls: { url: string; auth: string | null }[] = []
    const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, auth: new Headers(init?.headers).get('authorization') })
      return url.includes('after=CURSOR')
        ? json({ data: [carousel] })
        : json({ data: [{ id: '1', permalink: 'https://www.instagram.com/p/OTHER12345/', media_type: 'IMAGE' }], paging: { cursors: { after: 'CURSOR' }, next: 'https://next' } })
    }) as typeof fetch
    const media = await findOwnMediaByShortcode('TOKEN', 'DAbc123_xY', { apiVersion: 'v25.0', fetchImpl })
    expect(media.id).toBe('1789')
    expect(calls).toHaveLength(2)
    expect(calls.every((c) => c.auth === 'Bearer TOKEN' && !c.url.includes('TOKEN'))).toBe(true)
  })

  it('reports a clear error when the post is not on the account', async () => {
    const fetchImpl = (async () => json({ data: [] })) as typeof fetch
    await expect(findOwnMediaByShortcode('T', 'DAbc123_xY', { apiVersion: 'v25.0', fetchImpl })).rejects.toMatchObject({ code: 'not_found' })
  })

  it('keeps carousel images in order and skips videos', async () => {
    const fetchImpl = (async () => json({ data: [carousel] })) as typeof fetch
    const post = await createInstagramImporter({ apiVersion: 'v25.0', fetchImpl }).fetchPost(new URL('https://www.instagram.com/p/DAbc123_xY/'), 'T')
    expect(post.imageUrls).toEqual(['https://scontent.cdninstagram.com/1.jpg', 'https://scontent.cdninstagram.com/3.jpg'])
    expect(headlineFromCaption(post.caption)).toBe('Tissot PRX or Citizen Tsuyosa?')
  })
})

describe('safe downloads', () => {
  const allowedHosts = ['cdninstagram.com']
  const options = { allowedHosts, allowedTypes: ['image/jpeg'], maxBytes: 10 }

  it('only allows https links to allow-listed hosts', () => {
    expect(isAllowedHost('scontent.cdninstagram.com', allowedHosts)).toBe(true)
    expect(isAllowedHost('evilcdninstagram.com', allowedHosts)).toBe(false)
    for (const bad of ['http://scontent.cdninstagram.com/a.jpg', 'https://169.254.169.254/latest/meta-data', 'https://localhost/a.jpg',
      'https://user:pw@scontent.cdninstagram.com/a.jpg', 'https://scontent.cdninstagram.com:8443/a.jpg', 'https://cdninstagram.com.evil.example/a.jpg', 'file:///etc/passwd']) {
      expect(() => assertSafeUrl(bad, allowedHosts), bad).toThrow(AppError)
    }
  })

  it('downloads a small image', async () => {
    const fetchImpl = (async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } })) as typeof fetch
    const file = await safeDownload('https://scontent.cdninstagram.com/a.jpg', { ...options, fetchImpl })
    expect(file).toEqual({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' })
  })

  it('refuses redirects, wrong types and oversized files', async () => {
    const respond = (response: Response) => ({ ...options, fetchImpl: (async () => response) as typeof fetch })
    const link = 'https://scontent.cdninstagram.com/a.jpg'
    await expect(safeDownload(link, respond(new Response(null, { status: 302, headers: { location: 'https://10.0.0.1/' } })))).rejects.toBeInstanceOf(AppError)
    await expect(safeDownload(link, respond(new Response('<html>', { headers: { 'content-type': 'text/html' } })))).rejects.toBeInstanceOf(AppError)
    await expect(safeDownload(link, respond(new Response(new Uint8Array(11), { headers: { 'content-type': 'image/jpeg' } })))).rejects.toBeInstanceOf(AppError)
  })
})

describe('instagram media list address', () => {
  it('uses graph.instagram.com/me for Instagram-issued tokens', async () => {
    const { mediaListUrl } = await import('@/integrations/importers/instagram/client')
    expect(mediaListUrl('IGAAtoken', { apiVersion: 'v25.0' }).href).toBe('https://graph.instagram.com/v25.0/me/media')
  })
  it('uses graph.facebook.com/{account id} for Facebook-issued tokens', async () => {
    const { mediaListUrl } = await import('@/integrations/importers/instagram/client')
    expect(mediaListUrl('EAAtoken', { apiVersion: 'v25.0', accountId: '17841422107146767' }).href).toBe('https://graph.facebook.com/v25.0/17841422107146767/media')
    expect(() => mediaListUrl('EAAtoken', { apiVersion: 'v25.0' })).toThrow(/INSTAGRAM_ACCOUNT_ID/)
  })
})

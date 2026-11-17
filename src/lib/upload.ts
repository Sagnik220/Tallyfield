'use client'

import { createClient } from '@/lib/supabase/browser'

/**
 * Uploads an image, GIF or short video from the admin straight to the media bucket, then records it in the media
 * table. Both steps run as the signed-in person, so the storage and table rules (staff only) apply.
 * Files go browser → storage directly, which keeps large videos away from the 1 MB server-action limit.
 */

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}
export const ACCEPT = Object.keys(EXTENSIONS).join(',')

export interface UploadedMedia {
  mediaId: string
  path: string
  kind: 'image' | 'video'
  alt: string
  width: number | null
  height: number | null
}

function measure(file: File): Promise<{ width: number | null; height: number | null }> {
  const url = URL.createObjectURL(file)
  return new Promise((resolve) => {
    const done = (width: number | null, height: number | null) => {
      URL.revokeObjectURL(url)
      resolve({ width: width || null, height: height || null })
    }
    if (file.type.startsWith('video/')) {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => done(video.videoWidth, video.videoHeight)
      video.onerror = () => done(null, null)
      video.src = url
    } else {
      const img = new Image()
      img.onload = () => done(img.naturalWidth, img.naturalHeight)
      img.onerror = () => done(null, null)
      img.src = url
    }
  })
}

export async function uploadMedia(file: File, alt = ''): Promise<UploadedMedia> {
  const extension = EXTENSIONS[file.type]
  if (!extension) throw new Error('That file type is not supported. Use JPG, PNG, WebP, GIF, MP4, WebM or MOV.')
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      file.type.startsWith('video/')
        ? 'Videos must be under 50 MB. For longer videos, upload to YouTube or Instagram and paste the link instead.'
        : 'Files must be under 50 MB.',
    )
  }
  const supabase = createClient()
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Your session has expired. Sign in again.')

  const { width, height } = await measure(file)
  const path = `upload/${crypto.randomUUID()}.${extension}`
  const upload = await supabase.storage.from('media').upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' })
  if (upload.error) throw new Error(`Upload failed: ${upload.error.message}`)

  const text = alt.trim().slice(0, 300) || file.name.replace(/\.[^.]+$/, '').slice(0, 300)
  const { data, error } = await supabase
    .from('media')
    .insert({ storage_path: path, alt: text, mime_type: file.type, source: 'upload', created_by: userId, width, height })
    .select('id')
    .single()
  if (error || !data) {
    await supabase.storage.from('media').remove([path])
    throw new Error(`Could not save the file: ${error?.message ?? 'unknown error'}`)
  }
  return { mediaId: data.id as string, path, kind: file.type.startsWith('video/') ? 'video' : 'image', alt: text, width, height }
}

/** Turns a YouTube or Instagram link into an embed, or returns null if it is neither. */
export function parseEmbed(input: string): { provider: 'youtube'; id: string } | { provider: 'instagram'; id: string } | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\.|^m\./, '')
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1, 12)
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? { provider: 'youtube', id } : null
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/)?.[1] ?? ''
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? { provider: 'youtube', id } : null
  }
  if (host === 'instagram.com') {
    const m = url.pathname.match(/^\/(?:[A-Za-z0-9._]+\/)?(p|reel|reels)\/([A-Za-z0-9_-]{5,40})/)
    if (!m) return null
    const kind = m[1] === 'p' ? 'p' : 'reel'
    return { provider: 'instagram', id: `https://www.instagram.com/${kind}/${m[2]}/` }
  }
  return null
}

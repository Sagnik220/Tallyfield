import type { Db } from '@/lib/supabase/server'
import { raise } from './errors'
import type { MediaRow } from './types'

export const MEDIA_BUCKET = 'media'
const EXTENSION: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }
export const ALLOWED_IMAGE_TYPES = Object.keys(EXTENSION)

export interface NewImage {
  bytes: Uint8Array
  mimeType: string
  alt: string
  source: MediaRow['source']
  createdBy: string
}

/** Stores an image file under a random name and records it in the media table. */
export async function saveImage(db: Db, image: NewImage): Promise<MediaRow> {
  const extension = EXTENSION[image.mimeType]
  if (!extension) throw new Error(`Unsupported image type: ${image.mimeType}`)
  const path = `${image.source}/${crypto.randomUUID()}.${extension}`
  const upload = await db.storage.from(MEDIA_BUCKET).upload(path, image.bytes, { contentType: image.mimeType, upsert: false })
  if (upload.error) throw new Error(`saveImage.upload: ${upload.error.message}`)
  const { data, error } = await db
    .from('media')
    .insert({ storage_path: path, alt: image.alt, mime_type: image.mimeType, source: image.source, created_by: image.createdBy })
    .select('id, storage_path, alt, width, height, mime_type, source')
    .single()
  if (error) {
    await db.storage.from(MEDIA_BUCKET).remove([path])
    raise(error, 'saveImage.insert')
  }
  return data as MediaRow
}

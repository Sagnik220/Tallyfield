import { publicEnv } from '@/config/env.public'

/** Public address of a file in the media bucket. Paths are random UUID names chosen by the server, never by a visitor. */
export function mediaUrl(storagePath: string): string {
  const base = publicEnv().NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')
  return `${base}/storage/v1/object/public/media/${storagePath.split('/').map(encodeURIComponent).join('/')}`
}

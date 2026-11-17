import 'server-only'
import { serverEnv } from '@/config/env.server'
import { listOwnMedia, type InstagramClientOptions } from './instagram/client'
import { createInstagramImporter } from './instagram/importer'
import { ImporterRegistry } from './registry'

let registry: ImporterRegistry | undefined

/** Every source the site can import from. Add new importers here. */
export function importers(): ImporterRegistry {
  registry ??= new ImporterRegistry().register(createInstagramImporter({ apiVersion: serverEnv().INSTAGRAM_API_VERSION, accountId: serverEnv().INSTAGRAM_ACCOUNT_ID }))
  return registry
}

function instagramOptions(): InstagramClientOptions {
  return { apiVersion: serverEnv().INSTAGRAM_API_VERSION, accountId: serverEnv().INSTAGRAM_ACCOUNT_ID }
}

/** Lists every post on the connected Instagram account (for bulk sync). */
export function instagramLister(token: string) {
  return () => listOwnMedia(token, instagramOptions())
}

export const INSTAGRAM_IMAGE_HOSTS = ['cdninstagram.com', 'fbcdn.net'] as const

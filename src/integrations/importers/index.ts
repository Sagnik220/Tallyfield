import 'server-only'
import { serverEnv } from '@/config/env.server'
import { createInstagramImporter } from './instagram/importer'
import { ImporterRegistry } from './registry'

let registry: ImporterRegistry | undefined

/** Every source the site can import from. Add new importers here. */
export function importers(): ImporterRegistry {
  registry ??= new ImporterRegistry().register(createInstagramImporter({ apiVersion: serverEnv().INSTAGRAM_API_VERSION, accountId: serverEnv().INSTAGRAM_ACCOUNT_ID }))
  return registry
}

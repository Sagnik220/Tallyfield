'use server'

import { z } from 'zod'
import { getIntegrationToken } from '@/data/tokens.repo'
import { STAFF } from '@/domain/roles'
import { importers } from '@/integrations/importers'
import { importFromLink } from '@/services/import.service'
import { action } from '../action'

const run = action({
  name: 'import.fromLink',
  roles: STAFF,
  schema: z.object({ link: z.string().trim().min(10).max(300), categoryId: z.uuid() }),
  // Each import calls a third-party API and downloads files, so it is limited per person.
  rateLimit: { bucket: 'import', max: 10, windowSeconds: 600 },
  handler: (input, ctx) => importFromLink(ctx, input, { importers: importers(), getToken: getIntegrationToken }),
})

export async function importFromLinkAction(input: unknown) {
  return run(input)
}

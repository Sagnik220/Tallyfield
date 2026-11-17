import 'server-only'
import { AppError } from '@/domain/result'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Reads a third-party access token. This is the only place the secret-key client is used:
 * the integration_tokens table is unreachable for every signed-in role, admins included.
 */
export async function getIntegrationToken(provider: string): Promise<string> {
  const { data, error } = await createServiceClient()
    .from('integration_tokens')
    .select('access_token, expires_at')
    .eq('provider', provider)
    .maybeSingle()
  if (error) throw new Error(`getIntegrationToken: ${error.message}`)
  if (!data) throw new AppError('upstream', `No ${provider} account is connected yet.`)
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    throw new AppError('upstream', `The ${provider} connection has expired. Reconnect the account.`)
  }
  return data.access_token as string
}

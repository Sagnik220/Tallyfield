import { AppError } from '@/domain/result'

export interface SafeFetchOptions {
  /** Host names (or parent domains) that may be contacted, e.g. ["cdninstagram.com"]. */
  allowedHosts: readonly string[]
  allowedTypes: readonly string[]
  maxBytes: number
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

/** True when host is one of the allowed names or a sub-domain of one. */
export function isAllowedHost(host: string, allowed: readonly string[]): boolean {
  const h = host.toLowerCase()
  return allowed.some((a) => h === a || h.endsWith(`.${a}`))
}

/** Checks a URL before the server contacts it: https only, no credentials, default port, allow-listed host. */
export function assertSafeUrl(input: string, allowedHosts: readonly string[]): URL {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new AppError('invalid_input', 'That is not a valid link.')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !isAllowedHost(url.hostname, allowedHosts)) {
    throw new AppError('invalid_input', 'That link points somewhere this site does not fetch from.')
  }
  return url
}

/**
 * Downloads a file the server did not choose itself (for example an image address returned by an API).
 * Guards against the server being tricked into fetching internal addresses or huge files:
 * allow-listed hosts only, redirects refused, content type checked, size capped, time limited.
 */
export async function safeDownload(input: string, options: SafeFetchOptions): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const url = assertSafeUrl(input, options.allowedHosts)
  const doFetch = options.fetchImpl ?? fetch
  const response = await doFetch(url, { redirect: 'manual', signal: AbortSignal.timeout(options.timeoutMs ?? 15_000) })
  if (response.status !== 200) throw new AppError('upstream', 'The image could not be downloaded.')
  const mimeType = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
  if (!options.allowedTypes.includes(mimeType)) throw new AppError('upstream', 'The file is not a supported image type.')
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > options.maxBytes) throw new AppError('upstream', 'The image is too large.')
  if (!response.body) throw new AppError('upstream', 'The image could not be downloaded.')

  const chunks: Uint8Array[] = []
  let total = 0
  const reader = response.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > options.maxBytes) {
      await reader.cancel()
      throw new AppError('upstream', 'The image is too large.')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { bytes, mimeType }
}

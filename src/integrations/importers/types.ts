/** What any importer returns, whatever the source. */
export interface ImportedPost {
  provider: string
  externalId: string
  permalink: string
  caption: string
  imageUrls: string[]
}

/**
 * One source that posts can be imported from.
 * To add a source (YouTube, a newsletter, ...): implement this interface and register it in ./index.ts.
 */
export interface SourceImporter {
  /** Stored in social_sources.provider and used as the integration_tokens key. */
  provider: string
  /** Host names image files for this source are served from. Downloads are refused from anywhere else. */
  imageHosts: readonly string[]
  /** Does this link belong to this source? */
  matches(url: URL): boolean
  /** Fetches the post behind the link using the connected account's token. */
  fetchPost(url: URL, accessToken: string): Promise<ImportedPost>
}

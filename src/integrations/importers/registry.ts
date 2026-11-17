import { AppError } from '@/domain/result'
import type { SourceImporter } from './types'

export class ImporterRegistry {
  private readonly importers: SourceImporter[] = []

  register(importer: SourceImporter): this {
    if (this.importers.some((i) => i.provider === importer.provider)) throw new Error(`Importer registered twice: ${importer.provider}`)
    this.importers.push(importer)
    return this
  }

  /** Finds the importer for a pasted link. Only https links to a known source are accepted. */
  resolve(link: string): { importer: SourceImporter; url: URL } {
    let url: URL
    try {
      url = new URL(link.trim())
    } catch {
      throw new AppError('invalid_input', 'That is not a valid link.')
    }
    if (url.protocol !== 'https:') throw new AppError('invalid_input', 'The link must start with https://')
    const importer = this.importers.find((i) => i.matches(url))
    if (!importer) throw new AppError('invalid_input', 'Posts cannot be imported from that site yet.')
    return { importer, url }
  }
}

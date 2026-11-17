import { z } from 'zod'

/** Plain text only. Blocks never store HTML, so nothing a writer types can run as code on the site. */
export const text = (max: number) => z.string().trim().max(max)
export const requiredText = (max: number) => z.string().trim().min(1).max(max)
export const mediaId = z.uuid()
export const priceInr = z.number().int().positive().max(1_000_000_000)

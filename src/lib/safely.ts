/**
 * Runs a read for a public page and falls back instead of failing the page.
 * A database hiccup (or a CI build with placeholder credentials) shows an empty state, never an error screen.
 */
export async function safely<T>(label: string, read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read()
  } catch (error) {
    console.error(`[public:${label}]`, error instanceof Error ? error.message : error)
    return fallback
  }
}

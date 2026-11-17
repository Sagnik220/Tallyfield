import { NextResponse, type NextRequest } from 'next/server'
import { searchPosts } from '@/data/search.repo'
import { searchParamsSchema } from '@/domain/post'
import { createSessionClient } from '@/lib/supabase/server'

/** GET /api/search?q=citizen&category=comparison&tag=tissot&tag=automatic&page=1 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams
  const parsed = searchParamsSchema.safeParse({
    q: query.get('q') ?? undefined,
    category: query.get('category') ?? undefined,
    tags: query.getAll('tag'),
    page: query.get('page') ?? undefined,
  })
  if (!parsed.success) return NextResponse.json({ error: 'Invalid search' }, { status: 400 })
  try {
    const results = await searchPosts(await createSessionClient(), parsed.data)
    return NextResponse.json({ results }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
  } catch (error) {
    console.error('[api:search]', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Search is unavailable' }, { status: 503 })
  }
}

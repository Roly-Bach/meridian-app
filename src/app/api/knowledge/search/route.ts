import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase-server'
import { generateEmbedding } from '@/services/embeddings'
import { checkUserLimitProcessSteps } from '@/lib/ratelimit'

const SearchSchema = z.object({
  workspace_id: z.string().uuid('workspace_id must be a valid UUID'),
  q: z.string().min(1).max(500),
  type: z.enum(['process_step', 'pain_point', 'tool', 'role']).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
})

// GET /api/knowledge/search?workspace_id=xxx&q=text[&type=process_step][&limit=10]
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const parsed = SearchSchema.safeParse({
    workspace_id: searchParams.get('workspace_id'),
    q: searchParams.get('q'),
    type: searchParams.get('type') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { workspace_id, q, type, limit } = parsed.data

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('workspace_id', workspace_id)
    .single()

  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rateLimitResponse = await checkUserLimitProcessSteps(user.id)
  if (rateLimitResponse) return rateLimitResponse

  const embedding = await generateEmbedding(q)
  if (!embedding) {
    return NextResponse.json({ error: 'Embedding generation failed' }, { status: 503 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: results, error } = await (supabase as any).rpc('search_knowledge_objects', {
    query_embedding: embedding,
    workspace_id,
    object_type: type ?? null,
    match_count: limit,
  })

  if (error) {
    console.error('[knowledge/search] rpc failed:', error.message)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }

  return NextResponse.json({ results: results ?? [], count: (results ?? []).length })
}

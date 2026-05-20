import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'

// GET /api/interview/[token]/objects
// Returns all knowledge_objects for an interview.
// Auth: Supabase session (workspace isolation via RLS) or token-based for interviewee.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const admin = getSupabaseAdmin()

  // Resolve interview by access token
  const { data: interview, error: interviewError } = await admin
    .from('interviews')
    .select('id, workspace_id')
    .eq('access_token', token)
    .single()

  if (interviewError || !interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
  }

  // Verify caller has access — either owns the workspace or is the interviewee (token-based)
  // For dashboard use: verify session workspace matches
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('user_id', user.id)
      .eq('id', interview.workspace_id)
      .single()

    if (!workspace) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }
  // If no user session: token alone grants read access (interviewee can see their own extractions)

  const { data: objects, error } = await admin
    .from('knowledge_objects')
    .select('id, type, content, source_quote, turn_id, created_at')
    .eq('interview_id', interview.id)
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) {
    console.error('[objects] fetch failed:', error.message)
    return NextResponse.json({ error: 'Failed to fetch objects' }, { status: 500 })
  }

  return NextResponse.json({ objects: objects ?? [], count: objects?.length ?? 0 })
}

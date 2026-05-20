import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// GET /api/process-steps?workspace_id=xxx
// Returns all process_steps for a workspace, sorted by created_at desc.

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id query param required' }, { status: 400 })
  }

  // Verify caller is a member of this workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('workspace_id', workspaceId)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = getSupabaseAdmin()
  const { data: processSteps, error } = await admin
    .from('process_steps')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[process-steps] fetch failed:', error.message)
    return NextResponse.json({ error: 'Failed to fetch process steps' }, { status: 500 })
  }

  return NextResponse.json({ process_steps: processSteps ?? [] })
}

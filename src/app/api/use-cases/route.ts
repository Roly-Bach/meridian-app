import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// GET /api/use-cases?workspace_id=xxx
// Returns all use_cases for a workspace, sorted by score desc.

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id query param required' }, { status: 400 })
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('workspace_id', workspaceId)
    .single()

  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = getSupabaseAdmin()
  const { data: useCases, error } = await admin
    .from('use_cases')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('score', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[use-cases] fetch failed:', error.message)
    return NextResponse.json({ error: 'Failed to fetch use cases' }, { status: 500 })
  }

  const totalRoi = (useCases ?? []).reduce((sum, uc) => sum + (uc.roi_eur_per_year ?? 0), 0)

  return NextResponse.json({
    use_cases: useCases ?? [],
    total_roi_eur: Math.round(totalRoi * 100) / 100,
  })
}

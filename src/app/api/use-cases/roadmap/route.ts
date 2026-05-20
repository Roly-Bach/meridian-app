import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// GET /api/use-cases/roadmap?workspace_id=xxx
// Returns use_cases grouped by quarter (Q1/Q2/Q3) with per-quarter ROI totals.

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id query param required' }, { status: 400 })
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('user_id', user.id)
    .eq('id', workspaceId)
    .single()

  if (!workspace) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = getSupabaseAdmin()
  const { data: useCases, error } = await admin
    .from('use_cases')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('score', { ascending: false })

  if (error) {
    console.error('[use-cases/roadmap] fetch failed:', error.message)
    return NextResponse.json({ error: 'Failed to fetch roadmap' }, { status: 500 })
  }

  const grouped = { Q1: [] as typeof useCases, Q2: [] as typeof useCases, Q3: [] as typeof useCases }
  for (const uc of useCases ?? []) {
    const q = (uc.quarter ?? 'Q3') as 'Q1' | 'Q2' | 'Q3'
    if (q in grouped) grouped[q].push(uc)
  }

  const roiByQuarter = (q: typeof grouped[keyof typeof grouped]) =>
    Math.round(q.reduce((sum, uc) => sum + (uc.roi_eur_per_year ?? 0), 0) * 100) / 100

  return NextResponse.json({
    Q1: grouped.Q1,
    Q2: grouped.Q2,
    Q3: grouped.Q3,
    roi_Q1: roiByQuarter(grouped.Q1),
    roi_Q2: roiByQuarter(grouped.Q2),
    roi_Q3: roiByQuarter(grouped.Q3),
    total_roi_eur: roiByQuarter([...grouped.Q1, ...grouped.Q2, ...grouped.Q3]),
  })
}

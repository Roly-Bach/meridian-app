import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { runHeuristicEngine } from '@/services/useCaseEngine'

const GenerateSchema = z.object({
  workspace_id: z.string().uuid('workspace_id must be a valid UUID'),
})

// POST /api/use-cases/generate
// Runs the 8-rule heuristic engine on all process_steps in a workspace.
// Insert-then-delete: new use_cases inserted first to prevent data loss on failure.

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { workspace_id } = parsed.data

  // Verify caller owns this workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, hourly_rate')
    .eq('user_id', user.id)
    .eq('id', workspace_id)
    .single()

  if (!workspace) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const hourlyRate = workspace.hourly_rate ?? 45
  const admin = getSupabaseAdmin()

  // Fetch all process_steps for workspace
  const { data: steps } = await admin
    .from('process_steps')
    .select('id, workspace_id, title, description, frequency_per_month, duration_minutes, data_sources, rule_based, error_rate_percent, media_breaks')
    .eq('workspace_id', workspace_id)

  if (!steps || steps.length === 0) {
    return NextResponse.json({ use_cases: [], total_roi_eur: 0 })
  }

  // Run heuristic engine
  const generated = runHeuristicEngine(steps, hourlyRate)

  // Fetch existing IDs before any writes (for safe cleanup after successful insert)
  const { data: existingIds } = await admin
    .from('use_cases')
    .select('id')
    .eq('workspace_id', workspace_id)

  // Insert new use_cases first — if this fails, old data is preserved
  if (generated.length > 0) {
    const { error } = await admin.from('use_cases').insert(generated)
    if (error) {
      console.error('[use-cases/generate] insert failed:', error.message)
      return NextResponse.json({ error: 'Failed to save use cases' }, { status: 500 })
    }
  }

  // Delete old use_cases only after successful insert
  if (existingIds && existingIds.length > 0) {
    const ids = existingIds.map((r) => r.id)
    await admin.from('use_cases').delete().in('id', ids)
  }

  // Fetch back with IDs
  const { data: useCases } = await admin
    .from('use_cases')
    .select('*')
    .eq('workspace_id', workspace_id)
    .order('score', { ascending: false })

  const totalRoi = (useCases ?? []).reduce((sum, uc) => sum + (uc.roi_eur_per_year ?? 0), 0)

  return NextResponse.json({
    use_cases: useCases ?? [],
    total_roi_eur: Math.round(totalRoi * 100) / 100,
  })
}

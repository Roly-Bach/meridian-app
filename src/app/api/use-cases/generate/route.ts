import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { runHeuristicEngine, type ClusterContext, type ClusterParticipant, type EngineProcessStep } from '@/services/useCaseEngine'
import { checkUserLimitUseCases } from '@/lib/ratelimit'

const GenerateSchema = z.object({
  workspace_id: z.string().uuid('workspace_id must be a valid UUID'),
})

// POST /api/use-cases/generate
// Runs the heuristic engine (R1–R8, P1–P4, C1–C3) on all process_steps + clusters in a workspace.
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

  // Verify caller is a member of this workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('workspace_id', workspace_id)
    .single()

  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rateLimitResponse = await checkUserLimitUseCases(user.id)
  if (rateLimitResponse) return rateLimitResponse

  const admin = getSupabaseAdmin()
  const { data: workspace } = await admin
    .from('workspaces')
    .select('hourly_rate')
    .eq('id', workspace_id)
    .single()

  const hourlyRate = workspace?.hourly_rate ?? 45

  // Fetch process_steps, knowledge_objects (with embeddings for P4), and clusters in parallel
  const [{ data: steps }, { data: knowledgeObjects }, { data: clustersRaw }] = await Promise.all([
    admin
      .from('process_steps')
      .select('id, workspace_id, title, description, frequency_per_month, duration_minutes, data_sources, rule_based, error_rate_percent, media_breaks, interview_id')
      .eq('workspace_id', workspace_id),
    admin
      .from('knowledge_objects')
      .select('type, content, interview_id, embedding')
      .eq('workspace_id', workspace_id)
      .in('type', ['pain_point', 'tool']),
    admin
      .from('process_clusters')
      .select(`
        id, workspace_id, canonical_title, canonical_description, participant_count, participants,
        process_steps(id, workspace_id, interview_id, title, description, frequency_per_month, duration_minutes, error_rate_percent, rule_based, data_sources, media_breaks)
      `)
      .eq('workspace_id', workspace_id)
      .gte('participant_count', 2),
  ])

  if (!steps || steps.length === 0) {
    return NextResponse.json({ use_cases: [], total_roi_eur: 0 })
  }

  // Build a step lookup map for cluster participant resolution
  const stepMap = new Map<string, EngineProcessStep>()
  for (const s of steps) {
    stepMap.set(s.id, s as EngineProcessStep)
  }

  // Build ClusterContext[] from raw cluster data
  const clusterContexts: ClusterContext[] = []
  for (const raw of clustersRaw ?? []) {
    const participants: ClusterParticipant[] = []

    for (const p of (raw.participants as Array<{ interview_id: string; employee_name: string; employee_role: string | null; process_step_id: string }> ?? [])) {
      const step = stepMap.get(p.process_step_id)
      if (!step) continue
      participants.push({
        interview_id: p.interview_id,
        employee_name: p.employee_name,
        employee_role: p.employee_role,
        process_step_id: p.process_step_id,
        step,
      })
    }

    if (participants.length >= 2) {
      clusterContexts.push({
        id: raw.id,
        workspace_id: raw.workspace_id,
        canonical_title: raw.canonical_title,
        canonical_description: raw.canonical_description,
        participant_count: raw.participant_count,
        participants,
      })
    }
  }

  // Run heuristic engine: R1–R8 + P1–P4 + C1–C3
  const generated = runHeuristicEngine(
    steps as EngineProcessStep[],
    hourlyRate,
    (knowledgeObjects ?? []) as import('@/services/useCaseEngine').KnowledgeObjectContext[],
    clusterContexts,
  )

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

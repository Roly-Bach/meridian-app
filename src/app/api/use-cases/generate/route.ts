import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { runHeuristicEngine, type ClusterContext, type ClusterParticipant, type EngineProcessStep } from '@/services/useCaseEngine'
import { checkUserLimitUseCases } from '@/lib/ratelimit'
import { deriveProcessStepDisplayFieldsFromRaw } from '@/lib/schrittDatenView'

// PROJ-45 (ADR-025 D1): process_steps no longer carries the flat potenzial/
// rule_based/data_sources columns — schritt_daten (JSONB) replaces them.
// Maps a raw process_steps row (+ schritt_daten) into the EngineProcessStep
// shape useCaseEngine.ts's own R1–R8/C1–C3 heuristics expect (unchanged logic).
function toEngineProcessStep(row: {
  id: string
  workspace_id: string
  interview_id: string
  title: string
  description: string | null
  schritt_daten: unknown
  embedding?: number[] | null
}): EngineProcessStep {
  const display = deriveProcessStepDisplayFieldsFromRaw(row.schritt_daten)
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    interview_id: row.interview_id,
    title: row.title,
    description: row.description,
    embedding: row.embedding,
    ...display,
  }
}

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

  // Fetch process_steps, knowledge_objects, clusters, and interview clarification_answers in parallel
  const [{ data: stepsRaw }, { data: knowledgeObjects }, { data: clustersRaw }, { data: interviews }] = await Promise.all([
    admin
      .from('process_steps')
      .select('id, workspace_id, title, description, schritt_daten, interview_id, embedding')
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
        process_steps(id, workspace_id, interview_id, title, description, schritt_daten)
      `)
      .eq('workspace_id', workspace_id)
      .gte('participant_count', 2),
    admin
      .from('interviews')
      .select('id, clarification_answers')
      .eq('workspace_id', workspace_id)
      .not('clarification_answers', 'is', null),
  ])

  if (!stepsRaw || stepsRaw.length === 0) {
    return NextResponse.json({ use_cases: [], total_roi_eur: 0 })
  }

  const steps: EngineProcessStep[] = stepsRaw.map(toEngineProcessStep)

  // Build a step lookup map for cluster participant resolution
  const stepMap = new Map<string, EngineProcessStep>()
  for (const s of steps) {
    stepMap.set(s.id, s)
  }

  // Build ClusterContext[] from raw cluster data.
  // Use FK-joined process_steps (cluster_id) as source of truth — not the participants JSON,
  // which can contain ghost references to process_steps deleted from previous eval runs.
  const clusterContexts: ClusterContext[] = []
  for (const raw of clustersRaw ?? []) {
    const participants: ClusterParticipant[] = []

    for (const ps of (raw.process_steps as Array<{ id: string; interview_id: string }> ?? [])) {
      const step = stepMap.get(ps.id)
      if (!step) continue
      // Employee metadata from participants JSON (best-effort, not required for engine logic)
      const jsonEntry = (raw.participants as Array<{ process_step_id: string; employee_name: string; employee_role: string | null }> ?? [])
        .find(p => p.process_step_id === ps.id)
      participants.push({
        interview_id: ps.interview_id,
        employee_name: jsonEntry?.employee_name ?? 'Unbekannt',
        employee_role: jsonEntry?.employee_role ?? null,
        process_step_id: ps.id,
        step,
      })
    }

    if (participants.length >= 2) {
      clusterContexts.push({
        id: raw.id,
        workspace_id: raw.workspace_id,
        canonical_title: raw.canonical_title,
        canonical_description: raw.canonical_description,
        participant_count: participants.length,
        participants,
      })
    }
  }

  // Build qualitative context map: interview_id → string[] of qualitative answers (M2)
  const qualitativeContext = new Map<string, string[]>()
  for (const iv of interviews ?? []) {
    const answers = iv.clarification_answers as Record<string, string | string[]> | null
    if (!answers) continue
    const qualTexts: string[] = []
    for (const [key, value] of Object.entries(answers)) {
      if (!key.endsWith('__qualitative')) continue
      if (typeof value === 'string' && value.trim()) qualTexts.push(value.trim())
      else if (Array.isArray(value)) qualTexts.push(...value.filter(Boolean))
    }
    if (qualTexts.length > 0) qualitativeContext.set(iv.id, qualTexts)
  }

  // Run heuristic engine: R1–R8 + P1–P4 + C1–C3
  const generated = runHeuristicEngine(
    steps,
    hourlyRate,
    (knowledgeObjects ?? []) as import('@/services/useCaseEngine').KnowledgeObjectContext[],
    clusterContexts,
    qualitativeContext,
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

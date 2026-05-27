import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { extractAndEmbed } from '@/services/extraction'
import { createProcessStepsFromTracker } from '@/services/processEnrichment'

// ─── POST /api/interviews/[id]/reextract ──────────────────────────────────────
// Auth: Supabase session (Berater only — checks workspace ownership)
// Re-runs extraction + enrichment for all turns of a completed interview.
// Idempotent: safe to call multiple times.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: interviewId } = await params
  const supabase = getSupabaseAdmin()

  // ── Auth: verify caller owns this interview's workspace ─────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const jwt = authHeader.slice(7)
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  )
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Load interview + verify ownership ───────────────────────────────────────
  const { data: interview, error: ivError } = await supabase
    .from('interviews')
    .select('id, workspace_id, status, employee_name')
    .eq('id', interviewId)
    .single()

  if (ivError || !interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
  }

  // Verify user belongs to this workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('workspace_id', interview.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Load all turns ───────────────────────────────────────────────────────────
  const { data: turns, error: turnsError } = await supabase
    .from('turns')
    .select('id, turn_number, user_input, agent_response')
    .eq('interview_id', interviewId)
    .order('turn_number', { ascending: true })

  if (turnsError || !turns || turns.length === 0) {
    return NextResponse.json({ error: 'No turns found' }, { status: 404 })
  }

  // ── Re-run extraction for each turn ─────────────────────────────────────────
  // Build cumulative transcript up to each turn and re-extract
  let extractionCount = 0
  for (let i = 0; i < turns.length; i++) {
    const transcript = turns.slice(0, i + 1).map(t => ({
      user_input: t.user_input,
      agent_response: t.agent_response,
    }))

    try {
      await extractAndEmbed({
        interviewId,
        workspaceId: interview.workspace_id,
        turnId: turns[i].id,
        transcript,
      })
      extractionCount++
    } catch (err) {
      console.error(`[reextract] Turn ${turns[i].turn_number} failed:`, err)
    }
  }

  // ── Re-create process_steps from tracker ────────────────────────────────────
  // Delete existing first so idempotency guard doesn't block re-creation.
  try {
    await supabase.from('process_steps').delete().eq('interview_id', interviewId)
    await createProcessStepsFromTracker({
      interviewId,
      workspaceId: interview.workspace_id,
    })
  } catch (err) {
    console.error('[reextract] createProcessStepsFromTracker failed:', err)
  }

  // ── Count results ────────────────────────────────────────────────────────────
  const [{ count: koCount }, { count: psCount }] = await Promise.all([
    supabase
      .from('knowledge_objects')
      .select('*', { count: 'exact', head: true })
      .eq('interview_id', interviewId),
    supabase
      .from('process_steps')
      .select('*', { count: 'exact', head: true })
      .eq('interview_id', interviewId),
  ])

  return NextResponse.json({
    ok: true,
    turns_processed: extractionCount,
    knowledge_objects: koCount ?? 0,
    process_steps: psCount ?? 0,
  })
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { enrichProcessSteps } from '@/services/processEnrichment'
import { checkUserLimitProcessSteps } from '@/lib/ratelimit'

const GenerateSchema = z.object({
  interview_id: z.string().uuid('interview_id must be a valid UUID'),
})

// POST /api/process-steps/generate
// Triggers LLM enrichment for all process_step knowledge objects of an interview.
// Idempotent — safe to call multiple times.

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { interview_id } = parsed.data

  const admin = getSupabaseAdmin()

  // Verify interview belongs to caller's workspace
  const { data: interview } = await admin
    .from('interviews')
    .select('id, workspace_id')
    .eq('id', interview_id)
    .single()

  if (!interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('workspace_id', interview.workspace_id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rateLimitResponse = await checkUserLimitProcessSteps(user.id)
  if (rateLimitResponse) return rateLimitResponse

  // Run enrichment (blocking for direct API call — fire-and-forget from agent)
  await enrichProcessSteps({
    interviewId: interview_id,
    workspaceId: interview.workspace_id,
  })

  const { data: processSteps } = await admin
    .from('process_steps')
    .select('*')
    .eq('interview_id', interview_id)
    .order('created_at', { ascending: true })

  return NextResponse.json({
    process_steps: processSteps ?? [],
    count: processSteps?.length ?? 0,
  })
}

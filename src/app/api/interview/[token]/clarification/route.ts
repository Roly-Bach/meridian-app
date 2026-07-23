import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { createProcessStepsFromTracker } from '@/services/processEnrichment'
import { clusterProcessSteps } from '@/services/processClustering'
import { deduplicateKnowledgeObjects } from '@/services/extraction'
import { generateEmbedding } from '@/services/embeddings'
import { checkTokenEndpointLimits, extractIP } from '@/lib/ratelimit'
import { createSupabaseTurnStore } from '@/services/turnStore/supabaseTurnStore'
import { applyClarificationSlotAnswers } from '@/services/clarificationAnswers'
import type { Json } from '@/lib/database.types'

const TOKEN_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const AnswerSchema = z.object({
  process_step_id: z.string().min(1),
  slot_key: z.string().min(1),
  answer: z.union([z.string(), z.array(z.string()).min(1)]),
})

const ClarificationInputSchema = z.object({
  answers: z.array(AnswerSchema).min(1),
})

// ─── POST /api/interview/[token]/clarification ────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!TOKEN_UUID_RE.test(token)) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
  }

  const ip = extractIP(req)
  const rateLimitResponse = await checkTokenEndpointLimits(token, ip)
  if (rateLimitResponse) return rateLimitResponse

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ClarificationInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { answers } = parsed.data

  const supabase = getSupabaseAdmin()

  const { data: rawInterview, error: fetchError } = await supabase
    .from('interviews')
    .select('id, workspace_id, status, token_expires_at')
    .eq('access_token', token)
    .single()

  if (fetchError || !rawInterview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
  }

  if (new Date(rawInterview.token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Dieser Interview-Link ist nicht mehr gültig' }, { status: 410 })
  }

  if (rawInterview.status === 'completed') {
    return NextResponse.json({ success: true }, { status: 409 })
  }

  const interviewId = rawInterview.id
  const workspaceId = rawInterview.workspace_id

  // Build clarification_answers record keyed by `${process_step_id}__${slot_key}`
  const clarificationAnswers: Record<string, string | string[]> = {}
  for (const a of answers) {
    clarificationAnswers[`${a.process_step_id}__${a.slot_key}`] = a.answer
  }

  // Persist clarification_answers to interviews table
  await supabase
    .from('interviews')
    .update({ clarification_answers: clarificationAnswers as unknown as Json })
    .eq('id', interviewId)

  // PROJ-43 (AC3/AC4/AC5): SlotCard answers (frequency/duration/error_rate_percent/
  // entscheidungslogik) are read-merge-write against interview_state.step_tracker —
  // NOT process_steps, which doesn't have rows for this interview yet at this point
  // (process_steps is only ever created FROM step_tracker, in the after() pipeline
  // below). Going through the TurnStore's register_step intent (a plain full-array
  // replace, same mechanic computeMergedSteps/data_sources-backfill already use)
  // keeps this route and the eval runner's evalStore.ts on the exact same write path.
  const store = createSupabaseTurnStore()
  const session = await store.openTurn(interviewId, workspaceId)
  const updatedTracker = applyClarificationSlotAnswers(session.snapshot().stepTracker, answers)
  session.stage({ kind: 'register_step', tracker: updatedTracker })
  await session.commit()

  // Process OpenItemCards — register confirmed steps as process_steps (+ KO for audit)
  const openItemAnswers = answers.filter(
    (a) => a.slot_key === 'open_item'
      && typeof a.answer === 'string'
      && (a.answer === 'Ja' || a.answer === 'Manchmal')
  )

  for (const oa of openItemAnswers) {
    await supabase.from('knowledge_objects').insert({
      interview_id: interviewId,
      workspace_id: workspaceId,
      type: 'process_step',
      content: { title: oa.process_step_id, confirmed_via: 'clarification', answer: oa.answer },
    })

    // Skip if a process_step with this title already exists for the interview
    const { count: existingCount } = await supabase
      .from('process_steps')
      .select('*', { count: 'exact', head: true })
      .eq('interview_id', interviewId)
      .eq('title', oa.process_step_id)

    if ((existingCount ?? 0) > 0) continue

    // Insert process_step so it participates in clustering and use-case generation.
    // No slots — step was only confirmed, not walked through. Clustering picks it up via embedding.
    const title = oa.process_step_id
    const embedding = await generateEmbedding(title, { interviewId })

    const { error: stepError } = await supabase.from('process_steps').insert({
      interview_id: interviewId,
      workspace_id: workspaceId,
      title,
      description: null,
      source_quote: null,
      step_type: 'action',
      condition_text: null,
      embedding: embedding as number[],
      // No slots — step was only confirmed, not walked through.
      schritt_daten: null,
    })

    if (stepError) {
      console.error('[clarification] OpenItem process_step insert failed:', stepError.message)
    }
  }

  // Complete the interview
  await supabase
    .from('interviews')
    .update({ status: 'completed', extractions_pending: true })
    .eq('id', interviewId)

  // Post-completion pipeline
  after(async () => {
    try {
      await createProcessStepsFromTracker({ interviewId, workspaceId })
    } catch (err) {
      console.error('[clarification] createProcessStepsFromTracker failed:', err)
    }
    clusterProcessSteps(workspaceId).catch((err) =>
      console.error('[clarification] clusterProcessSteps failed:', err)
    )
    deduplicateKnowledgeObjects(workspaceId).catch((err) =>
      console.error('[clarification] deduplicateKnowledgeObjects failed:', err)
    )
  })

  return NextResponse.json({ success: true })
}

import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { createProcessStepsFromTracker } from '@/services/processEnrichment'
import { clusterProcessSteps, resynthesizeClusters } from '@/services/processClustering'
import { deduplicateKnowledgeObjects } from '@/services/extraction'
import { generateEmbedding } from '@/services/embeddings'
import { checkTokenEndpointLimits, extractIP } from '@/lib/ratelimit'
import { parseSchrittDaten } from '@/services/interviewSemantic'
import { mergeManualCorrection, type ManualCorrectionPatch } from '@/lib/schrittDatenView'
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

// ─── Slot answer → typed schritt_daten patch ─────────────────────────────────

const FREQUENCY_MAP: Record<string, number> = {
  'Täglich': 22,
  'Wöchentlich': 4,
  'Mehrfach/Monat': 8,
  'Monatlich': 1,
}

const DURATION_MAP: Record<string, number> = {
  '< 5 Min': 3,
  '5–15 Min': 10,
  '15–30 Min': 22,
  '> 30 Min': 45,
}

// PROJ-45: rule_based (boolean column) is gone — entscheidungslogik is free text
// since PROJ-25. The closed-choice SlotCard answer is stored verbatim.
const ENTSCHEIDUNGSLOGIK_MAP: Record<string, boolean> = {
  'Immer gleich': true,
  'Meistens gleich': true,
  'Variiert stark': false,
}

const ERROR_RATE_MAP: Record<string, number> = {
  'Selten Fehler': 2,
  'Gelegentlich': 10,
  'Häufig': 30,
}

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
    .update({ clarification_answers: clarificationAnswers as unknown as import('@/lib/database.types').Json })
    .eq('id', interviewId)

  // Process SlotCards — read-merge-write into schritt_daten (PROJ-45/ADR-025:
  // frequency/duration/entscheidungslogik/error_rate_percent
  // no longer have their own columns).
  const slotAnswers = answers.filter(
    (a) => ['frequency', 'duration', 'entscheidungslogik', 'error_rate_percent'].includes(a.slot_key)
      && typeof a.answer === 'string'
      && a.answer !== 'Weiß ich nicht'
  )

  const updatedStepIds = new Set<string>()

  async function applyPatchToStep(stepId: string, patch: ManualCorrectionPatch) {
    const { data: row } = await supabase.from('process_steps').select('schritt_daten').eq('id', stepId).single()
    if (!row) return
    const merged = mergeManualCorrection(parseSchrittDaten(row.schritt_daten), patch)
    await supabase.from('process_steps').update({ schritt_daten: merged as unknown as Json }).eq('id', stepId)
    updatedStepIds.add(stepId)
  }

  for (const sa of slotAnswers) {
    const answerStr = sa.answer as string
    const patch: ManualCorrectionPatch = {}

    if (sa.slot_key === 'frequency' && FREQUENCY_MAP[answerStr] !== undefined) {
      patch.frequency = FREQUENCY_MAP[answerStr]
    } else if (sa.slot_key === 'duration' && DURATION_MAP[answerStr] !== undefined) {
      patch.duration = DURATION_MAP[answerStr]
    } else if (sa.slot_key === 'entscheidungslogik' && ENTSCHEIDUNGSLOGIK_MAP[answerStr] !== undefined) {
      patch.rule_based = ENTSCHEIDUNGSLOGIK_MAP[answerStr]
    } else if (sa.slot_key === 'error_rate_percent' && ERROR_RATE_MAP[answerStr] !== undefined) {
      patch.error_rate_percent = ERROR_RATE_MAP[answerStr]
    }

    if (Object.keys(patch).length === 0) continue

    // Try to match by UUID first, fall back to title match
    const isUuid = TOKEN_UUID_RE.test(sa.process_step_id)
    if (isUuid) {
      await applyPatchToStep(sa.process_step_id, patch)
    } else {
      const { data: matchedSteps } = await supabase
        .from('process_steps')
        .select('id')
        .eq('title', sa.process_step_id)
        .eq('interview_id', interviewId)
      for (const s of matchedSteps ?? []) {
        await applyPatchToStep(s.id, patch)
      }
    }
  }

  // Collect cluster_ids of updated steps so synthesis can be re-run with fresh slot values
  const affectedClusterIds: string[] = []
  if (updatedStepIds.size > 0) {
    const { data: clusteredSteps } = await supabase
      .from('process_steps')
      .select('cluster_id')
      .in('id', [...updatedStepIds])
      .not('cluster_id', 'is', null)
    if (clusteredSteps) {
      const seen = new Set<string>()
      for (const row of clusteredSteps) {
        if (row.cluster_id && !seen.has(row.cluster_id)) {
          seen.add(row.cluster_id)
          affectedClusterIds.push(row.cluster_id)
        }
      }
    }
  }

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
    if (affectedClusterIds.length > 0) {
      resynthesizeClusters(affectedClusterIds).catch((err) =>
        console.error('[clarification] resynthesizeClusters failed:', err)
      )
    }
  })

  return NextResponse.json({ success: true })
}

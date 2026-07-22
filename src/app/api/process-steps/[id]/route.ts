import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { parseSchrittDaten } from '@/services/interviewSemantic'
import { mergeManualCorrection } from '@/lib/schrittDatenView'
import type { Database, Json } from '@/lib/database.types'

const PatchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  frequency: z.number().int().min(0, 'Muss ≥ 0 sein').nullable().optional(),
  duration: z.number().int().min(0, 'Muss ≥ 0 sein').nullable().optional(),
  data_sources: z.array(z.string()).optional(),
  rule_based: z.boolean().optional(),
  error_rate_percent: z.number().int().min(0).max(100).nullable().optional(),
  media_breaks: z.number().int().min(0, 'Muss ≥ 0 sein').optional(),
  source_quote: z.string().nullable().optional(),
}).strict()

// PROJ-45 (ADR-025 D1/Consequences): frequency/duration/
// data_sources/rule_based/error_rate_percent/media_breaks no longer have their
// own columns — they live inside schritt_daten (JSONB). A manual PATCH here is
// therefore read-merge-write instead of a plain column update; for the user
// this is invisible, only the backend mechanism changes.

// PATCH /api/process-steps/:id
// Updates individual attributes of a process step.

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Verify process step exists and belongs to caller's workspace
  const { data: step } = await admin
    .from('process_steps')
    .select('id, workspace_id, schritt_daten')
    .eq('id', id)
    .single()

  if (!step) {
    return NextResponse.json({ error: 'Process step not found' }, { status: 404 })
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('workspace_id', step.workspace_id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { title, description, source_quote, frequency, duration, data_sources, rule_based, error_rate_percent, media_breaks } = parsed.data
  const touchesSchrittDaten = [frequency, duration, data_sources, rule_based, error_rate_percent, media_breaks]
    .some((v) => v !== undefined)

  const updatePayload: Database['public']['Tables']['process_steps']['Update'] = {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(source_quote !== undefined ? { source_quote } : {}),
  }
  if (touchesSchrittDaten) {
    const current = parseSchrittDaten(step.schritt_daten)
    updatePayload.schritt_daten = mergeManualCorrection(current, {
      frequency, duration, data_sources, rule_based, error_rate_percent, media_breaks,
    }) as unknown as Json
  }

  const { data: updated, error } = await admin
    .from('process_steps')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[process-steps/:id] update failed:', error.message)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ process_step: updated })
}

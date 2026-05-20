import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const PatchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  frequency_per_month: z.number().int().min(0, 'Muss ≥ 0 sein').nullable().optional(),
  duration_minutes: z.number().int().min(0, 'Muss ≥ 0 sein').nullable().optional(),
  data_sources: z.array(z.string()).optional(),
  rule_based: z.boolean().optional(),
  error_rate_percent: z.number().int().min(0).max(100).nullable().optional(),
  media_breaks: z.number().int().min(0, 'Muss ≥ 0 sein').optional(),
  source_quote: z.string().nullable().optional(),
}).strict()

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
    .select('id, workspace_id')
    .eq('id', id)
    .single()

  if (!step) {
    return NextResponse.json({ error: 'Process step not found' }, { status: 404 })
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('user_id', user.id)
    .eq('id', step.workspace_id)
    .single()

  if (!workspace) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: updated, error } = await admin
    .from('process_steps')
    .update(parsed.data)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[process-steps/:id] update failed:', error.message)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ process_step: updated })
}

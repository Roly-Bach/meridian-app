import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateSubsteps } from '@/services/substepGenerator'

type RouteParams = { params: Promise<{ id: string }> }

async function authorizeStep(id: string, userId: string) {
  const admin = getSupabaseAdmin()
  const { data: step } = await admin
    .from('process_steps')
    .select('id, workspace_id, title, description, source_quote, data_sources, substeps, walkthrough_steps')
    .eq('id', id)
    .single()

  if (!step) return { error: 'Not found', status: 404 as const }

  const supabase = await createClient()
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .eq('workspace_id', step.workspace_id)
    .single()

  if (!membership) return { error: 'Forbidden', status: 403 as const }

  return { step }
}

// GET /api/process-steps/[id]/substeps — return cached substeps
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await authorizeStep(id, user.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json({ substeps: result.step.substeps ?? null })
}

// POST /api/process-steps/[id]/substeps — generate and cache substeps
export async function POST(_req: Request, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await authorizeStep(id, user.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  const { step } = result

  try {
    const substeps = await generateSubsteps({
      title: step.title,
      description: step.description,
      sourceQuote: step.source_quote,
      dataSources: (step.data_sources as string[]) ?? [],
      walkthroughSteps: (step.walkthrough_steps as string[] | undefined) ?? [],
    })

    const admin = getSupabaseAdmin()
    await admin.from('process_steps').update({ substeps: substeps as unknown as never }).eq('id', id)

    return NextResponse.json({ substeps })
  } catch (err) {
    console.error('[substeps] generation failed:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}

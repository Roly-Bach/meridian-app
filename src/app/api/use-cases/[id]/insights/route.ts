import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateUseCaseInsights, type InsightsContext } from '@/services/useCaseInsights'
import { checkUserLimitInsights } from '@/lib/ratelimit'

// POST /api/use-cases/[id]/insights
// Cache-first: returns cached llm_insights if already set; otherwise generates + caches.
// Auth: user must be a workspace member.

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)

  const workspaceIds = memberships?.map(m => m.workspace_id) ?? []

  const admin = getSupabaseAdmin()

  const { data: useCase, error } = await admin
    .from('use_cases')
    .select('id, workspace_id, type, title, reasoning, priority, roi_eur_per_year, roi_breakdown, cluster_id, process_step_id, llm_insights')
    .eq('id', id)
    .in('workspace_id', workspaceIds.length > 0 ? workspaceIds : [''])
    .single()

  if (error || !useCase) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Cache hit — return immediately without LLM call
  if (useCase.llm_insights) {
    return NextResponse.json({ insights: useCase.llm_insights, cached: true })
  }

  const rateLimitResponse = await checkUserLimitInsights(user.id)
  if (rateLimitResponse) return rateLimitResponse

  // Build context for LLM
  const ctx: InsightsContext = {
    useCase: {
      type: useCase.type,
      title: useCase.title,
      reasoning: useCase.reasoning ?? '',
      priority: useCase.priority ?? 'medium',
      roi_eur_per_year: useCase.roi_eur_per_year,
      roi_breakdown: useCase.roi_breakdown as Record<string, unknown> | null,
    },
  }

  // Fetch process step + interview for individual use cases
  if (useCase.process_step_id) {
    const { data: step } = await admin
      .from('process_steps')
      .select('title, description, source_quote, frequency_per_month, duration_minutes, error_rate_percent, rule_based, interview_id')
      .eq('id', useCase.process_step_id)
      .single()

    if (step) {
      const { interview_id, ...stepData } = step
      ctx.processStep = stepData

      if (interview_id) {
        const { data: iv } = await admin
          .from('interviews')
          .select('employee_name, employee_role')
          .eq('id', interview_id)
          .single()
        ctx.interview = iv ?? null
      }
    }
  }

  // Fetch cluster context for cluster use cases
  if (useCase.cluster_id) {
    const { data: clusterRow } = await admin
      .from('process_clusters')
      .select('canonical_title, canonical_description, participant_count')
      .eq('id', useCase.cluster_id)
      .single()

    ctx.cluster = clusterRow ?? null
  }

  try {
    const insights = await generateUseCaseInsights(ctx)

    // Persist to DB for future cache hits
    const { error: updateError } = await admin
      .from('use_cases')
      .update({ llm_insights: insights })
      .eq('id', id)

    if (updateError) {
      console.error('[use-cases/insights] DB update failed:', updateError.message)
    }

    return NextResponse.json({ insights, cached: false })
  } catch (err) {
    console.error('[use-cases/insights] LLM generation failed:', err)
    return NextResponse.json({ error: 'Insights generation failed' }, { status: 500 })
  }
}

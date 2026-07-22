import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { deriveProcessStepDisplayFieldsFromRaw } from '@/lib/schrittDatenView'

// GET /api/use-cases/[id]
// Returns enriched use case detail: use_case + process_step + interview + cluster sub-use-cases.
// Auth: user must be a workspace member.

export async function GET(
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
    .select('*')
    .eq('id', id)
    .in('workspace_id', workspaceIds.length > 0 ? workspaceIds : [''])
    .single()

  if (error || !useCase) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let processStep = null
  let interview = null
  let cluster = null

  // Fetch process step + interview for individual use cases
  if (useCase.process_step_id) {
    const { data: step } = await admin
      .from('process_steps')
      .select('title, description, source_quote, schritt_daten, interview_id')
      .eq('id', useCase.process_step_id)
      .single()

    if (step) {
      const { interview_id, schritt_daten, ...stepData } = step
      processStep = { ...stepData, ...deriveProcessStepDisplayFieldsFromRaw(schritt_daten) }

      if (interview_id) {
        const { data: iv } = await admin
          .from('interviews')
          .select('employee_name, employee_role, created_at')
          .eq('id', interview_id)
          .single()
        interview = iv ?? null
      }
    }
  }

  // Fetch cluster + sub-use-cases for cluster use cases
  if (useCase.cluster_id) {
    const { data: clusterRow } = await admin
      .from('process_clusters')
      .select('canonical_title, canonical_description, participant_count, participants')
      .eq('id', useCase.cluster_id)
      .single()

    if (clusterRow) {
      const participants = (clusterRow.participants ?? []) as Array<{
        interview_id: string
        employee_name: string
        employee_role: string | null
        process_step_id: string
      }>

      // Fetch all participant steps in parallel
      const stepResults = await Promise.all(
        participants
          .filter(p => p.process_step_id)
          .map(p =>
            admin
              .from('process_steps')
              .select('id, title, source_quote, schritt_daten')
              .eq('id', p.process_step_id)
              .single()
              .then(({ data }) => ({ participant: p, step: data }))
          )
      )

      const hourlyRate = (useCase.roi_breakdown as { hourly_rate?: number } | null)?.hourly_rate ?? 45
      const reductionRate = (useCase.roi_breakdown as { reduction_rate?: number } | null)?.reduction_rate ?? 0.7

      const subUseCases = stepResults
        .filter(r => r.step != null)
        .map(r => {
          const s = r.step!
          const display = deriveProcessStepDisplayFieldsFromRaw(s.schritt_daten)
          const roiEur =
            display.frequency_per_month != null && display.duration_minutes != null
              ? Math.round((display.frequency_per_month * display.duration_minutes / 60) * 12 * reductionRate * hourlyRate * 100) / 100
              : null
          return {
            employee_name: r.participant.employee_name,
            employee_role: r.participant.employee_role,
            process_step: {
              title: s.title,
              source_quote: s.source_quote,
              frequency_per_month: display.frequency_per_month,
              duration_minutes: display.duration_minutes,
              error_rate_percent: display.error_rate_percent,
            },
            roi_eur: roiEur,
          }
        })

      cluster = {
        canonical_title: clusterRow.canonical_title,
        canonical_description: clusterRow.canonical_description,
        participant_count: clusterRow.participant_count,
        sub_use_cases: subUseCases,
      }
    }
  }

  return NextResponse.json({ use_case: useCase, process_step: processStep, interview, cluster })
}

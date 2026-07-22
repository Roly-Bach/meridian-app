import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { ProcessStepsTable } from '@/components/ProcessStepsTable'
import { deriveProcessStepDisplayFieldsFromRaw } from '@/lib/schrittDatenView'
import type { ProcessStep } from '@/lib/processStepsAggregation'

export default async function ProcessStepsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get workspace_id from metadata or DB
  let workspaceId = user.user_metadata?.workspace_id as string | undefined
  if (!workspaceId) {
    const { data: member } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true })
      .limit(1)
      .single()
    workspaceId = member?.workspace_id
  }

  const steps: ProcessStep[] = workspaceId
    ? await (async () => {
        const admin = getSupabaseAdmin()
        const { data } = await admin
          .from('process_steps')
          .select('*, interviews(department, employee_name, employee_role, status), process_clusters(id, canonical_title, canonical_description, participant_count, participants)')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(200)
        // PROJ-45 (ADR-025 D1): schritt_daten replaces the flat potenzial/rule_based/
        // data_sources columns — derive them for ProcessStepsTable's existing shape.
        return (data ?? []).map((row) => {
          const { schritt_daten, ...rest } = row
          return { ...rest, ...deriveProcessStepDisplayFieldsFromRaw(schritt_daten) } as ProcessStep
        })
      })()
    : []

  return (
    <div className="max-w-[960px] mx-auto px-8 py-8">
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold text-[#111111]">Prozessschritte</h1>
        <p className="text-[13px] text-[#6B7280] mt-1">
          {steps.length > 0
            ? `${steps.length} Schritt${steps.length !== 1 ? 'e' : ''} aus Interview-Analysen`
            : 'Automatisch abgeleitet nach Interview-Abschluss'}
        </p>
      </div>

      <ProcessStepsTable initialSteps={steps} />
    </div>
  )
}

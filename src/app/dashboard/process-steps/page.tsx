import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { ProcessStepsTable } from '@/components/ProcessStepsTable'

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

  const steps = workspaceId
    ? await (async () => {
        const admin = getSupabaseAdmin()
        const { data } = await admin
          .from('process_steps')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(200)
        return data ?? []
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

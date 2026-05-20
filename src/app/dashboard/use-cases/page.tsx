import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { UseCaseBoardClient } from '@/components/UseCaseBoardClient'

export default async function UseCasesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let workspaceId = user.user_metadata?.workspace_id as string | undefined
  if (!workspaceId) {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('user_id', user.id)
      .single()
    workspaceId = workspace?.id
  }

  const useCases = workspaceId
    ? await (async () => {
        const admin = getSupabaseAdmin()
        const { data } = await admin
          .from('use_cases')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('score', { ascending: false })
          .limit(500)
        return data ?? []
      })()
    : []

  const totalRoi = useCases.reduce((sum, uc) => sum + (uc.roi_eur_per_year ?? 0), 0)

  return (
    <UseCaseBoardClient
      workspaceId={workspaceId ?? ''}
      initialUseCases={useCases}
      initialTotalRoi={Math.round(totalRoi * 100) / 100}
    />
  )
}

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
    const { data: member } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true })
      .limit(1)
      .single()
    workspaceId = member?.workspace_id
  }

  const [useCases, interviewCount] = workspaceId
    ? await (async () => {
        const admin = getSupabaseAdmin()
        const [{ data: ucs }, { count }] = await Promise.all([
          admin
            .from('use_cases')
            .select('*')
            .eq('workspace_id', workspaceId)
            .order('score', { ascending: false })
            .limit(500),
          admin
            .from('interviews')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId)
            .eq('status', 'completed'),
        ])
        return [ucs ?? [], count ?? 0] as const
      })()
    : [[], 0]

  const totalRoi = useCases.reduce((sum, uc) => sum + (uc.roi_eur_per_year ?? 0), 0)

  return (
    <UseCaseBoardClient
      workspaceId={workspaceId ?? ''}
      initialUseCases={useCases}
      initialTotalRoi={Math.round(totalRoi * 100) / 100}
      interviewCount={interviewCount}
    />
  )
}

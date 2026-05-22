import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { UseCaseCard } from '@/components/UseCaseCard'

export default async function RoadmapPage() {
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

  const admin = getSupabaseAdmin()
  const { data: useCases } = workspaceId
    ? await admin
        .from('use_cases')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('score', { ascending: false })
    : { data: [] }

  const grouped = {
    Q1: (useCases ?? []).filter((uc) => uc.quarter === 'Q1'),
    Q2: (useCases ?? []).filter((uc) => uc.quarter === 'Q2'),
    Q3: (useCases ?? []).filter((uc) => uc.quarter === 'Q3'),
  }

  const roiFor = (list: typeof useCases) =>
    Math.round((list ?? []).reduce((s, uc) => s + (uc.roi_eur_per_year ?? 0), 0))

  const totalRoi = roiFor(useCases ?? [])

  return (
    <div className="max-w-[960px] mx-auto px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard/use-cases" className="text-[12px] text-[#6B7280] hover:text-[#111111]">
            ← Zurück zu Use Cases
          </Link>
          <h1 className="text-[24px] font-semibold text-[#111111] mt-1">Quartals-Roadmap</h1>
          {totalRoi > 0 && (
            <p className="text-[13px] text-[#6B7280] mt-0.5">
              Gesamt-Einsparpotenzial:{' '}
              <span className="font-semibold text-[#111111]">
                €{totalRoi.toLocaleString('de-DE')}/Jahr
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Empty State */}
      {(useCases ?? []).length === 0 && (
        <div className="text-center py-20">
          <p className="text-[14px] text-[#6B7280]">Noch keine Use Cases vorhanden.</p>
          <Link href="/dashboard/use-cases" className="text-[13px] text-[#E040FB] mt-2 inline-block">
            Use Cases generieren →
          </Link>
        </div>
      )}

      {/* 3-Column Roadmap */}
      {(useCases ?? []).length > 0 && (
        <div className="grid grid-cols-3 gap-6">
          {(['Q1', 'Q2', 'Q3'] as const).map((q) => (
            <div key={q}>
              {/* Column Header */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-0.5">
                  <h2 className="text-[15px] font-semibold text-[#111111]">
                    {q === 'Q1' ? '⚡ Q1 — Sofort starten' : q === 'Q2' ? 'Q2 — Nächstes Quartal' : 'Q3 — Langfristig'}
                  </h2>
                </div>
                {grouped[q].length > 0 && (
                  <p className="text-[12px] text-[#6B7280]">
                    €{roiFor(grouped[q]).toLocaleString('de-DE')}/Jahr ·{' '}
                    {grouped[q].length} Use Case{grouped[q].length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Cards */}
              <div className="space-y-3">
                {grouped[q].length === 0 ? (
                  <div className="border border-dashed border-[#E5E5E5] rounded-[6px] py-8 text-center">
                    <p className="text-[12px] text-[#D1D5DB]">Keine Use Cases</p>
                  </div>
                ) : (
                  grouped[q].map((uc) => (
                    <UseCaseCard key={uc.id} useCase={uc} compact />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { UseCaseCard } from './UseCaseCard'
import { UseCaseSheet } from './UseCaseSheet'
import { getCluster, CLUSTER_META, type UseCaseCluster } from '@/services/useCaseEngine'

interface UseCase {
  id: string
  type: string
  title: string
  description: string | null
  reasoning: string | null
  priority: string | null
  effort: string | null
  roi_eur_per_year: number | null
  roi_hours_per_year: number | null
  roi_breakdown: unknown
  score: number | null
  quarter: string | null
  process_step_id: string | null
  cluster_id: string | null
}

interface Props {
  workspaceId: string
  initialUseCases: UseCase[]
  initialTotalRoi: number
  interviewCount?: number
}

export function UseCaseBoardClient({ workspaceId, initialUseCases, initialTotalRoi, interviewCount = 0 }: Props) {
  const [useCases, setUseCases] = useState<UseCase[]>(initialUseCases)
  const [totalRoi, setTotalRoi] = useState(initialTotalRoi)
  const [generating, setGenerating] = useState(false)
  const [selectedUseCase, setSelectedUseCase] = useState<UseCase | null>(null)

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/use-cases/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Generierung fehlgeschlagen')
      }
      const data = await res.json()
      setUseCases(data.use_cases ?? [])
      setTotalRoi(data.total_roi_eur ?? 0)
      toast.success(`${data.use_cases?.length ?? 0} Use Cases generiert`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Generieren')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="max-w-[960px] mx-auto px-8 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-semibold text-[#111111]">KI Use Cases</h1>
          <p className="text-[13px] text-[#6B7280] mt-1">
            {useCases.length > 0
              ? `${useCases.length} Use Cases identifiziert`
              : 'Heuristik-Engine analysiert Prozessschritte'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/use-cases/roadmap"
            className="text-[13px] text-[#6B7280] hover:text-[#111111] transition-colors"
          >
            Quartals-Roadmap →
          </Link>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-[#E040FB] hover:bg-[#AA00FF] text-white text-[13px] rounded-[6px] h-9 px-4"
          >
            {generating ? 'Generiere...' : 'Use Cases generieren'}
          </Button>
        </div>
      </div>

      {/* Total ROI Banner */}
      {totalRoi > 0 && (
        <div className="bg-gradient-to-r from-[#F3E5FF] to-[#FCE4FF] border border-[#E040FB]/20 rounded-[6px] px-5 py-4 mb-6">
          <p className="text-[12px] text-[#9C27B0] font-medium uppercase tracking-wide mb-1">
            Gesamt-Einsparpotenzial
          </p>
          <p className="text-[28px] font-bold text-[#111111]">
            €{Math.round(totalRoi).toLocaleString('de-DE')}
            <span className="text-[16px] font-normal text-[#6B7280] ml-2">/Jahr</span>
          </p>
        </div>
      )}

      {/* Single-interview hint — C1–C3 cluster rules need ≥2 interviews */}
      {interviewCount < 2 && useCases.length > 0 && (
        <p className="text-[12px] text-[#6B7280] mb-5">
          Tipp: Mehr Interviews → stärkere Use Cases. Cluster-Regeln (workspace-weite Automatisierung) greifen ab 2 Mitarbeitern.
        </p>
      )}

      {/* Loading Skeleton */}
      {generating && (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-[6px]" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!generating && useCases.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-[14px] text-[#6B7280]">Noch keine Use Cases vorhanden.</p>
          <p className="text-[12px] text-[#6B7280] mt-1">
            Stelle sicher dass Prozessschritte angereichert sind, dann klicke{' '}
            <span className="font-medium text-[#E040FB]">Use Cases generieren</span>.
          </p>
        </div>
      )}

      {/* Clustered Sections */}
      {!generating && useCases.length > 0 && (() => {
        const grouped = new Map<UseCaseCluster, typeof useCases>()
        for (const uc of useCases) {
          const cluster = getCluster(uc)
          if (!grouped.has(cluster)) grouped.set(cluster, [])
          grouped.get(cluster)!.push(uc)
        }
        const clusterOrder: UseCaseCluster[] = ['no_regret_foundation', 'near_term_mvp', 'strategic_bet']
        return (
          <div className="space-y-10">
            {clusterOrder.map((cluster) => {
              const items = grouped.get(cluster)
              if (!items || items.length === 0) return null
              const meta = CLUSTER_META[cluster]
              return (
                <div key={cluster}>
                  <div className="flex items-baseline gap-3 mb-4">
                    <h2 className="text-[15px] font-semibold text-[#111111]">{meta.label}</h2>
                    <span className="text-[12px] text-[#6B7280]">{meta.description}</span>
                    <span className="ml-auto text-[11px] font-medium text-[#9C27B0] bg-[#F3E5FF] rounded-full px-2 py-0.5">
                      {items.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {items.map((uc) => (
                      <UseCaseCard
                        key={uc.id}
                        useCase={uc}
                        onClick={() => setSelectedUseCase(uc)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Detail Sheet */}
      <UseCaseSheet
        useCase={selectedUseCase}
        onClose={() => setSelectedUseCase(null)}
      />
    </div>
  )
}

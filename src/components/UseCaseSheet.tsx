'use client'

import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { MetricsGrid } from './MetricsGrid'
import { RoiBreakdown } from './RoiBreakdown'
import { ParticipantList } from './ParticipantList'

// ── Types ────────────────────────────────────────────────────────────────────

interface RoiBreakdownData {
  freq: number
  duration: number
  hourly_rate: number
  reduction_rate: number
  participant_count: number
  total_eur: number
}

interface UseCase {
  id: string
  type: string
  title: string
  description: string | null
  reasoning: string | null
  priority: string | null
  effort: string | null
  roi_eur_per_year: number | null
  roi_breakdown: unknown
  quarter: string | null
  cluster_id: string | null
}

interface ProcessStep {
  title: string
  description: string | null
  source_quote: string | null
  frequency: number | null
  duration: number | null
  error_rate_percent: number | null
  rule_based: boolean | null
  data_sources: string[]
}

interface Interview {
  employee_name: string
  employee_role: string | null
  created_at: string
}

interface SubUseCase {
  employee_name: string
  employee_role: string | null
  process_step: {
    title: string
    source_quote: string | null
    frequency: number | null
    duration: number | null
    error_rate_percent: number | null
  }
  roi_eur: number | null
}

interface ClusterDetail {
  canonical_title: string
  canonical_description: string | null
  participant_count: number
  sub_use_cases: SubUseCase[]
}

interface LlmInsights {
  business_case: string
  implementation_approach: string
  next_steps: string[]
  risk_notes: string
  complexity: 'niedrig' | 'mittel' | 'hoch'
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, string> = {
  automation: '⚡',
  llm_extraction: '📄',
  decision_support: '🎯',
  rag: '🔍',
  process_improvement: '🔧',
  tool_consolidation: '🔗',
  automation_candidate: '⚙️',
  automation_at_scale: '⚡',
  process_standardization: '📋',
  knowledge_rag_at_scale: '🔍',
  cross_team_pain_resolution: '🤝',
}

const TYPE_LABELS: Record<string, string> = {
  automation: 'Automatisierung',
  llm_extraction: 'LLM-Extraktion',
  decision_support: 'Entscheidungshilfe',
  rag: 'Wissensassistent',
  process_improvement: 'Prozessverbesserung',
  tool_consolidation: 'Tool-Integration',
  automation_candidate: 'Automatisierungskandidat',
  automation_at_scale: 'Automatisierung (Workspace)',
  process_standardization: 'Prozess-Standardisierung',
  knowledge_rag_at_scale: 'Wissensassistent (Workspace)',
  cross_team_pain_resolution: 'Teamweite Problemlösung',
}

const COMPLEXITY_DOTS: Record<string, { filled: number; label: string }> = {
  niedrig: { filled: 1, label: 'Niedrig' },
  mittel: { filled: 2, label: 'Mittel' },
  hoch: { filled: 3, label: 'Hoch' },
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-2">
      {children}
    </p>
  )
}

function Divider() {
  return <div className="border-t border-[#E5E5E5] my-5" />
}

function ComplexityDots({ complexity }: { complexity: 'niedrig' | 'mittel' | 'hoch' }) {
  const { filled, label } = COMPLEXITY_DOTS[complexity]
  return (
    <span className="flex items-center gap-1.5">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`inline-block w-2.5 h-2.5 rounded-full ${n <= filled ? 'bg-[#E040FB]' : 'bg-[#E5E5E5]'}`}
        />
      ))}
      <span className="text-[12px] text-[#6B7280] ml-0.5">{label}</span>
    </span>
  )
}

function InsightsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
      <Skeleton className="h-3 w-full mt-2" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  useCase: UseCase | null
  onClose: () => void
}

export function UseCaseSheet({ useCase, onClose }: Props) {
  const [detail, setDetail] = useState<{ process_step: ProcessStep | null; interview: Interview | null; cluster: ClusterDetail | null } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [insights, setInsights] = useState<LlmInsights | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState(false)

  useEffect(() => {
    if (!useCase) {
      setDetail(null)
      setInsights(null)
      setInsightsError(false)
      return
    }

    // Fetch detail + insights in parallel
    setDetailLoading(true)
    setInsightsLoading(true)
    setInsights(null)
    setInsightsError(false)

    fetch(`/api/use-cases/${useCase.id}`)
      .then((r) => r.json())
      .then((data) => {
        setDetail({
          process_step: data.process_step ?? null,
          interview: data.interview ?? null,
          cluster: data.cluster ?? null,
        })
      })
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))

    fetch(`/api/use-cases/${useCase.id}/insights`, { method: 'POST' })
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data) => setInsights(data.insights ?? null))
      .catch(() => setInsightsError(true))
      .finally(() => setInsightsLoading(false))
  }, [useCase?.id])

  const isCluster = Boolean(useCase?.cluster_id)
  const icon = TYPE_ICONS[useCase?.type ?? ''] ?? '🤖'
  const typeLabel = TYPE_LABELS[useCase?.type ?? ''] ?? (useCase?.type ?? '')

  return (
    <Sheet open={useCase !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent
        side="right"
        className="w-[520px] sm:max-w-[520px] overflow-y-auto p-0 flex flex-col"
      >
        {useCase && (
          <>
            {/* Header */}
            <SheetHeader className="px-6 pt-6 pb-5 border-b border-[#E5E5E5] shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[13px]">{icon}</span>
                <span className="text-[11px] text-[#6B7280] font-medium uppercase tracking-wide">
                  {typeLabel}
                </span>
                {isCluster && (
                  <span className="text-[10px] font-semibold bg-[#9C27B0] text-white px-1.5 py-0.5 rounded-full ml-1">
                    Cluster
                  </span>
                )}
                {useCase.quarter && (
                  <span className="text-[10px] font-medium bg-[#F3F4F6] text-[#6B7280] px-1.5 py-0.5 rounded-full ml-auto">
                    {useCase.quarter}
                  </span>
                )}
              </div>
              <SheetTitle className="text-[17px] font-semibold text-[#111111] leading-snug text-left">
                {useCase.title}
              </SheetTitle>
              {useCase.roi_eur_per_year != null && (
                <p className="text-[24px] font-bold text-[#111111] mt-1">
                  €{Math.round(useCase.roi_eur_per_year).toLocaleString('de-DE')}
                  <span className="text-[14px] font-normal text-[#6B7280] ml-2">/Jahr</span>
                </p>
              )}
            </SheetHeader>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-0">

              {/* Zusammenfassung — business_case from insights when available, else engine description */}
              {(insights?.business_case || useCase.description) && (
                <>
                  <SectionLabel>Zusammenfassung</SectionLabel>
                  <p className="text-[13px] text-[#111111] leading-relaxed">
                    {insights?.business_case ?? useCase.description}
                  </p>
                  <Divider />
                </>
              )}

              {/* Prozess / Quelle */}
              {detailLoading ? (
                <>
                  <SectionLabel>Prozess / Quelle</SectionLabel>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                  <Divider />
                </>
              ) : detail?.process_step ? (
                <>
                  <SectionLabel>Prozess / Quelle</SectionLabel>
                  <p className="text-[13px] font-medium text-[#111111]">{detail.process_step.title}</p>
                  {detail.interview && (
                    <p className="text-[12px] text-[#6B7280] mt-0.5">
                      {detail.interview.employee_name}
                      {detail.interview.employee_role && ` · ${detail.interview.employee_role}`}
                    </p>
                  )}
                  {detail.process_step.source_quote && (
                    <blockquote className="mt-2 text-[12px] text-[#6B7280] italic border-l-2 border-[#E040FB]/40 pl-3 leading-relaxed">
                      „{detail.process_step.source_quote}"
                    </blockquote>
                  )}
                  <Divider />
                </>
              ) : detail?.cluster ? (
                <>
                  <SectionLabel>Cluster / Quelle</SectionLabel>
                  <p className="text-[13px] font-medium text-[#111111]">{detail.cluster.canonical_title}</p>
                  {detail.cluster.canonical_description && (
                    <p className="text-[12px] text-[#6B7280] mt-1 leading-relaxed line-clamp-3">
                      {detail.cluster.canonical_description}
                    </p>
                  )}
                  <Divider />
                </>
              ) : null}

              {/* Metriken */}
              {(() => {
                const step = detail?.process_step
                if (!step) return null
                if (step.frequency == null && step.duration == null && step.error_rate_percent == null) return null
                return (
                  <>
                    <SectionLabel>Metriken</SectionLabel>
                    <MetricsGrid
                      frequencyPerMonth={step.frequency}
                      durationMinutes={step.duration}
                      errorRatePercent={step.error_rate_percent}
                    />
                    <Divider />
                  </>
                )
              })()}

              {/* ROI-Berechnung */}
              {useCase.roi_breakdown != null && useCase.roi_eur_per_year != null && (
                <>
                  <SectionLabel>ROI-Berechnung</SectionLabel>
                  <RoiBreakdown
                    roiBreakdown={useCase.roi_breakdown as RoiBreakdownData | null}
                    roiPerYear={useCase.roi_eur_per_year}
                  />
                  <Divider />
                </>
              )}

              {/* KI-Analyse */}
              <SectionLabel>KI-Analyse</SectionLabel>
              {insightsLoading && <InsightsSkeleton />}
              {!insightsLoading && insightsError && (
                <p className="text-[12px] text-[#6B7280] italic">KI-Analyse konnte nicht geladen werden.</p>
              )}
              {!insightsLoading && insights && (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-1">Business Case</p>
                    <p className="text-[13px] text-[#111111] leading-relaxed">{insights.business_case}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-1">Empfehlung</p>
                    <p className="text-[13px] text-[#111111] leading-relaxed">{insights.implementation_approach}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Komplexität</p>
                    <ComplexityDots complexity={insights.complexity} />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-2">Nächste Schritte</p>
                    <ul className="space-y-1">
                      {insights.next_steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] text-[#111111]">
                          <span className="text-[#10B981] mt-0.5 shrink-0">✓</span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {insights.risk_notes && (
                    <div className="bg-[#FFF3E0] border border-[#F59E0B]/30 rounded-[6px] px-3 py-2.5">
                      <p className="text-[11px] font-semibold text-[#E65100] uppercase tracking-wide mb-1">⚠ Risiken</p>
                      <p className="text-[12px] text-[#6B7280] leading-relaxed">{insights.risk_notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Teilnehmer (cluster only) */}
              {detail?.cluster && detail.cluster.sub_use_cases.length > 0 && (
                <>
                  <Divider />
                  <ParticipantList
                    subUseCases={detail.cluster.sub_use_cases}
                    participantCount={detail.cluster.participant_count}
                  />
                </>
              )}

              {/* Bottom padding */}
              <div className="h-6" />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

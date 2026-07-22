'use client'

import { useState, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  TooltipProvider,
} from '@/components/ui/tooltip'
import { ChevronDown, ChevronRight, ExternalLink, Loader2, Quote, Users } from 'lucide-react'
import {
  groupStepsByDeptAndCluster,
  computeInterviewStepCounts,
  computeClusterAggregates,
  computeSummaryStats,
  type ProcessStep,
  type SubStep,
} from '@/lib/processStepsAggregation'

interface Props {
  initialSteps: ProcessStep[]
}

export function ProcessStepsTable({ initialSteps }: Props) {
  const [steps] = useState<ProcessStep[]>(initialSteps)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const [sheetGroup, setSheetGroup] = useState<ProcessStep[] | null>(null)

  function toggleSection(dept: string) {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(dept)) next.delete(dept)
      else next.add(dept)
      return next
    })
  }

  function openGroup(groupSteps: ProcessStep[]) {
    setSheetGroup(groupSteps)
  }

  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-[14px] text-[#6B7280]">Kein Interview abgeschlossen.</p>
        <p className="text-[12px] text-[#6B7280] mt-1">
          Schließe ein Interview ab, um Prozessschritte zu generieren.
        </p>
      </div>
    )
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const groupedByDeptCluster = groupStepsByDeptAndCluster(steps)
  const departments = Object.keys(groupedByDeptCluster).sort()

  const { totalSteps, totalDepts, uniqueInterviews, ruleBasedCount, ruleBasedPct } = computeSummaryStats(steps)

  const interviewStepCounts = computeInterviewStepCounts(steps)

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Prozessschritte" value={String(totalSteps)} />
          <StatCard label="Abteilungen" value={String(totalDepts)} />
          <StatCard label="Interviews" value={String(uniqueInterviews)} />
          <StatCard label="Automatisierbar" value={`${ruleBasedPct}%`} sub={`${ruleBasedCount} regelbasiert`} />
        </div>

        {/* Dept + Cluster view */}
        <div className="space-y-3">
          {departments.map((dept) => {
            const clusterMap = groupedByDeptCluster[dept]
            const deptClusterKeys = Object.keys(clusterMap).sort((a, b) => clusterMap[b].length - clusterMap[a].length)
            const deptInterviews = new Set(
              deptClusterKeys.flatMap(k => clusterMap[k].map(s => s.interview_id))
            ).size
            const isOpen = openSections.has(dept)

            return (
              <Collapsible key={dept} open={isOpen} onOpenChange={() => toggleSection(dept)}>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between px-4 py-3 bg-[#F9FAFB] border border-[#E5E5E5] rounded-[6px] hover:bg-[#F3F4F6] transition-colors cursor-pointer">
                    <div className="flex items-center gap-2">
                      {isOpen
                        ? <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                        : <ChevronRight className="w-4 h-4 text-[#6B7280]" />
                      }
                      <span className="text-[14px] font-semibold text-[#111111]">{dept}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[12px] text-[#6B7280]">
                      <span>{deptClusterKeys.length} Prozess{deptClusterKeys.length !== 1 ? 'e' : ''}</span>
                      <span className="text-[#D1D5DB]">·</span>
                      <span>{deptInterviews} Interview{deptInterviews !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-2">
                    {deptClusterKeys.map((clusterKey) => (
                      <DeptClusterCard
                        key={clusterKey}
                        groupSteps={clusterMap[clusterKey]}
                        interviewStepCounts={interviewStepCounts}
                        onOpenGroup={openGroup}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )
          })}
        </div>
      </div>

      {/* Cluster Detail Sheet */}
      <Sheet open={!!sheetGroup} onOpenChange={(open) => { if (!open) setSheetGroup(null) }}>
        <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
          {sheetGroup && (
            <ClusterDetailSheet
              groupSteps={sheetGroup}
            />
          )}
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  )
}

interface DeptClusterCardProps {
  groupSteps: ProcessStep[]
  interviewStepCounts: Record<string, number>
  onOpenGroup: (groupSteps: ProcessStep[]) => void
}

function DeptClusterCard({ groupSteps, interviewStepCounts, onOpenGroup }: DeptClusterCardProps) {
  const representative = groupSteps[0]
  const cluster = representative.process_clusters
  const title = cluster?.canonical_title ?? representative.title
  const isMulti = groupSteps.length > 1

  const {
    mergedFrequency,
    mergedDuration,
    mergedErrorRate,
    mergedMediaBreaks,
    mergedDataSources,
    isRuleBased,
    flowStepCount,
    participantNames,
  } = computeClusterAggregates(groupSteps, interviewStepCounts)

  return (
    <Card className="border-[#E5E5E5] shadow-none bg-white hover:bg-[#FAFAFA] transition-colors">
      <CardContent className="px-4 py-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => onOpenGroup(groupSteps)}
              className="text-[14px] font-medium text-[#111111] leading-snug truncate text-left hover:text-[#E040FB] transition-colors cursor-pointer"
            >
              {title}
            </button>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isRuleBased && (
              <Badge className="text-[11px] px-1.5 py-0.5 bg-[#F3E5FF] text-[#7C3AED] border-0 font-normal hover:bg-[#F3E5FF]">
                Regelbasiert
              </Badge>
            )}
            <Badge
              className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 border-0 font-normal ${isMulti ? 'bg-[#EFF6FF] text-[#2563EB] hover:bg-[#EFF6FF]' : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#F3F4F6]'}`}
            >
              {isMulti && <Users className="w-3 h-3" />}
              {groupSteps.length} Interview{groupSteps.length !== 1 ? 's' : ''}
            </Badge>
            <button
              onClick={() => onOpenGroup(groupSteps)}
              className="text-[#9CA3AF] hover:text-[#E040FB] transition-colors"
              title="Detail anzeigen"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {participantNames.length > 0 && (
          <p className="text-[12px] text-[#6B7280] mb-2">
            {participantNames.join(' · ')}
          </p>
        )}

        <Separator className="my-2 bg-[#F3F4F6]" />

        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1 text-[12px] text-[#374151]">
            <span>📋</span>{flowStepCount} Schritt{flowStepCount !== 1 ? 'e' : ''}
          </span>
          {mergedFrequency != null && (
            <span className="flex items-center gap-1 text-[12px] text-[#374151]">
              <span>📅</span>{mergedFrequency}×/Mo
            </span>
          )}
          {mergedDuration != null && (
            <span className="flex items-center gap-1 text-[12px] text-[#374151]">
              <span>⏱</span>{mergedDuration} Min
            </span>
          )}
          {mergedErrorRate != null && (
            <span className="flex items-center gap-1 text-[12px] text-[#374151]">
              <span>⚠</span>{mergedErrorRate}%
            </span>
          )}
          {mergedMediaBreaks != null && (
            <span className="flex items-center gap-1 text-[12px] text-[#374151]">
              <span>🔗</span>{mergedMediaBreaks} Brüche
            </span>
          )}
          {mergedDataSources.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {mergedDataSources.map((src) => (
                <span
                  key={src}
                  className="inline-block bg-[#F3E5FF] text-[#7C3AED] text-[11px] px-1.5 py-0.5 rounded-[3px]"
                >
                  {src}
                </span>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface ClusterDetailSheetProps {
  groupSteps: ProcessStep[]
}

function ClusterDetailSheet({ groupSteps }: ClusterDetailSheetProps) {
  const representative = groupSteps[0]
  const cluster = representative.process_clusters
  const title = cluster?.canonical_title ?? representative.title
  const dept = representative.interviews?.department

  const clusteringReason = cluster?.canonical_description
    ?? (representative.cluster_id
      ? 'Semantisch ähnliche Prozesse (AI-Clustering)'
      : groupSteps.length === 1
        ? 'Einzelner aufgenommener Schritt'
        : 'Titel-Übereinstimmung')

  const participants = groupSteps.map(s => ({
    step: s,
    name: s.interviews?.employee_name ?? '—',
    role: s.interviews?.employee_role ?? null,
    dept: s.interviews?.department ?? '—',
  }))

  // Substep state — auto-generate on mount if not yet cached
  const [substeps, setSubsteps] = useState<SubStep[] | null>((representative.substeps ?? null) as SubStep[] | null)
  const [substepsLoading, setSubstepsLoading] = useState(false)
  const [substepsError, setSubstepsError] = useState<string | null>(null)

  const generateSubsteps = async () => {
    setSubstepsLoading(true)
    setSubstepsError(null)
    try {
      const res = await fetch(`/api/process-steps/${representative.id}/substeps`, { method: 'POST' })
      if (!res.ok) throw new Error('Generierung fehlgeschlagen')
      const data = await res.json() as { substeps: SubStep[] }
      setSubsteps(data.substeps)
    } catch {
      setSubstepsError('Prozess-Ablauf konnte nicht generiert werden.')
    } finally {
      setSubstepsLoading(false)
    }
  }

  // Auto-trigger on first open if no substeps cached
  const hasTriggered = useRef(false)
  if (!hasTriggered.current && !substeps && !substepsLoading) {
    hasTriggered.current = true
    generateSubsteps()
  }

  return (
    <>
      <SheetHeader className="mb-5">
        <SheetTitle className="text-[18px] font-semibold text-[#111111] leading-snug pr-6">
          {title}
        </SheetTitle>
        {dept && <p className="text-[12px] text-[#6B7280] mt-0.5">{dept}</p>}
      </SheetHeader>

      <div className="space-y-5">
        {/* Warum geclustert */}
        <div>
          <p className="text-[11px] text-[#9CA3AF] font-medium uppercase tracking-wide mb-1.5">Warum zusammengefasst</p>
          <div className="bg-[#F9FAFB] border border-[#E5E5E5] rounded-[6px] px-3 py-2.5">
            <p className="text-[13px] text-[#4B5563]">{clusteringReason}</p>
          </div>
          {representative.description && (
            <p className="text-[12px] text-[#6B7280] mt-2 leading-relaxed">{representative.description}</p>
          )}
        </div>

        {/* Je Mitarbeiter — only if ≥2 participants */}
        {groupSteps.length >= 2 && (
          <MitarbeiterVergleichSection groupSteps={groupSteps} />
        )}

        <Separator className="bg-[#F3F4F6]" />

        {/* Interviews */}
        <div>
          <p className="text-[11px] text-[#9CA3AF] font-medium uppercase tracking-wide mb-2">
            Interviews ({groupSteps.length})
          </p>
          <div className="space-y-1.5">
            {participants.map(({ step, name, role, dept: d }) => (
              <div key={step.id} className="flex items-center gap-2 text-[13px]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E040FB] shrink-0" />
                <span className="text-[#111111] font-medium">{name}</span>
                {role && <span className="text-[#9CA3AF]">· {role}</span>}
                <span className="text-[#9CA3AF]">· {d}</span>
              </div>
            ))}
          </div>
        </div>

        <Separator className="bg-[#F3F4F6]" />

        {/* Metriken */}
        <MetrikenSection step={representative} />

        {representative.source_quote && (
          <>
            <Separator className="bg-[#F3F4F6]" />
            <SourceQuoteSection quote={representative.source_quote} />
          </>
        )}

        <Separator className="bg-[#F3F4F6]" />

        {/* Prozess-Ablauf */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] text-[#9CA3AF] font-medium uppercase tracking-wide">
              Prozess-Ablauf
            </p>
            {substeps && (
              <button
                onClick={generateSubsteps}
                disabled={substepsLoading}
                className="flex items-center gap-1 text-[11px] text-[#9CA3AF] hover:text-[#E040FB] transition-colors disabled:opacity-40"
              >
                {substepsLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                Neu generieren
              </button>
            )}
          </div>

          {substepsLoading && (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-[6px]" />
              <Skeleton className="h-4 w-6 mx-auto rounded" />
              <Skeleton className="h-12 w-full rounded-[6px]" />
              <Skeleton className="h-4 w-6 mx-auto rounded" />
              <Skeleton className="h-16 w-full rounded-[6px]" />
            </div>
          )}

          {!substepsLoading && substepsError && (
            <div className="text-[12px] text-[#EF4444] bg-[#FEF2F2] border border-[#FCA5A5] rounded-[6px] px-3 py-2.5">
              {substepsError}
              <button onClick={generateSubsteps} className="ml-2 underline">Wiederholen</button>
            </div>
          )}

          {!substepsLoading && !substepsError && substeps && substeps.length > 0 && (
            <SubStepFlowView substeps={substeps} />
          )}

          {!substepsLoading && !substepsError && substeps === null && (
            <div className="text-[12px] text-[#6B7280] text-center py-4">
              Kein Ablauf verfügbar.
            </div>
          )}
        </div>

      </div>
    </>
  )
}

// ——— Metriken Section ———

function MetrikenSection({ step }: { step: ProcessStep }) {
  const metrics = [
    step.frequency != null && { label: '📅 Häufigkeit', value: `${step.frequency}×/Mo` },
    step.duration != null && { label: '⏱ Dauer', value: `${step.duration} Min` },
    step.error_rate_percent != null && { label: '⚠ Fehlerrate', value: `${step.error_rate_percent}%` },
    step.media_breaks != null && step.media_breaks > 0 && { label: '🔗 Medienbrüche', value: `${step.media_breaks}` },
  ].filter(Boolean) as { label: string; value: string }[]

  const hasContent = metrics.length > 0 || step.rule_based || step.data_sources.length > 0
  if (!hasContent) return null

  return (
    <div>
      <p className="text-[11px] text-[#9CA3AF] font-medium uppercase tracking-wide mb-2">Metriken</p>
      {metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          {metrics.map(({ label, value }) => (
            <div key={label} className="bg-[#F9FAFB] border border-[#E5E5E5] rounded-[6px] px-3 py-2">
              <p className="text-[10px] text-[#9CA3AF] mb-0.5">{label}</p>
              <p className="text-[13px] font-medium text-[#111111]">{value}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 mt-1">
        {step.rule_based && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F3E8FF] text-[#9333EA]">
            Regelbasiert
          </span>
        )}
        {step.data_sources.map(ds => (
          <span key={ds} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EDE9FE] text-[#7C3AED]">
            {ds}
          </span>
        ))}
      </div>
    </div>
  )
}

// ——— Source Quote Section ———

function SourceQuoteSection({ quote }: { quote: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = quote.length > 180
  const display = isLong && !expanded ? quote.slice(0, 180) + '…' : quote

  return (
    <div>
      <p className="text-[11px] text-[#9CA3AF] font-medium uppercase tracking-wide mb-1.5">Interview-Zitat</p>
      <div className="bg-[#F9FAFB] border border-[#E5E5E5] rounded-[6px] px-3 py-2.5">
        <p className="text-[12px] text-[#4B5563] italic leading-relaxed">&ldquo;{display}&rdquo;</p>
        {isLong && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-[11px] text-[#9CA3AF] hover:text-[#E040FB] mt-1.5 transition-colors"
          >
            {expanded ? 'Weniger' : 'Mehr anzeigen'}
          </button>
        )}
      </div>
    </div>
  )
}

// ——— Je Mitarbeiter Section ———

function MitarbeiterVergleichSection({ groupSteps }: { groupSteps: ProcessStep[] }) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full group">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-[#9CA3AF] font-medium uppercase tracking-wide">
            Je Mitarbeiter ({groupSteps.length})
          </p>
          <ChevronDown className={`w-3.5 h-3.5 text-[#9CA3AF] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-2">
          {groupSteps.map(step => (
            <MitarbeiterCard key={step.id} step={step} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function MitarbeiterCard({ step }: { step: ProcessStep }) {
  const [quoteExpanded, setQuoteExpanded] = useState(false)
  const name = step.interviews?.employee_name ?? '—'
  const role = step.interviews?.employee_role ?? null
  const quote = step.source_quote
  const isLong = (quote?.length ?? 0) > 120
  const displayQuote = quote && isLong && !quoteExpanded ? quote.slice(0, 120) + '…' : quote

  return (
    <div className="bg-[#F9FAFB] border border-[#E5E5E5] rounded-[6px] px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[13px] font-medium text-[#111111]">{name}</span>
        {role && <span className="text-[12px] text-[#9CA3AF]">· {role}</span>}
      </div>

      {step.description && (
        <p className="text-[12px] text-[#4B5563] leading-relaxed mb-2">{step.description}</p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        {step.duration != null && (
          <span className="text-[11px] text-[#6B7280]">⏱ {step.duration} Min</span>
        )}
        {step.frequency != null && (
          <span className="text-[11px] text-[#6B7280]">📅 {step.frequency}×/Mo</span>
        )}
        {step.data_sources.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {step.data_sources.map(ds => (
              <span key={ds} className="inline-block bg-[#EDE9FE] text-[#7C3AED] text-[10px] px-1.5 py-0.5 rounded-[3px]">{ds}</span>
            ))}
          </div>
        )}
      </div>

      {displayQuote && (
        <div className={`border-t border-[#E5E5E5] pt-2 ${step.duration != null || step.frequency != null || step.data_sources.length > 0 ? 'mt-2' : ''}`}>
          <p className="text-[11px] text-[#6B7280] italic leading-relaxed">&ldquo;{displayQuote}&rdquo;</p>
          {isLong && (
            <button
              onClick={() => setQuoteExpanded(e => !e)}
              className="text-[10px] text-[#9CA3AF] hover:text-[#E040FB] mt-1 transition-colors"
            >
              {quoteExpanded ? 'Weniger' : 'Mehr'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ——— SubStep Flow View ———

function SubStepFlowView({ substeps }: { substeps: SubStep[] }) {
  const sorted = [...substeps].sort((a, b) => a.order - b.order)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  function toggleStep(id: string) {
    setSelectedId(prev => prev === id ? null : id)
  }

  return (
    <div className="flex flex-col items-center">
      {sorted.map((step, idx) => {
        const isSelected = selectedId === step.id
        const hasQuote = !!step.source_text
        return (
          <div key={step.id} className="w-full flex flex-col items-center">
            {step.step_type === 'decision' ? (
              <SubStepDecisionNode step={step} selected={isSelected} hasQuote={hasQuote} onToggle={() => toggleStep(step.id)} />
            ) : (
              <SubStepActionNode step={step} selected={isSelected} hasQuote={hasQuote} onToggle={() => toggleStep(step.id)} />
            )}
            {isSelected && step.source_text && (
              <div className="w-full mt-1.5 mb-0.5 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px] px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <Quote className="w-3 h-3 text-[#9CA3AF] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[#4B5563] italic leading-relaxed">&ldquo;{step.source_text}&rdquo;</p>
                </div>
              </div>
            )}
            {idx < sorted.length - 1 && <FlowArrow />}
          </div>
        )
      })}
    </div>
  )
}

function SubStepActionNode({ step, selected, hasQuote, onToggle }: { step: SubStep; selected: boolean; hasQuote: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={hasQuote ? onToggle : undefined}
      className={`w-full border-2 rounded-[6px] px-3 py-2.5 text-left transition-colors ${selected ? 'border-[#E040FB] bg-[#FDF4FF]' : 'border-[#3B82F6] bg-white'} ${hasQuote ? 'cursor-pointer hover:border-[#E040FB] hover:bg-[#FDF4FF]' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-medium text-[#111111] leading-snug">{step.title}</span>
        <div className="flex items-center gap-1 shrink-0">
          {hasQuote && <Quote className={`w-3 h-3 transition-colors ${selected ? 'text-[#E040FB]' : 'text-[#D1D5DB]'}`} />}
          <Badge className="text-[10px] px-1.5 py-0.5 bg-[#EFF6FF] text-[#2563EB] border-0 font-medium hover:bg-[#EFF6FF]">
            Aktion
          </Badge>
        </div>
      </div>
    </button>
  )
}

function SubStepDecisionNode({ step, selected, hasQuote, onToggle }: { step: SubStep; selected: boolean; hasQuote: boolean; onToggle: () => void }) {
  const text = step.condition_text ?? step.title

  return (
    <div className="w-full flex flex-col items-center">
      <button
        onClick={hasQuote ? onToggle : undefined}
        className={`relative flex items-center justify-center ${hasQuote ? 'cursor-pointer' : 'cursor-default'}`}
        style={{ width: '180px', height: '90px' }}
      >
        <div
          className={`absolute border-2 transition-colors ${selected ? 'border-[#E040FB] bg-[#FDF4FF]' : 'border-[#F59E0B] bg-[#FFFBEB]'}`}
          style={{ width: '90px', height: '90px', transform: 'rotate(45deg)', borderRadius: '4px' }}
        />
        <div className="relative z-10 px-4 text-center" style={{ maxWidth: '160px' }}>
          <p className="text-[10px] font-medium text-[#92400E] leading-tight line-clamp-3">{text}</p>
          {hasQuote && <Quote className={`w-2.5 h-2.5 mx-auto mt-1 transition-colors ${selected ? 'text-[#E040FB]' : 'text-[#D1D5DB]'}`} />}
        </div>
      </button>
      {(step.branch_yes || step.branch_no) && (
        <div className="flex gap-6 text-[10px] text-[#6B7280] mt-1">
          {step.branch_yes && <span className="text-[#16A34A]">✓ {step.branch_yes}</span>}
          {step.branch_no && <span className="text-[#DC2626]">✗ {step.branch_no}</span>}
        </div>
      )}
    </div>
  )
}

function FlowArrow() {
  return (
    <div className="flex flex-col items-center my-0.5">
      <div className="w-px h-4 bg-[#D1D5DB]" />
      <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-[#D1D5DB]" />
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="border-[#E5E5E5] shadow-none">
      <CardContent className="px-4 py-3">
        <p className="text-[11px] text-[#6B7280] font-medium uppercase tracking-wide">{label}</p>
        <p className="text-[22px] font-semibold text-[#111111] mt-0.5 leading-none">{value}</p>
        {sub && <p className="text-[11px] text-[#9CA3AF] mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}


export function ProcessStepsTableSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-[6px]" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-11 w-full rounded-[6px]" />
            <Skeleton className="h-20 w-full rounded-[6px]" />
            <Skeleton className="h-20 w-full rounded-[6px]" />
          </div>
        ))}
      </div>
    </div>
  )
}

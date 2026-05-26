'use client'

import { useState, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ChevronDown, ChevronRight, Info, ExternalLink, Users } from 'lucide-react'
import { toast } from 'sonner'

interface ProcessCluster {
  id: string
  canonical_title: string
  canonical_description: string | null
  participant_count: number
  participants: Array<{
    interview_id: string
    employee_name: string
    employee_role: string | null
    process_step_id: string
  }>
}

interface ProcessStep {
  id: string
  interview_id: string
  workspace_id: string
  cluster_id: string | null
  title: string
  description: string | null
  role: string | null
  frequency_per_month: number | null
  duration_minutes: number | null
  data_sources: string[]
  rule_based: boolean
  error_rate_percent: number | null
  media_breaks: number
  source_quote: string | null
  step_type: 'action' | 'decision'
  condition_text: string | null
  created_at: string
  interviews: {
    department: string
    employee_name: string
    employee_role: string | null
    status: string
  } | null
  process_clusters: ProcessCluster | null
}

type EditableNumberField = 'frequency_per_month' | 'duration_minutes' | 'error_rate_percent' | 'media_breaks'

interface Props {
  initialSteps: ProcessStep[]
}

export function ProcessStepsTable({ initialSteps }: Props) {
  const [steps, setSteps] = useState<ProcessStep[]>(initialSteps)
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [draftValue, setDraftValue] = useState<string>('')
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const [sheetGroup, setSheetGroup] = useState<ProcessStep[] | null>(null)
  const [sheetStep, setSheetStep] = useState<ProcessStep | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function patchStep(id: string, data: Partial<ProcessStep>) {
    const res = await fetch(`/api/process-steps/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? 'Update fehlgeschlagen')
    }
    return (await res.json()).process_step as ProcessStep
  }

  function startEdit(id: string, field: string, currentValue: string) {
    setEditingCell({ id, field })
    setDraftValue(currentValue)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  async function commitEdit(step: ProcessStep, field: EditableNumberField | 'data_sources') {
    if (!editingCell) return
    setEditingCell(null)

    let parsedValue: number | null | string[]

    if (field === 'data_sources') {
      parsedValue = draftValue.split(',').map((s) => s.trim()).filter(Boolean)
    } else {
      parsedValue = draftValue === '' ? null : Number(draftValue)
      if (parsedValue !== null && isNaN(parsedValue as number)) return
    }

    setSteps((prev) =>
      prev.map((s) => (s.id === step.id ? { ...s, [field]: parsedValue } : s))
    )

    try {
      const updated = await patchStep(step.id, { [field]: parsedValue })
      setSteps((prev) => prev.map((s) => (s.id === updated.id ? { ...updated, interviews: s.interviews } : s)))
    } catch (err) {
      setSteps((prev) => prev.map((s) => (s.id === step.id ? step : s)))
      toast.error(err instanceof Error ? err.message : 'Update fehlgeschlagen')
    }
  }

  async function toggleRuleBased(step: ProcessStep) {
    const newVal = !step.rule_based
    setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, rule_based: newVal } : s)))
    try {
      const updated = await patchStep(step.id, { rule_based: newVal })
      setSteps((prev) => prev.map((s) => (s.id === updated.id ? { ...updated, interviews: s.interviews } : s)))
    } catch (err) {
      setSteps((prev) => prev.map((s) => (s.id === step.id ? step : s)))
      toast.error(err instanceof Error ? err.message : 'Update fehlgeschlagen')
    }
  }

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

  function openSheet(step: ProcessStep) {
    setSheetStep(step)
  }

  function handleSheetSaved(updated: ProcessStep) {
    setSteps((prev) => prev.map((s) => (s.id === updated.id ? { ...updated, interviews: s.interviews } : s)))
    setSheetGroup((prev) => prev ? prev.map((s) => (s.id === updated.id ? { ...updated, interviews: s.interviews } : s)) : null)
    setSheetStep((prev) => prev ? { ...updated, interviews: prev.interviews } : null)
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

  const groupedByDeptCluster = steps.reduce<Record<string, Record<string, ProcessStep[]>>>((acc, step) => {
    const dept = step.interviews?.department ?? 'Unbekannt'
    const clusterKey = step.cluster_id ?? `solo-${step.id}`
    if (!acc[dept]) acc[dept] = {}
    if (!acc[dept][clusterKey]) acc[dept][clusterKey] = []
    acc[dept][clusterKey].push(step)
    return acc
  }, {})
  const departments = Object.keys(groupedByDeptCluster).sort()

  const totalSteps = steps.length
  const totalDepts = departments.length
  const uniqueInterviews = new Set(steps.map(s => s.interview_id)).size
  const ruleBasedCount = steps.filter(s => s.rule_based).length
  const ruleBasedPct = totalSteps > 0 ? Math.round((ruleBasedCount / totalSteps) * 100) : 0

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
              onEditStep={openSheet}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Step Edit Sheet (nested) */}
      <Sheet open={!!sheetStep} onOpenChange={(open) => { if (!open) setSheetStep(null) }}>
        <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
          {sheetStep && (
            <ProcessStepSheet
              step={sheetStep}
              onSaved={handleSheetSaved}
              patchStep={patchStep}
            />
          )}
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  )
}

interface DeptClusterCardProps {
  groupSteps: ProcessStep[]
  onOpenGroup: (groupSteps: ProcessStep[]) => void
}

function DeptClusterCard({ groupSteps, onOpenGroup }: DeptClusterCardProps) {
  const representative = groupSteps[0]
  const cluster = representative.process_clusters
  const title = cluster?.canonical_title ?? representative.title
  const isMulti = groupSteps.length > 1

  const participantNames = [...new Set(
    groupSteps.map(s => s.interviews?.employee_name).filter((n): n is string => !!n)
  )]

  function avg(arr: (number | null)[]): number | null {
    const vals = arr.filter((v): v is number => v !== null)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  }

  const mergedFrequency = avg(groupSteps.map(s => s.frequency_per_month))
  const mergedDuration = avg(groupSteps.map(s => s.duration_minutes))
  const mergedErrorRate = avg(groupSteps.map(s => s.error_rate_percent))
  const mergedMediaBreaks = avg(groupSteps.map(s => s.media_breaks))
  const mergedDataSources = [...new Set(groupSteps.flatMap(s => s.data_sources))]
  const isRuleBased = groupSteps.filter(s => s.rule_based).length >= groupSteps.length / 2

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
  onEditStep: (step: ProcessStep) => void
}

function ClusterDetailSheet({ groupSteps, onEditStep }: ClusterDetailSheetProps) {
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
        </div>

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

        {/* Prozess-Flow */}
        <div>
          <p className="text-[11px] text-[#9CA3AF] font-medium uppercase tracking-wide mb-3">
            Aufgenommene Schritte
          </p>
          <ProcessFlowView groupSteps={groupSteps} onEditStep={onEditStep} />
        </div>
      </div>
    </>
  )
}

// ——— Process Flow View ———

interface ProcessFlowViewProps {
  groupSteps: ProcessStep[]
  onEditStep: (step: ProcessStep) => void
}

function ProcessFlowView({ groupSteps, onEditStep }: ProcessFlowViewProps) {
  // Group steps by interview participant, sort each group by created_at
  const byParticipant = groupSteps.reduce<Record<string, ProcessStep[]>>((acc, step) => {
    const key = step.interview_id
    if (!acc[key]) acc[key] = []
    acc[key].push(step)
    return acc
  }, {})

  const participantIds = Object.keys(byParticipant)
  const [primaryId] = participantIds
  const primarySteps = [...(byParticipant[primaryId] ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  const otherParticipantIds = participantIds.slice(1)

  const [showOthers, setShowOthers] = useState(false)

  return (
    <div>
      {/* Primary flow */}
      <div className="flex flex-col items-center">
        {primarySteps.map((step, idx) => (
          <div key={step.id} className="w-full flex flex-col items-center">
            {step.step_type === 'decision' ? (
              <DecisionNode step={step} onEdit={onEditStep} />
            ) : (
              <ActionNode step={step} onEdit={onEditStep} />
            )}
            {idx < primarySteps.length - 1 && <FlowArrow />}
          </div>
        ))}
      </div>

      {/* Other participants (cluster) */}
      {otherParticipantIds.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowOthers(v => !v)}
            className="flex items-center gap-1.5 text-[12px] text-[#6B7280] hover:text-[#111111] transition-colors mb-2"
          >
            {showOthers
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />
            }
            Weitere Interviews ({otherParticipantIds.length})
          </button>
          {showOthers && (
            <div className="space-y-4 pl-2 border-l-2 border-[#F3F4F6]">
              {otherParticipantIds.map((pid) => {
                const pSteps = [...(byParticipant[pid] ?? [])].sort(
                  (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                )
                const pName = pSteps[0]?.interviews?.employee_name ?? '—'
                return (
                  <div key={pid}>
                    <p className="text-[11px] text-[#9CA3AF] mb-2">{pName}</p>
                    <div className="flex flex-col items-center">
                      {pSteps.map((step, idx) => (
                        <div key={step.id} className="w-full flex flex-col items-center">
                          {step.step_type === 'decision' ? (
                            <DecisionNode step={step} onEdit={onEditStep} />
                          ) : (
                            <ActionNode step={step} onEdit={onEditStep} />
                          )}
                          {idx < pSteps.length - 1 && <FlowArrow />}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
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

interface NodeProps {
  step: ProcessStep
  onEdit: (step: ProcessStep) => void
}

function ActionNode({ step, onEdit }: NodeProps) {
  const hasMetrics = step.frequency_per_month != null || step.duration_minutes != null ||
    step.error_rate_percent != null || step.media_breaks != null || step.data_sources.length > 0

  return (
    <div className="w-full border-2 border-[#3B82F6] bg-white rounded-[6px] overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <span className="text-[13px] font-medium text-[#111111] leading-snug">{step.title}</span>
          {step.interviews?.employee_name && (
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">
              {step.interviews.employee_name}
              {step.interviews.department ? ` · ${step.interviews.department}` : ''}
            </p>
          )}
        </div>
        <Badge className="text-[10px] px-1.5 py-0.5 bg-[#EFF6FF] text-[#2563EB] border-0 font-medium shrink-0 hover:bg-[#EFF6FF]">
          Aktion
        </Badge>
      </div>

      {/* Metrics + edit */}
      {(hasMetrics || step.source_quote) && (
        <div className="border-t border-[#E5E5E5] px-3 py-2 bg-[#F9FAFB] space-y-1.5">
          {step.source_quote && (
            <p className="text-[11px] text-[#6B7280] italic line-clamp-2">„{step.source_quote}"</p>
          )}
          <div className="flex items-center gap-3 flex-wrap text-[11px] text-[#374151]">
            {step.frequency_per_month != null && <span>📅 {step.frequency_per_month}×/Mo</span>}
            {step.duration_minutes != null && <span>⏱ {step.duration_minutes} Min</span>}
            {step.error_rate_percent != null && <span>⚠ {step.error_rate_percent}%</span>}
            {step.media_breaks != null && step.media_breaks > 0 && <span>🔗 {step.media_breaks}</span>}
            {step.data_sources.map(src => (
              <span key={src} className="bg-[#F3E5FF] text-[#7C3AED] px-1.5 py-0.5 rounded-[3px]">{src}</span>
            ))}
          </div>
          <button
            onClick={() => onEdit(step)}
            className="text-[11px] text-[#E040FB] hover:text-[#AA00FF] font-medium transition-colors"
          >
            Bearbeiten →
          </button>
        </div>
      )}
      {!hasMetrics && !step.source_quote && (
        <div className="border-t border-[#E5E5E5] px-3 py-1.5 bg-[#F9FAFB] flex justify-end">
          <button
            onClick={() => onEdit(step)}
            className="text-[11px] text-[#E040FB] hover:text-[#AA00FF] font-medium transition-colors"
          >
            Bearbeiten →
          </button>
        </div>
      )}
    </div>
  )
}

function DecisionNode({ step, onEdit }: NodeProps) {
  const text = step.condition_text ?? step.title

  return (
    <div className="w-full flex flex-col items-center">
      {/* Diamond shape */}
      <div className="relative flex items-center justify-center" style={{ width: '180px', height: '90px' }}>
        <div
          className="absolute border-2 border-[#F59E0B] bg-[#FFFBEB]"
          style={{
            width: '90px',
            height: '90px',
            transform: 'rotate(45deg)',
            borderRadius: '4px',
          }}
        />
        <div className="relative z-10 px-4 text-center" style={{ maxWidth: '160px' }}>
          <p className="text-[10px] font-medium text-[#92400E] leading-tight line-clamp-3">{text}</p>
        </div>
      </div>
      {/* Edit link below diamond */}
      <button
        onClick={() => onEdit(step)}
        className="mt-1 text-[11px] text-[#E040FB] hover:text-[#AA00FF] font-medium transition-colors"
      >
        Bearbeiten →
      </button>
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

interface StepCardProps {
  step: ProcessStep
  editingCell: { id: string; field: string } | null
  draftValue: string
  inputRef: React.RefObject<HTMLInputElement | null>
  onStartEdit: (id: string, field: string, current: string) => void
  onDraftChange: (val: string) => void
  onCommit: (step: ProcessStep, field: EditableNumberField | 'data_sources') => void
  onCancel: () => void
  onToggleRuleBased: (step: ProcessStep) => void
  onOpenSheet: (step: ProcessStep) => void
}

function StepCard({
  step, editingCell, draftValue, inputRef,
  onStartEdit, onDraftChange, onCommit, onCancel, onToggleRuleBased, onOpenSheet,
}: StepCardProps) {
  return (
    <Card className="border-[#E5E5E5] shadow-none bg-white hover:bg-[#FAFAFA] transition-colors">
      <CardContent className="px-4 py-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => onOpenSheet(step)}
              className="text-[14px] font-medium text-[#111111] leading-snug truncate text-left hover:text-[#E040FB] transition-colors cursor-pointer"
            >
              {step.title}
            </button>
            {step.source_quote && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[280px] text-[12px]">
                  {step.source_quote}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {step.role && (
              <Badge variant="secondary" className="text-[11px] px-1.5 py-0.5 bg-[#F3F4F6] text-[#4B5563] border-0 font-normal">
                {step.role}
              </Badge>
            )}
            {step.rule_based && (
              <Badge className="text-[11px] px-1.5 py-0.5 bg-[#F3E5FF] text-[#7C3AED] border-0 font-normal hover:bg-[#F3E5FF]">
                Regelbasiert
              </Badge>
            )}
            <button
              onClick={() => onOpenSheet(step)}
              className="text-[#9CA3AF] hover:text-[#E040FB] transition-colors"
              title="Detail anzeigen"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Description */}
        {step.description && (
          <p className="text-[12px] text-[#6B7280] line-clamp-2 mb-2 leading-relaxed">
            {step.description}
          </p>
        )}

        <Separator className="my-2 bg-[#F3F4F6]" />

        {/* Metrics + controls */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <MetricChip icon="📅" label="×/Mo" step={step} field="frequency_per_month" value={step.frequency_per_month}
              editingCell={editingCell} draftValue={draftValue} inputRef={inputRef}
              onStartEdit={onStartEdit} onDraftChange={onDraftChange} onCommit={onCommit} onCancel={onCancel} />
            <MetricChip icon="⏱" label=" Min" step={step} field="duration_minutes" value={step.duration_minutes}
              editingCell={editingCell} draftValue={draftValue} inputRef={inputRef}
              onStartEdit={onStartEdit} onDraftChange={onDraftChange} onCommit={onCommit} onCancel={onCancel} />
            <MetricChip icon="⚠" label="%" step={step} field="error_rate_percent" value={step.error_rate_percent}
              editingCell={editingCell} draftValue={draftValue} inputRef={inputRef}
              onStartEdit={onStartEdit} onDraftChange={onDraftChange} onCommit={onCommit} onCancel={onCancel} />
            <MetricChip icon="🔗" label=" Brüche" step={step} field="media_breaks" value={step.media_breaks}
              editingCell={editingCell} draftValue={draftValue} inputRef={inputRef}
              onStartEdit={onStartEdit} onDraftChange={onDraftChange} onCommit={onCommit} onCancel={onCancel} />
            <DataSourcesChip step={step} editingCell={editingCell} draftValue={draftValue} inputRef={inputRef}
              onStartEdit={onStartEdit} onDraftChange={onDraftChange} onCommit={onCommit} onCancel={onCancel} />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {step.interviews?.employee_name && (
              <span className="text-[11px] text-[#9CA3AF]">{step.interviews.employee_name}</span>
            )}
            <Switch
              checked={step.rule_based}
              onCheckedChange={() => onToggleRuleBased(step)}
              className="data-[state=checked]:bg-[#E040FB]"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ——— Detail Sheet ———

interface ProcessStepSheetProps {
  step: ProcessStep
  onSaved: (updated: ProcessStep) => void
  patchStep: (id: string, data: Partial<ProcessStep>) => Promise<ProcessStep>
}

function ProcessStepSheet({ step, onSaved, patchStep }: ProcessStepSheetProps) {
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({
    description: step.description ?? '',
    frequency_per_month: step.frequency_per_month != null ? String(step.frequency_per_month) : '',
    duration_minutes: step.duration_minutes != null ? String(step.duration_minutes) : '',
    error_rate_percent: step.error_rate_percent != null ? String(step.error_rate_percent) : '',
    media_breaks: String(step.media_breaks),
    data_sources: step.data_sources.join(', '),
    rule_based: step.rule_based,
  })

  function parseNum(val: string): number | null {
    if (val.trim() === '') return null
    const n = Number(val)
    return isNaN(n) ? null : n
  }

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await patchStep(step.id, {
        description: draft.description.trim() || null,
        frequency_per_month: parseNum(draft.frequency_per_month),
        duration_minutes: parseNum(draft.duration_minutes),
        error_rate_percent: parseNum(draft.error_rate_percent),
        media_breaks: parseNum(draft.media_breaks) ?? 0,
        data_sources: draft.data_sources.split(',').map(s => s.trim()).filter(Boolean),
        rule_based: draft.rule_based,
      })
      onSaved(updated)
      toast.success('Gespeichert')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SheetHeader className="mb-4">
        <SheetTitle className="text-[18px] font-semibold text-[#111111] leading-snug pr-6">
          {step.title}
        </SheetTitle>
        <div className="flex items-center gap-2 mt-1">
          {step.interviews?.department && (
            <span className="text-[12px] text-[#6B7280]">{step.interviews.department}</span>
          )}
          {step.interviews?.employee_name && (
            <>
              <span className="text-[#D1D5DB]">·</span>
              <span className="text-[12px] text-[#6B7280]">{step.interviews.employee_name}</span>
            </>
          )}
          {step.interviews?.employee_role && (
            <>
              <span className="text-[#D1D5DB]">·</span>
              <span className="text-[12px] text-[#9CA3AF]">{step.interviews.employee_role}</span>
            </>
          )}
        </div>
      </SheetHeader>

      <div className="space-y-5">
        {/* Source quote */}
        {step.source_quote && (
          <div className="bg-[#F9FAFB] border border-[#E5E5E5] rounded-[6px] px-3 py-3">
            <p className="text-[11px] text-[#9CA3AF] font-medium uppercase tracking-wide mb-1">Originalzitat</p>
            <p className="text-[13px] text-[#4B5563] italic leading-relaxed">„{step.source_quote}"</p>
          </div>
        )}

        {/* Description */}
        <div className="space-y-1.5">
          <Label className="text-[13px] text-[#374151] font-medium">Beschreibung</Label>
          <Textarea
            value={draft.description}
            onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
            rows={4}
            className="text-[13px] border-[#E5E5E5] rounded-[4px] resize-none"
            placeholder="Prozessschritt beschreiben…"
          />
        </div>

        <Separator className="bg-[#F3F4F6]" />

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[13px] text-[#374151] font-medium">📅 Häufigkeit/Monat</Label>
            <Input
              type="number" min={0}
              value={draft.frequency_per_month}
              onChange={(e) => setDraft(d => ({ ...d, frequency_per_month: e.target.value }))}
              className="text-[13px] border-[#E5E5E5] rounded-[4px]"
              placeholder="—"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-[#374151] font-medium">⏱ Dauer (Min)</Label>
            <Input
              type="number" min={0}
              value={draft.duration_minutes}
              onChange={(e) => setDraft(d => ({ ...d, duration_minutes: e.target.value }))}
              className="text-[13px] border-[#E5E5E5] rounded-[4px]"
              placeholder="—"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-[#374151] font-medium">⚠ Fehlerrate (%)</Label>
            <Input
              type="number" min={0} max={100}
              value={draft.error_rate_percent}
              onChange={(e) => setDraft(d => ({ ...d, error_rate_percent: e.target.value }))}
              className="text-[13px] border-[#E5E5E5] rounded-[4px]"
              placeholder="—"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-[#374151] font-medium">🔗 Medienbrüche</Label>
            <Input
              type="number" min={0}
              value={draft.media_breaks}
              onChange={(e) => setDraft(d => ({ ...d, media_breaks: e.target.value }))}
              className="text-[13px] border-[#E5E5E5] rounded-[4px]"
              placeholder="0"
            />
          </div>
        </div>

        {/* Data sources */}
        <div className="space-y-1.5">
          <Label className="text-[13px] text-[#374151] font-medium">Datenquellen</Label>
          <Input
            value={draft.data_sources}
            onChange={(e) => setDraft(d => ({ ...d, data_sources: e.target.value }))}
            className="text-[13px] border-[#E5E5E5] rounded-[4px]"
            placeholder="SAP, Excel, CRM…"
          />
          <p className="text-[11px] text-[#9CA3AF]">Kommagetrennt eingeben</p>
        </div>

        {/* Rule based */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-[#374151] font-medium">Regelbasiert</p>
            <p className="text-[11px] text-[#9CA3AF]">Prozess folgt festen Regeln / ist immer gleich</p>
          </div>
          <Switch
            checked={draft.rule_based}
            onCheckedChange={(val) => setDraft(d => ({ ...d, rule_based: val }))}
            className="data-[state=checked]:bg-[#E040FB]"
          />
        </div>

        <Separator className="bg-[#F3F4F6]" />

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#E040FB] hover:bg-[#AA00FF] text-white rounded-[6px] text-[14px]"
        >
          {saving ? 'Speichern…' : 'Speichern'}
        </Button>
      </div>
    </>
  )
}

// ——— Inline editing components ———

interface MetricChipProps {
  icon: string
  label: string
  step: ProcessStep
  field: EditableNumberField
  value: number | null
  editingCell: { id: string; field: string } | null
  draftValue: string
  inputRef: React.RefObject<HTMLInputElement | null>
  onStartEdit: (id: string, field: string, current: string) => void
  onDraftChange: (val: string) => void
  onCommit: (step: ProcessStep, field: EditableNumberField) => void
  onCancel: () => void
}

function MetricChip({
  icon, label, step, field, value, editingCell, draftValue, inputRef,
  onStartEdit, onDraftChange, onCommit, onCancel,
}: MetricChipProps) {
  const isEditing = editingCell?.id === step.id && editingCell.field === field

  return (
    <div
      className="flex items-center gap-1 cursor-pointer group"
      onClick={() => onStartEdit(step.id, field, value != null ? String(value) : '')}
    >
      <span className="text-[12px]">{icon}</span>
      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          min={0}
          max={field === 'error_rate_percent' ? 100 : undefined}
          value={draftValue}
          onChange={(e) => onDraftChange(e.target.value)}
          onBlur={() => onCommit(step, field)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommit(step, field)
            if (e.key === 'Escape') onCancel()
          }}
          className="w-14 border border-[#E040FB] rounded-[4px] px-1.5 py-0.5 text-[12px] outline-none bg-white"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="text-[12px] text-[#374151] group-hover:text-[#111111]">
          {value != null
            ? <>{value}{label}</>
            : <span className="text-[#D1D5DB]">—</span>
          }
        </span>
      )}
    </div>
  )
}

interface DataSourcesChipProps {
  step: ProcessStep
  editingCell: { id: string; field: string } | null
  draftValue: string
  inputRef: React.RefObject<HTMLInputElement | null>
  onStartEdit: (id: string, field: string, current: string) => void
  onDraftChange: (val: string) => void
  onCommit: (step: ProcessStep, field: 'data_sources') => void
  onCancel: () => void
}

function DataSourcesChip({
  step, editingCell, draftValue, inputRef,
  onStartEdit, onDraftChange, onCommit, onCancel,
}: DataSourcesChipProps) {
  const isEditing = editingCell?.id === step.id && editingCell.field === 'data_sources'

  return (
    <div
      className="cursor-pointer"
      onClick={() => onStartEdit(step.id, 'data_sources', step.data_sources.join(', '))}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={draftValue}
          onChange={(e) => onDraftChange(e.target.value)}
          onBlur={() => onCommit(step, 'data_sources')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommit(step, 'data_sources')
            if (e.key === 'Escape') onCancel()
          }}
          className="border border-[#E040FB] rounded-[4px] px-2 py-0.5 text-[12px] outline-none bg-white w-40"
          placeholder="SAP, Excel, ..."
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : step.data_sources.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {step.data_sources.map((src) => (
            <span
              key={src}
              className="inline-block bg-[#F3E5FF] text-[#7C3AED] text-[11px] px-1.5 py-0.5 rounded-[3px]"
            >
              {src}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-[#D1D5DB] text-[11px]">+ Datenquellen</span>
      )}
    </div>
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

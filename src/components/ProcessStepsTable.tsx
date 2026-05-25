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
import { ChevronDown, ChevronRight, Info, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface ProcessStep {
  id: string
  interview_id: string
  workspace_id: string
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
  created_at: string
  interviews: {
    department: string
    employee_name: string
    employee_role: string | null
    status: string
  } | null
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

  function openSheet(step: ProcessStep) {
    setSheetStep(step)
  }

  function handleSheetSaved(updated: ProcessStep) {
    setSteps((prev) => prev.map((s) => (s.id === updated.id ? { ...updated, interviews: s.interviews } : s)))
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

  const grouped = steps.reduce<Record<string, ProcessStep[]>>((acc, step) => {
    const dept = step.interviews?.department ?? 'Unbekannt'
    if (!acc[dept]) acc[dept] = []
    acc[dept].push(step)
    return acc
  }, {})

  const departments = Object.keys(grouped).sort()

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

        {/* Department sections */}
        <div className="space-y-3">
          {departments.map((dept) => {
            const deptSteps = grouped[dept]
            const deptInterviews = new Set(deptSteps.map(s => s.interview_id)).size
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
                      <span>{deptSteps.length} Schritt{deptSteps.length !== 1 ? 'e' : ''}</span>
                      <span className="text-[#D1D5DB]">·</span>
                      <span>{deptInterviews} Interview{deptInterviews !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="mt-2 space-y-2">
                    {deptSteps.map((step) => (
                      <StepCard
                        key={step.id}
                        step={step}
                        editingCell={editingCell}
                        draftValue={draftValue}
                        inputRef={inputRef}
                        onStartEdit={startEdit}
                        onDraftChange={setDraftValue}
                        onCommit={commitEdit}
                        onCancel={() => setEditingCell(null)}
                        onToggleRuleBased={toggleRuleBased}
                        onOpenSheet={openSheet}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )
          })}
        </div>
      </div>

      {/* Detail Sheet */}
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

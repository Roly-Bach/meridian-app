'use client'

import { useState, useRef } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
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
}

type EditableNumberField = 'frequency_per_month' | 'duration_minutes' | 'error_rate_percent' | 'media_breaks'

interface Props {
  initialSteps: ProcessStep[]
}

export function ProcessStepsTable({ initialSteps }: Props) {
  const [steps, setSteps] = useState<ProcessStep[]>(initialSteps)
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [draftValue, setDraftValue] = useState<string>('')
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
      parsedValue = draftValue
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    } else {
      parsedValue = draftValue === '' ? null : Number(draftValue)
      if (parsedValue !== null && isNaN(parsedValue as number)) return
    }

    // Optimistic update
    setSteps((prev) =>
      prev.map((s) => (s.id === step.id ? { ...s, [field]: parsedValue } : s))
    )

    try {
      const updated = await patchStep(step.id, { [field]: parsedValue })
      setSteps((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    } catch (err) {
      // Revert on error
      setSteps((prev) => prev.map((s) => (s.id === step.id ? step : s)))
      toast.error(err instanceof Error ? err.message : 'Update fehlgeschlagen')
    }
  }

  async function toggleRuleBased(step: ProcessStep) {
    const newVal = !step.rule_based
    setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, rule_based: newVal } : s)))
    try {
      const updated = await patchStep(step.id, { rule_based: newVal })
      setSteps((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    } catch (err) {
      setSteps((prev) => prev.map((s) => (s.id === step.id ? step : s)))
      toast.error(err instanceof Error ? err.message : 'Update fehlgeschlagen')
    }
  }

  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-[14px] text-[#6B7280]">
          Kein Interview abgeschlossen.
        </p>
        <p className="text-[12px] text-[#6B7280] mt-1">
          Schließe ein Interview ab, um Prozessschritte zu generieren.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[6px] border border-[#E5E5E5] overflow-hidden bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#F9FAFB] hover:bg-[#F9FAFB]">
            <TableHead className="text-[12px] font-medium text-[#6B7280] w-[200px]">Titel</TableHead>
            <TableHead className="text-[12px] font-medium text-[#6B7280] w-[120px]">Rolle</TableHead>
            <TableHead className="text-[12px] font-medium text-[#6B7280] w-[100px]">Häuf./Mo.</TableHead>
            <TableHead className="text-[12px] font-medium text-[#6B7280] w-[90px]">Dauer (Min)</TableHead>
            <TableHead className="text-[12px] font-medium text-[#6B7280] w-[180px]">Datenquellen</TableHead>
            <TableHead className="text-[12px] font-medium text-[#6B7280] w-[90px]">Regelbasiert</TableHead>
            <TableHead className="text-[12px] font-medium text-[#6B7280] w-[90px]">Fehler %</TableHead>
            <TableHead className="text-[12px] font-medium text-[#6B7280] w-[90px]">Medienbrüche</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {steps.map((step) => (
            <TableRow key={step.id} className="hover:bg-[#FAFAFA]">
              {/* Title — read-only */}
              <TableCell className="text-[13px] font-medium text-[#111111] py-3">
                <div title={step.source_quote ?? undefined}>
                  {step.title}
                  {step.role && (
                    <span className="block text-[11px] text-[#6B7280] font-normal mt-0.5">
                      {step.role}
                    </span>
                  )}
                </div>
              </TableCell>

              {/* Role — read-only (shown in title cell) */}
              <TableCell className="text-[13px] text-[#6B7280] py-3">
                {step.role ?? <span className="text-[#D1D5DB]">—</span>}
              </TableCell>

              {/* frequency_per_month */}
              <EditableNumberCell
                step={step}
                field="frequency_per_month"
                value={step.frequency_per_month}
                editingCell={editingCell}
                draftValue={draftValue}
                inputRef={inputRef}
                onStartEdit={startEdit}
                onDraftChange={setDraftValue}
                onCommit={commitEdit}
                onCancel={() => setEditingCell(null)}
              />

              {/* duration_minutes */}
              <EditableNumberCell
                step={step}
                field="duration_minutes"
                value={step.duration_minutes}
                editingCell={editingCell}
                draftValue={draftValue}
                inputRef={inputRef}
                onStartEdit={startEdit}
                onDraftChange={setDraftValue}
                onCommit={commitEdit}
                onCancel={() => setEditingCell(null)}
              />

              {/* data_sources */}
              <TableCell
                className="text-[13px] text-[#111111] py-3 cursor-pointer"
                onClick={() =>
                  startEdit(step.id, 'data_sources', step.data_sources.join(', '))
                }
              >
                {editingCell?.id === step.id && editingCell.field === 'data_sources' ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={draftValue}
                    onChange={(e) => setDraftValue(e.target.value)}
                    onBlur={() => commitEdit(step, 'data_sources')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit(step, 'data_sources')
                      if (e.key === 'Escape') setEditingCell(null)
                    }}
                    className="w-full border border-[#E040FB] rounded-[4px] px-2 py-0.5 text-[13px] outline-none bg-white"
                    placeholder="SAP, Excel, ..."
                    autoFocus
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
                  <span className="text-[#D1D5DB] text-[12px]">Klicken zum Bearbeiten</span>
                )}
              </TableCell>

              {/* rule_based */}
              <TableCell className="py-3">
                <Switch
                  checked={step.rule_based}
                  onCheckedChange={() => toggleRuleBased(step)}
                  className="data-[state=checked]:bg-[#E040FB]"
                />
              </TableCell>

              {/* error_rate_percent */}
              <EditableNumberCell
                step={step}
                field="error_rate_percent"
                value={step.error_rate_percent}
                editingCell={editingCell}
                draftValue={draftValue}
                inputRef={inputRef}
                onStartEdit={startEdit}
                onDraftChange={setDraftValue}
                onCommit={commitEdit}
                onCancel={() => setEditingCell(null)}
                suffix="%"
              />

              {/* media_breaks */}
              <EditableNumberCell
                step={step}
                field="media_breaks"
                value={step.media_breaks}
                editingCell={editingCell}
                draftValue={draftValue}
                inputRef={inputRef}
                onStartEdit={startEdit}
                onDraftChange={setDraftValue}
                onCommit={commitEdit}
                onCancel={() => setEditingCell(null)}
              />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

interface EditableNumberCellProps {
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
  suffix?: string
}

function EditableNumberCell({
  step, field, value, editingCell, draftValue, inputRef,
  onStartEdit, onDraftChange, onCommit, onCancel, suffix,
}: EditableNumberCellProps) {
  const isEditing = editingCell?.id === step.id && editingCell.field === field

  return (
    <TableCell
      className="text-[13px] text-[#111111] py-3 cursor-pointer"
      onClick={() => onStartEdit(step.id, field, value != null ? String(value) : '')}
    >
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
          className="w-16 border border-[#E040FB] rounded-[4px] px-2 py-0.5 text-[13px] outline-none bg-white"
          autoFocus
        />
      ) : value != null ? (
        <span>{value}{suffix}</span>
      ) : (
        <span className="text-[#D1D5DB] text-[12px]">—</span>
      )}
    </TableCell>
  )
}

export function ProcessStepsTableSkeleton() {
  return (
    <div className="rounded-[6px] border border-[#E5E5E5] overflow-hidden bg-white">
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-[4px]" />
        ))}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Check, Copy, Loader2 } from 'lucide-react'
import type { Interview } from './InterviewRow'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (interview: Interview) => void
}

const DEPARTMENTS = [
  'Einkauf',
  'Vertrieb',
  'Finance',
  'HR',
  'IT',
  'Operations',
  'Marketing',
  'Sonstiges',
]

const EMPTY_FORM = { employee_name: '', employee_role: '', department: '', focus_topics: '', max_duration_minutes: 30 }

export function NewInterviewDialog({ open, onOpenChange, onCreated }: Props) {
  const [step, setStep] = useState<'form' | 'link'>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [interviewLink, setInterviewLink] = useState('')
  const [createdInterview, setCreatedInterview] = useState<Interview | null>(null)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const isValid = form.employee_name.trim() && form.employee_role.trim() && form.department.trim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || loading) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_name: form.employee_name.trim(),
          employee_role: form.employee_role.trim(),
          department: form.department.trim(),
          focus_topics: form.focus_topics.trim() || undefined,
          max_duration_minutes: Number(form.max_duration_minutes),
        }),
      })

      const data = await res.json() as { interview?: Interview; error?: unknown }

      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Fehler beim Erstellen des Interviews'
        )
      }

      if (!data.interview) throw new Error('Ungültige Serverantwort')

      setCreatedInterview(data.interview)
      setInterviewLink(`${window.location.origin}/interview/${data.interview.access_token}`)
      onCreated(data.interview)
      setStep('link')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function handleOpenChange(open: boolean) {
    if (loading) return
    if (!open) {
      setTimeout(() => {
        setStep('form')
        setForm(EMPTY_FORM)
        setError(null)
        setCreatedInterview(null)
        setInterviewLink('')
        setCopied(false)
      }, 200)
    }
    onOpenChange(open)
  }

  const [copyFailed, setCopyFailed] = useState(false)

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(interviewLink)
      setCopied(true)
      setCopyFailed(false)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopyFailed(true)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-white rounded-[6px]">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-semibold text-[#111111]">
            {step === 'form' ? 'Neues Interview anlegen' : 'Interview erstellt'}
          </DialogTitle>
        </DialogHeader>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-[14px] text-[#111111]">
                Name des Mitarbeiters <span className="text-[#E040FB]">*</span>
              </Label>
              <Input
                value={form.employee_name}
                onChange={(e) => setForm((f) => ({ ...f, employee_name: e.target.value }))}
                placeholder="z.B. Hans Becker"
                className="rounded-[4px] text-[14px] border-[#E5E5E5]"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[14px] text-[#111111]">
                Rolle <span className="text-[#E040FB]">*</span>
              </Label>
              <Input
                value={form.employee_role}
                onChange={(e) => setForm((f) => ({ ...f, employee_role: e.target.value }))}
                placeholder="z.B. Produktionsleiter"
                className="rounded-[4px] text-[14px] border-[#E5E5E5]"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[14px] text-[#111111]">
                Abteilung <span className="text-[#E040FB]">*</span>
              </Label>
              <Select
                value={form.department}
                onValueChange={(val) => setForm((f) => ({ ...f, department: val }))}
                disabled={loading}
              >
                <SelectTrigger className="rounded-[4px] text-[14px] border-[#E5E5E5]">
                  <SelectValue placeholder="Abteilung wählen" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[14px] text-[#111111]">Fokusthemen (optional)</Label>
              <Textarea
                value={form.focus_topics}
                onChange={(e) => setForm((f) => ({ ...f, focus_topics: e.target.value }))}
                placeholder="z.B. Angebotserstellung, Kundenreklamationen, Wochenplanung"
                className="rounded-[4px] text-[14px] border-[#E5E5E5] resize-none"
                rows={3}
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[14px] text-[#111111]">Interviewdauer</Label>
              <Select
                value={String(form.max_duration_minutes)}
                onValueChange={(val) => setForm((f) => ({ ...f, max_duration_minutes: Number(val) }))}
                disabled={loading}
              >
                <SelectTrigger className="rounded-[4px] text-[14px] border-[#E5E5E5]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 Minuten (Standard)</SelectItem>
                  <SelectItem value="10">10 Minuten (Test)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-[12px] text-[#EF4444]">{error}</p>}

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={!isValid || loading}
                className="bg-[#E040FB] hover:bg-[#AA00FF] text-white rounded-[6px] text-[14px] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Erstelle…
                  </>
                ) : (
                  'Interview anlegen'
                )}
              </Button>
            </div>
          </form>
        )}

        {step === 'link' && createdInterview && (
          <div className="mt-2 space-y-4">
            <p className="text-[14px] text-[#6B7280]">
              Senden Sie diesen Link per E-Mail oder Messenger an{' '}
              <span className="font-medium text-[#111111]">{createdInterview.employee_name}</span>.
            </p>

            <div className="bg-[#F9F9F9] border border-[#E5E5E5] rounded-[6px] px-3 py-2">
              <p className="text-[12px] text-[#6B7280] font-mono break-all">{interviewLink}</p>
            </div>

            <Button
              onClick={handleCopyLink}
              className="w-full bg-[#E040FB] hover:bg-[#AA00FF] text-white rounded-[6px] text-[14px]"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Kopiert!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Link kopieren
                </>
              )}
            </Button>
            {copyFailed && (
              <p className="text-[12px] text-[#6B7280]">
                Automatisches Kopieren nicht möglich. Bitte den Link oben manuell markieren und kopieren.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

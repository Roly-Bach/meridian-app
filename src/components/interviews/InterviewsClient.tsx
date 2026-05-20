'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { InterviewsTable } from './InterviewsTable'
import { EmptyState } from './EmptyState'
import { NewInterviewDialog } from './NewInterviewDialog'
import type { Interview } from './InterviewRow'

export function InterviewsClient() {
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/interviews')
      .then(async (r) => {
        const data = await r.json() as { interviews?: Interview[]; error?: string }
        if (!r.ok) {
          setListError(data.error ?? 'Fehler beim Laden der Interviews')
          return
        }
        setInterviews(data.interviews ?? [])
      })
      .catch(() => setListError('Interviews konnten nicht geladen werden'))
      .finally(() => setLoading(false))
  }, [])

  function handleCreated(interview: Interview) {
    setInterviews((prev) => [interview, ...prev])
  }

  return (
    <div className="max-w-[960px] mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[24px] font-semibold text-[#111111]">Interviews</h1>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-[#E040FB] hover:bg-[#AA00FF] text-white rounded-[6px] text-[14px]"
        >
          <Plus className="h-4 w-4 mr-2" />
          Neues Interview
        </Button>
      </div>

      {!loading && listError ? (
        <p className="text-[14px] text-[#EF4444] py-4">{listError}</p>
      ) : !loading && interviews.length === 0 ? (
        <EmptyState onNew={() => setDialogOpen(true)} />
      ) : (
        <div className="bg-white rounded-[6px] border border-[#E5E5E5] overflow-hidden">
          <InterviewsTable interviews={interviews} loading={loading} />
        </div>
      )}

      <NewInterviewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
    </div>
  )
}

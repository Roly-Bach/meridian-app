'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function DeleteInterviewButton({
  interviewId,
  employeeName,
  onDeleted,
}: {
  interviewId: string
  employeeName: string
  onDeleted: (id: string) => void
}) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/interviews/${interviewId}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        toast.error(json.error ?? `Fehler ${res.status}`)
        return
      }
      onDeleted(interviewId)
      toast.success('Interview gelöscht')
    } catch {
      toast.error('Interview konnte nicht gelöscht werden.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          className="h-7 px-2 text-[12px] text-[#6B7280] hover:text-[#EF4444]"
        >
          {loading ? (
            <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Löschen…</>
          ) : (
            <><Trash2 className="h-3 w-3 mr-1" />Löschen</>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Interview löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Das Interview von <strong>{employeeName}</strong> wird unwiderruflich gelöscht
            — inklusive aller Gesprächsverläufe, Wissensobjekte, Prozessschritte und
            Use Cases.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-[#EF4444] hover:bg-[#DC2626] text-white"
          >
            Löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

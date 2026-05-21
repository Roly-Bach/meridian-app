'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FileText, Loader2 } from 'lucide-react'

export function DownloadPdfButton({ interviewId, employeeName }: {
  interviewId: string
  employeeName: string
}) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      // Cookies sent automatically for same-origin requests
      const res = await fetch(`/api/interviews/${interviewId}/pdf`)

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        toast.error(json.error ?? `Fehler ${res.status}`)
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `meridian-report-${employeeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('PDF konnte nicht erstellt werden.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDownload}
      disabled={loading}
      className="h-7 px-2 text-[12px] text-[#6B7280] hover:text-[#111111]"
    >
      {loading ? (
        <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Wird erstellt…</>
      ) : (
        <><FileText className="h-3 w-3 mr-1" />PDF erstellen</>
      )}
    </Button>
  )
}

import { InterviewRow, type Interview } from './InterviewRow'
import { Skeleton } from '@/components/ui/skeleton'

const HEADERS = ['Mitarbeiter', 'Rolle', 'Abteilung', 'Status', 'Erstellt', 'Aktionen']

export function InterviewsTable({
  interviews,
  loading,
  onDeleted,
}: {
  interviews: Interview[]
  loading: boolean
  onDeleted: (id: string) => void
}) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[#E5E5E5]">
          {HEADERS.map((h) => (
            <th
              key={h}
              className="px-4 py-3 text-left text-[11px] font-medium text-[#6B7280] uppercase tracking-wider"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <tr key={i} className="border-b border-[#E5E5E5]">
                <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                <td className="px-4 py-3"><Skeleton className="h-7 w-24 rounded" /></td>
              </tr>
            ))
          : interviews.map((interview) => (
              <InterviewRow key={interview.id} interview={interview} onDeleted={onDeleted} />
            ))}
      </tbody>
    </table>
  )
}

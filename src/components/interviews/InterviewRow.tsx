import { StatusBadge } from './StatusBadge'
import { CopyLinkButton } from './CopyLinkButton'

export type Interview = {
  id: string
  employee_name: string
  employee_role: string | null
  department: string
  focus_topics: string | null
  status: 'created' | 'active' | 'completed'
  access_token: string
  token_expires_at: string
  max_duration_minutes: number
  created_at: string
}

export function InterviewRow({ interview }: { interview: Interview }) {
  return (
    <tr className="border-b border-[#E5E5E5] hover:bg-[#F7F7F7] transition-colors">
      <td className="px-4 py-3 text-[14px] text-[#111111] font-medium">
        {interview.employee_name}
      </td>
      <td className="px-4 py-3 text-[14px] text-[#6B7280]">
        {interview.employee_role ?? '—'}
      </td>
      <td className="px-4 py-3 text-[14px] text-[#6B7280]">
        {interview.department}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={interview.status} />
      </td>
      <td className="px-4 py-3 text-[12px] text-[#6B7280]">
        {new Date(interview.created_at).toLocaleDateString('de-DE')}
      </td>
      <td className="px-4 py-3">
        <CopyLinkButton token={interview.access_token} />
      </td>
    </tr>
  )
}

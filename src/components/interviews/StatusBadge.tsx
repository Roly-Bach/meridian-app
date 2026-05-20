type InterviewStatus = 'created' | 'active' | 'completed'

const config: Record<InterviewStatus, { label: string; className: string }> = {
  created: { label: 'Erstellt', className: 'bg-gray-100 text-gray-600' },
  active: { label: 'Aktiv', className: 'bg-blue-100 text-[#3B82F6]' },
  completed: { label: 'Abgeschlossen', className: 'bg-green-100 text-[#10B981]' },
}

export function StatusBadge({ status }: { status: InterviewStatus }) {
  const { label, className } = config[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium ${className}`}>
      {label}
    </span>
  )
}

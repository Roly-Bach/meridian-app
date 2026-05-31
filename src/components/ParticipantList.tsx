interface SubUseCase {
  employee_name: string
  employee_role: string | null
  process_step: {
    title: string
    source_quote: string | null
    frequency_per_month: number | null
    duration_minutes: number | null
    error_rate_percent: number | null
  }
  roi_eur: number | null
}

interface Props {
  subUseCases: SubUseCase[]
  participantCount: number
}

export function ParticipantList({ subUseCases, participantCount }: Props) {
  if (subUseCases.length === 0) return null

  return (
    <div>
      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-3">
        {participantCount} Mitarbeiter · Sub-Use-Cases
      </p>
      <div className="space-y-2">
        {subUseCases.map((sub, i) => (
          <div key={i} className="border border-[#E5E5E5] rounded-[6px] p-3 bg-[#FAFAFA]">
            <div className="flex items-start justify-between mb-1">
              <div>
                <span className="text-[13px] font-medium text-[#111111]">{sub.employee_name}</span>
                {sub.employee_role && (
                  <span className="text-[12px] text-[#6B7280] ml-1.5">· {sub.employee_role}</span>
                )}
              </div>
              {sub.roi_eur != null && (
                <span className="text-[12px] font-semibold text-[#111111] shrink-0 ml-2">
                  {Math.round(sub.roi_eur).toLocaleString('de-DE')}€/Jahr
                </span>
              )}
            </div>
            <p className="text-[12px] text-[#6B7280] mb-1.5">{sub.process_step.title}</p>
            <div className="flex gap-3 text-[11px] text-[#9C27B0]">
              {sub.process_step.frequency_per_month != null && (
                <span>{sub.process_step.frequency_per_month}×/Mon</span>
              )}
              {sub.process_step.duration_minutes != null && (
                <span>{sub.process_step.duration_minutes} Min</span>
              )}
              {sub.process_step.error_rate_percent != null && (
                <span>{sub.process_step.error_rate_percent}% Fehler</span>
              )}
            </div>
            {sub.process_step.source_quote && (
              <blockquote className="mt-2 text-[11px] text-[#6B7280] italic border-l-2 border-[#E040FB]/30 pl-2 line-clamp-2">
                „{sub.process_step.source_quote}"
              </blockquote>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

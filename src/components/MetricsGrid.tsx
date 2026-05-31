interface Props {
  frequencyPerMonth: number | null
  durationMinutes: number | null
  errorRatePercent: number | null
}

export function MetricsGrid({ frequencyPerMonth, durationMinutes, errorRatePercent }: Props) {
  const hasAny = frequencyPerMonth != null || durationMinutes != null || errorRatePercent != null
  if (!hasAny) return null

  return (
    <div className="flex gap-8">
      {frequencyPerMonth != null && (
        <div>
          <p className="text-[11px] text-[#6B7280] uppercase tracking-wide mb-0.5">Häufigkeit</p>
          <p className="text-[16px] font-semibold text-[#111111]">{frequencyPerMonth}×/Mon</p>
        </div>
      )}
      {durationMinutes != null && (
        <div>
          <p className="text-[11px] text-[#6B7280] uppercase tracking-wide mb-0.5">Dauer</p>
          <p className="text-[16px] font-semibold text-[#111111]">{durationMinutes} Min</p>
        </div>
      )}
      {errorRatePercent != null && (
        <div>
          <p className="text-[11px] text-[#6B7280] uppercase tracking-wide mb-0.5">Fehlerrate</p>
          <p className="text-[16px] font-semibold text-[#111111]">{errorRatePercent}%</p>
        </div>
      )}
    </div>
  )
}

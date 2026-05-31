interface RoiBreakdownData {
  freq: number
  duration: number
  hourly_rate: number
  reduction_rate: number
  participant_count: number
  total_eur: number
}

interface Props {
  roiBreakdown: RoiBreakdownData | null
  roiPerYear: number | null
}

export function RoiBreakdown({ roiBreakdown: rb, roiPerYear }: Props) {
  if (!rb || roiPerYear == null) return null

  const reductionPercent = Math.round(rb.reduction_rate * 100)
  const monthlyEur = Math.round(roiPerYear / 12)
  const isCluster = rb.participant_count > 1

  return (
    <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px] p-4">
      <p className="text-[12px] font-mono text-[#6B7280] leading-relaxed">
        {isCluster && (
          <span className="text-[#9C27B0] font-semibold">{rb.participant_count} Mitarbeiter × </span>
        )}
        {rb.freq}×/Mon × {rb.duration} Min × {rb.hourly_rate}€/h × {reductionPercent}%
        {' = '}
        <span className="text-[#111111] font-semibold">{monthlyEur.toLocaleString('de-DE')}€/Mon</span>
      </p>
      <p className="text-[15px] font-bold text-[#E040FB] mt-1.5">
        → {Math.round(roiPerYear).toLocaleString('de-DE')}€/Jahr
      </p>
    </div>
  )
}

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const TYPE_ICONS: Record<string, string> = {
  automation: '⚡',
  llm_extraction: '📄',
  decision_support: '🎯',
  rag: '🔍',
}

const TYPE_LABELS: Record<string, string> = {
  automation: 'Automatisierung',
  llm_extraction: 'LLM-Extraktion',
  decision_support: 'Entscheidungshilfe',
  rag: 'Wissensassistent',
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-[#FCE4FF] text-[#9C27B0] border-[#E040FB]/30',
  medium: 'bg-[#FFF3E0] text-[#E65100] border-[#F59E0B]/30',
  low: 'bg-[#F3F4F6] text-[#6B7280] border-[#E5E5E5]',
}

const EFFORT_COLORS: Record<string, string> = {
  low: 'bg-[#E8F5E9] text-[#2E7D32] border-[#10B981]/30',
  medium: 'bg-[#FFF3E0] text-[#E65100] border-[#F59E0B]/30',
  high: 'bg-[#FFEBEE] text-[#C62828] border-[#EF4444]/30',
}

const EFFORT_LABELS: Record<string, string> = {
  low: 'Geringer Aufwand',
  medium: 'Mittlerer Aufwand',
  high: 'Hoher Aufwand',
}

interface UseCase {
  id: string
  type: string
  title: string
  description: string | null
  reasoning: string | null
  priority: string | null
  effort: string | null
  roi_eur_per_year: number | null
  roi_hours_per_year: number | null
  score: number | null
  quarter: string | null
  process_step_id: string
}

interface Props {
  useCase: UseCase
  compact?: boolean
}

export function UseCaseCard({ useCase: uc, compact = false }: Props) {
  const isQuickWin = uc.priority === 'high' && uc.effort === 'low'
  const icon = TYPE_ICONS[uc.type] ?? '🤖'
  const typeLabel = TYPE_LABELS[uc.type] ?? uc.type

  return (
    <Card className="border border-[#E5E5E5] bg-white hover:border-[#E040FB]/30 hover:shadow-sm transition-all rounded-[6px]">
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        {/* Header: type + quick win */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px]">{icon}</span>
            <span className="text-[11px] text-[#6B7280] font-medium uppercase tracking-wide">
              {typeLabel}
            </span>
          </div>
          {isQuickWin && (
            <span className="text-[10px] font-semibold bg-[#E040FB] text-white px-1.5 py-0.5 rounded-full">
              Quick Win
            </span>
          )}
        </div>

        {/* Title */}
        <p className="text-[13px] font-semibold text-[#111111] leading-snug mb-2">
          {uc.title}
        </p>

        {!compact && uc.reasoning && (
          <p className="text-[12px] text-[#6B7280] leading-relaxed mb-3 line-clamp-2">
            {uc.reasoning}
          </p>
        )}

        {/* ROI */}
        <div className="mb-3">
          <span className="text-[18px] font-bold text-[#111111]">
            €{Math.round(uc.roi_eur_per_year ?? 0).toLocaleString('de-DE')}
          </span>
          <span className="text-[11px] text-[#6B7280] ml-1">/Jahr</span>
          {!compact && uc.roi_hours_per_year != null && (
            <span className="text-[11px] text-[#6B7280] ml-2">
              ({Math.round(uc.roi_hours_per_year)} h/Jahr)
            </span>
          )}
        </div>

        {/* Badges */}
        <div className="flex gap-1.5 flex-wrap">
          {uc.priority && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${PRIORITY_COLORS[uc.priority] ?? ''}`}>
              {uc.priority === 'high' ? 'Hohe Prio' : uc.priority === 'medium' ? 'Mittlere Prio' : 'Niedrige Prio'}
            </span>
          )}
          {uc.effort && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${EFFORT_COLORS[uc.effort] ?? ''}`}>
              {EFFORT_LABELS[uc.effort] ?? uc.effort}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

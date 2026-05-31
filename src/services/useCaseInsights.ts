import { generateObject } from 'ai'
import { z } from 'zod'
import { resolveModel } from '@/lib/llm-provider'

export const InsightsSchema = z.object({
  business_case: z.string(),
  implementation_approach: z.string(),
  next_steps: z.array(z.string()).min(1).max(5),
  risk_notes: z.string(),
  complexity: z.enum(['niedrig', 'mittel', 'hoch']),
})

export type LlmInsights = z.infer<typeof InsightsSchema>

export interface InsightsContext {
  useCase: {
    type: string
    title: string
    reasoning: string
    priority: string
    roi_eur_per_year: number | null
    roi_breakdown: Record<string, unknown> | null
  }
  processStep?: {
    title: string
    description: string | null
    source_quote: string | null
    frequency_per_month: number | null
    duration_minutes: number | null
    error_rate_percent: number | null
    rule_based: boolean | null
  } | null
  interview?: {
    employee_name: string
    employee_role: string | null
  } | null
  cluster?: {
    canonical_title: string
    canonical_description: string | null
    participant_count: number
  } | null
}

export async function generateUseCaseInsights(ctx: InsightsContext): Promise<LlmInsights> {
  const lines: string[] = [
    `Use Case Typ: ${ctx.useCase.type}`,
    `Titel: ${ctx.useCase.title}`,
    `Begründung: ${ctx.useCase.reasoning}`,
    `Priorität: ${ctx.useCase.priority}`,
  ]

  if (ctx.useCase.roi_eur_per_year != null) {
    lines.push(`ROI p.a.: ${ctx.useCase.roi_eur_per_year.toLocaleString('de')}€`)
  }

  if (ctx.useCase.roi_breakdown) {
    const rb = ctx.useCase.roi_breakdown
    if (rb.participant_count && Number(rb.participant_count) > 1) {
      lines.push(`Betroffene Mitarbeiter: ${rb.participant_count}`)
    }
  }

  if (ctx.processStep) {
    lines.push('', '--- Prozessschritt ---')
    lines.push(`Titel: ${ctx.processStep.title}`)
    if (ctx.processStep.description) lines.push(`Beschreibung: ${ctx.processStep.description}`)
    if (ctx.processStep.source_quote) lines.push(`Originalzitat: "${ctx.processStep.source_quote}"`)
    if (ctx.processStep.frequency_per_month != null) lines.push(`Häufigkeit: ${ctx.processStep.frequency_per_month}×/Monat`)
    if (ctx.processStep.duration_minutes != null) lines.push(`Dauer: ${ctx.processStep.duration_minutes} Min`)
    if (ctx.processStep.error_rate_percent != null) lines.push(`Fehlerrate: ${ctx.processStep.error_rate_percent}%`)
  }

  if (ctx.interview) {
    lines.push('', '--- Mitarbeiter ---')
    const role = ctx.interview.employee_role ? ` (${ctx.interview.employee_role})` : ''
    lines.push(`${ctx.interview.employee_name}${role}`)
  }

  if (ctx.cluster) {
    lines.push('', '--- Workspace-Analyse ---')
    lines.push(`${ctx.cluster.participant_count} Mitarbeiter führen diesen Prozess durch`)
    if (ctx.cluster.canonical_description) {
      lines.push(`Cross-Employee-Synthese: ${ctx.cluster.canonical_description}`)
    }
  }

  const prompt = `Du bist ein erfahrener KI-Strategieberater. Analysiere diesen KI Use Case und erstelle eine präzise, überzeugende Einschätzung auf Deutsch.

${lines.filter(l => l !== undefined).join('\n')}

Erstelle:
- business_case: Überzeugender Business Case für den Berater in 3–4 Sätzen. Warum lohnt sich diese Investition?
- implementation_approach: Konkrete Technologie-Empfehlung mit Tool-Namen, Integrationsweg und Begründung (1–2 Sätze).
- next_steps: Genau 3 konkrete, umsetzbare nächste Schritte (kurze Formulierungen, aktiv).
- risk_notes: 1–2 Sätze zu den wichtigsten Risiken und Voraussetzungen für den Erfolg.
- complexity: Implementierungs-Komplexität als ein Wort: niedrig, mittel oder hoch.`

  const { object } = await generateObject({
    model: resolveModel(process.env.ENRICHMENT_MODEL),
    schema: InsightsSchema,
    prompt,
    maxOutputTokens: 900,
  })

  return object
}

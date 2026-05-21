import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type {
  ReportData,
  ReportKnowledgeObject,
  ReportProcessStep,
  ReportUseCase,
} from '@/components/pdf/InterviewReport'

// ─── Model resolver (mirrors interviewAgent.ts) ───────────────────────────────

function resolveModel(modelString: string) {
  const slashIdx = modelString.indexOf('/')
  if (slashIdx === -1) {
    return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(modelString as never)
  }
  const provider = modelString.slice(0, slashIdx)
  const modelId = modelString.slice(slashIdx + 1)
  if (provider === 'anthropic') {
    return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(modelId as never)
  }
  if (provider === 'google') {
    return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })(modelId as never)
  }
  throw new Error(`Unsupported model provider: "${provider}". Set INTERVIEW_MODEL to "anthropic/<model>" or "google/<model>".`)
}

// ─── Executive Summary ────────────────────────────────────────────────────────

async function generateExecutiveSummary(
  interview: { employee_name: string; employee_role: string | null; department: string },
  knowledgeObjects: { type: string; content: Record<string, unknown> }[],
  processSteps: { title: string; description: string | null }[],
): Promise<string> {
  try {
    const modelString = process.env.INTERVIEW_MODEL ?? 'anthropic/claude-opus-4-5'
    const model = resolveModel(modelString)

    const context = [
      `Mitarbeiter: ${interview.employee_name}${interview.employee_role ? `, ${interview.employee_role}` : ''}, Abteilung: ${interview.department}`,
      processSteps.length > 0
        ? `Identifizierte Prozesse: ${processSteps.map(p => p.title).join(', ')}`
        : null,
      knowledgeObjects.filter(k => k.type === 'pain_point').length > 0
        ? `Engpässe: ${knowledgeObjects.filter(k => k.type === 'pain_point').map(k => (k.content as { description?: string }).description ?? '').filter(Boolean).join('; ')}`
        : null,
    ].filter(Boolean).join('\n')

    const { text } = await generateText({
      model,
      system: 'Du bist ein KI-Assistent für Meridian. Schreibe eine präzise deutsche Zusammenfassung eines Mitarbeiter-Interviews zur Prozessdokumentation.',
      prompt: `Schreibe eine Executive Summary (genau 2–4 Sätze, auf Deutsch) für einen Beratungsbericht basierend auf diesen Interview-Erkenntnissen:\n\n${context}\n\nDie Zusammenfassung soll die Rolle des Mitarbeiters, seine Kernaufgaben und die wichtigsten Erkenntnisse kompakt beschreiben.`,
      maxOutputTokens: 300,
    })

    return text.trim()
  } catch (err) {
    console.error('[reportGenerator] Executive summary failed:', err)
    return `${interview.employee_name}${interview.employee_role ? ` (${interview.employee_role})` : ''} aus der Abteilung ${interview.department} wurde im Rahmen eines Meridian-Interviews zu Prozessen und Arbeitsabläufen befragt. Die Erkenntnisse sind in den folgenden Abschnitten dokumentiert.`
  }
}

// ─── Main data loader ─────────────────────────────────────────────────────────

export async function generateReportData(interviewId: string): Promise<ReportData | null> {
  const supabase = getSupabaseAdmin()

  const [interviewResult, processStepsResult, knowledgeObjectsResult] = await Promise.all([
    supabase
      .from('interviews')
      .select('id, workspace_id, employee_name, employee_role, department, created_at')
      .eq('id', interviewId)
      .single(),
    supabase
      .from('process_steps')
      .select('id, title, description, role, frequency_per_month, duration_minutes, data_sources, rule_based, error_rate_percent, media_breaks')
      .eq('interview_id', interviewId)
      .order('created_at', { ascending: true }),
    supabase
      .from('knowledge_objects')
      .select('id, type, content')
      .eq('interview_id', interviewId)
      .in('type', ['pain_point', 'tool']),
  ])

  if (interviewResult.error || !interviewResult.data) {
    console.error('[reportGenerator] Interview load failed:', interviewResult.error?.message)
    return null
  }

  const interview = interviewResult.data
  const processSteps = (processStepsResult.data ?? []) as ReportProcessStep[]
  const knowledgeObjects = (knowledgeObjectsResult.data ?? []) as ReportKnowledgeObject[]

  // Load use cases linked to this interview's process steps
  const psIds = processSteps.map(ps => ps.id)
  const useCases: ReportUseCase[] = psIds.length > 0
    ? ((await supabase
        .from('use_cases')
        .select('id, type, title, description, priority, roi_eur_per_year, score')
        .in('process_step_id', psIds)
        .order('score', { ascending: false })
      ).data ?? []) as ReportUseCase[]
    : []

  const executiveSummary = await generateExecutiveSummary(
    interview,
    knowledgeObjects,
    processSteps,
  )

  return {
    interview: {
      employee_name: interview.employee_name,
      employee_role: interview.employee_role,
      department: interview.department,
      created_at: interview.created_at,
    },
    executiveSummary,
    processSteps,
    painPoints: knowledgeObjects.filter(k => k.type === 'pain_point'),
    tools: knowledgeObjects.filter(k => k.type === 'tool'),
    useCases,
    generatedAt: new Date().toISOString(),
  }
}

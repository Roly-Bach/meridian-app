import { generateObject } from 'ai'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveModel } from '@/lib/llm-provider'
import { generateEmbedding } from './embeddings'
import { normalizeStepEntry, type StepEntry } from './interviewSemantic'
import { buildTraceMetadata, type TraceCtx } from './_telemetry'

// ── Slot coercions (safety net for legacy tracker data or LLM type errors) ──────

const FALSY_STRINGS = new Set(['false', 'nein', 'no', 'none', 'keine', 'niemals', '0', ''])

function coerceRuleBased(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return !FALSY_STRINGS.has(v.toLowerCase().trim())
  return Boolean(v)
}

const MEDIA_BREAKS_TEXT_MAP: [RegExp, number][] = [
  [/nie|niemals|keine|nein|no\b|0/i, 0],
  [/sehr selten|kaum|fast nie|rarely/i, 0],
  [/selten|manchmal|occasionally/i, 1],
  [/gelegentlich|ab und zu|sometimes/i, 2],
  [/häufig|often|regelmäßig/i, 4],
  [/sehr häufig|always|immer/i, 6],
]

function coerceMediaBreaks(v: unknown): number {
  if (typeof v === 'number') return Math.round(v)
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string') {
    const parsed = parseFloat(v)
    if (!isNaN(parsed)) return Math.round(parsed)
    for (const [pattern, count] of MEDIA_BREAKS_TEXT_MAP) {
      if (pattern.test(v)) return count
    }
    console.warn(`[coerceMediaBreaks] Unrecognized text value: "${v}", defaulting to 0`)
    return 0
  }
  return 0
}

interface EnrichedAttribute<T> {
  value: T | null
  evidence_quote: string | null
}

// Guard: only use attribute value if evidence_quote is present and non-empty
export function applyGroundingGuard<T>(attr: EnrichedAttribute<T>): T | null {
  if (!attr || !attr.evidence_quote || attr.evidence_quote.trim() === '') return null
  return attr.value
}

// ── LLM prompt for tracker-based description/quote generation ─────────────────
const TRACKER_DESCRIPTION_PROMPT = `Du bist ein Prozessanalyst für Meridian. Deine Aufgabe: Generiere für jeden Prozessschritt eine kurze Beschreibung und ein belegendes Zitat direkt aus dem Interview-Transkript.

KRITISCHE REGELN:
- source_quote MUSS ein wörtliches Zitat aus dem Mitarbeiter-Input sein — kein Paraphrasieren, kein Erfinden
- description max 2 Sätze, nur aus dem Transkript belegbar — keine Ergänzungen die nicht gesagt wurden
- step_type = "decision" NUR wenn eine explizite Entscheidungsverzweigung beschrieben wird ("wenn X dann Y sonst Z")
- condition_text: Bedingung als Prosatext, nur wenn step_type = "decision"
- Wenn kein passendes Zitat gefunden: source_quote = null
- Gib EXAKT so viele Einträge zurück wie Schritte in der Eingabe angegeben — einen pro step_title, in der gleichen Reihenfolge

Ausgabeformat — nur valides JSON, kein Text davor oder danach:
{
  "steps": [
    {
      "step_title": "...",
      "description": "...",
      "source_quote": "wörtliches Zitat oder null",
      "step_type": "action",
      "condition_text": null
    }
  ]
}`

interface TrackerDescriptionOutput {
  step_title: string
  description: string | null
  source_quote: string | null
  step_type: 'action' | 'decision'
  condition_text: string | null
}


// Creates process_steps from interview_state.step_tracker (authoritative agent source).
// Quantitative slots come directly from step_tracker (no LLM). LLM generates only
// description + source_quote grounded in the transcript.
export async function createProcessStepsFromTracker({
  interviewId,
  workspaceId,
  traceCtx,
}: {
  interviewId: string
  workspaceId: string
  traceCtx?: TraceCtx
}): Promise<void> {
  const supabase = getSupabaseAdmin()

  // ── Idempotency check ────────────────────────────────────────────────────────
  const { count } = await supabase
    .from('process_steps')
    .select('*', { count: 'exact', head: true })
    .eq('interview_id', interviewId)

  if ((count ?? 0) > 0) return

  // ── Load step_tracker ────────────────────────────────────────────────────────
  const { data: stateRow } = await supabase
    .from('interview_state')
    .select('step_tracker')
    .eq('interview_id', interviewId)
    .single()

  const allSteps = ((stateRow?.step_tracker as unknown[]) ?? [])
    .map((raw, i) => normalizeStepEntry(raw, i + 1))
  const steps = allSteps.filter((s) => s.status !== 'exploring')

  if (steps.length === 0) return

  // ── Load transcript ──────────────────────────────────────────────────────────
  const { data: turns } = await supabase
    .from('turns')
    .select('turn_number, user_input, agent_response')
    .eq('interview_id', interviewId)
    .order('turn_number', { ascending: true })

  const transcript = (turns ?? [])
    .map((t) => `Turn ${t.turn_number}:\nMitarbeiter: ${t.user_input}\nAgent: ${t.agent_response}`)
    .join('\n\n')

  const stepsInput = JSON.stringify(
    steps.map((s) => ({
      step_title: s.title,
      role: s.governance?.rolle ?? null,
      friction_points: s.friction_points ?? [],
      pain_point_primary: s.pain_point_primary ?? null,
    }))
  )

  // ── LLM: generate description + source_quote only (Pt9: generateObject+Zod) ──
  const TrackerDescriptionSchema = z.object({
    steps: z.array(z.object({
      step_title: z.string(),
      description: z.string().nullable(),
      source_quote: z.string().nullable(),
      step_type: z.enum(['action', 'decision']),
      condition_text: z.string().nullable(),
    }))
  })

  let descriptions: TrackerDescriptionOutput[] = []
  try {
    const { object } = await generateObject({
      model: resolveModel(process.env.ENRICHMENT_MODEL),
      schema: TrackerDescriptionSchema,
      system: TRACKER_DESCRIPTION_PROMPT,
      prompt: `Vollständiges Transkript:\n${transcript}\n\nProzessschritte (EXAKT ${steps.length} Einträge erwartet):\n${stepsInput}`,
      experimental_telemetry: buildTraceMetadata('processEnrichment.createProcessStepsFromTracker', {
        interviewId,
        model: process.env.ENRICHMENT_MODEL ?? 'google/gemini-3.1-flash-lite',
        environment: 'prod',
        ...traceCtx,
      }),
    })
    descriptions = object.steps
  } catch (err) {
    console.error('[createProcessStepsFromTracker] LLM call failed:', err)
    // Fallback: insert with null description/source_quote — slot values still correct
    descriptions = steps.map((s) => ({
      step_title: s.title,
      description: null,
      source_quote: null,
      step_type: 'action' as const,
      condition_text: null,
    }))
  }

  if (descriptions.length !== steps.length) {
    console.warn(
      `[createProcessStepsFromTracker] description count mismatch: got ${descriptions.length}, expected ${steps.length}. Matching by index.`
    )
  }

  // ── Insert one process_step per tracker entry ────────────────────────────────
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const desc = descriptions[i]

    const title = step.title
    const description = desc?.description ?? null
    // hilfsmittel from slots (normalizeStepEntry maps legacy data_sources here)
    const hilfsmittelVal = step.slots.hilfsmittel?.value
    const dataSources: string[] = Array.isArray(hilfsmittelVal) ? hilfsmittelVal : []
    const embeddingInput = [title, description, dataSources.length > 0 ? dataSources.join(' ') : null]
      .filter(Boolean).join(' ').trim()
    const embedding = await generateEmbedding(embeddingInput, traceCtx)

    // rule_based: read from entscheidungslogik.value (string "rule_based: true/false" format) or coerce
    const entscheidungslogikVal = step.slots.entscheidungslogik?.value ?? null

    const { error } = await supabase.from('process_steps').insert({
      interview_id: interviewId,
      workspace_id: workspaceId,
      title,
      description,
      role: step.governance?.rolle ?? null,
      source_quote: desc?.source_quote ?? null,
      step_type: desc?.step_type === 'decision' ? 'decision' : 'action',
      condition_text: desc?.step_type === 'decision' ? (desc.condition_text ?? null) : null,
      embedding: embedding as number[],
      frequency_per_month: step.potenzial.frequency_per_month?.value != null ? Math.round(step.potenzial.frequency_per_month.value as number) : null,
      duration_minutes: step.potenzial.duration_minutes?.value != null ? Math.round(step.potenzial.duration_minutes.value as number) : null,
      rule_based: coerceRuleBased(entscheidungslogikVal),
      data_sources: dataSources,
      error_rate_percent: step.potenzial.error_rate_percent?.value != null ? Math.round(step.potenzial.error_rate_percent.value as number) : null,
      media_breaks: coerceMediaBreaks(step.potenzial.media_breaks?.value),
      friction_points: step.friction_points ?? [],
      friction_tools: step.friction_tools ?? [],
      walkthrough_steps: step.process_steps ?? [],
    })

    if (error) {
      console.error('[createProcessStepsFromTracker] DB insert failed:', error.message)
    }
  }
}

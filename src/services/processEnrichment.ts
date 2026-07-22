import { generateObject } from 'ai'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveModel } from '@/lib/llm-provider'
import { generateEmbedding } from './embeddings'
import { normalizeStepEntry } from './interviewSemantic'
import { buildTraceMetadata, type TraceCtx } from './_telemetry'
import type { Json } from '@/lib/database.types'

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
      reibungspunkte: s.slots.reibungspunkte?.value ?? [],
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

    // PROJ-45 (ADR-025 D1): schritt_daten carries the full step_tracker entry
    // verbatim — same object shape as interview_state.step_tracker, no
    // translation/coercion layer. The 10 legacy flat columns (role,
    // frequency, duration, data_sources, rule_based,
    // error_rate_percent, media_breaks, friction_points, friction_tools,
    // walkthrough_steps) no longer exist on process_steps.
    const { error } = await supabase.from('process_steps').insert({
      interview_id: interviewId,
      workspace_id: workspaceId,
      title,
      description,
      source_quote: desc?.source_quote ?? null,
      step_type: desc?.step_type === 'decision' ? 'decision' : 'action',
      condition_text: desc?.step_type === 'decision' ? (desc.condition_text ?? null) : null,
      embedding: embedding as number[],
      schritt_daten: step as unknown as Json,
    })

    if (error) {
      console.error('[createProcessStepsFromTracker] DB insert failed:', error.message)
    }
  }
}

/**
 * Pre-Talker Synchronous Quick-Extract (Fix 2 — ADR-015 holistic).
 *
 * Eliminates the 1-turn race condition in the Dual-Loop architecture (ADR-011):
 * the full Analyst runs post-Talker via after(), so Slot updates only reach
 * the Talker on the next turn. Symptom: Talker re-asks values that the user
 * just stated ("Wie viele Rechnungen?" after persona said "100 Rechnungen").
 *
 * This module runs a fast, narrow extraction BEFORE the Talker stream starts.
 * It only operates on the very last user turn and only has tools to fill
 * existing steps — it cannot register new steps (that remains the full
 * Analyst's job to avoid fragmentation).
 *
 * Budget: ≤500 ms wall-clock. Tools restricted to record_slot and
 * update_walkthrough_data.
 */

import { resolveModel } from '@/lib/llm-provider'
import { generateText, stepCountIs } from 'ai'
import { buildTools, type StepEntry } from './interviewAgent'
import { buildTraceMetadata, type TraceCtx } from './_telemetry'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export interface QuickExtractOptions {
  interviewId: string
  workspaceId: string
  userInput: string
  stepTracker: StepEntry[]
  currentTurnNumber: number
  traceCtx?: TraceCtx
}

const QUICK_EXTRACT_SYSTEM_PROMPT = `Du bist ein schneller Slot-Extraktor für ein laufendes Interview.

AUFGABE: Aus dem letzten Mitarbeiter-Statement Werte für BEREITS registrierte Prozessschritte ableiten. Nur wenn explizit genannt — keine Inferenz.

REGELN
- Nur record_slot und update_walkthrough_data nutzen.
- KEINE neuen Schritte registrieren (kein register_step verfügbar).
- Werte nur erfassen wenn Mitarbeiter sie WÖRTLICH genannt hat.
- Spannen ("80 bis 100", "zwei bis drei Tage") → ERFASSEN mit confidence=estimate und qualifier="Spanne: <original>".
  Numerischen Mittelwert als Wert nehmen, z.B. "80 bis 100" → value=90, qualifier="Spanne: 80–100".
  Zeitspannen in Minuten umrechnen: "zwei bis drei Tage" (à 8h) → value=1200, qualifier="Spanne: 2–3 Tage".
  Kein Warten auf Talker-Konkretisierung — Spanne ist valider Schätzwert.
- evidence_span (PFLICHT bei record_slot): kurzer wörtlicher Ausschnitt (5–60 Zeichen) AUS DEM AKTUELLEN STATEMENT, z.B. "100", "5 Minuten", "SAP FI und Excel", "80 bis 100". Nicht paraphrasieren — exakter Substring.
- source_turn = aktuelle Turn-Nummer.
- Mehrere Slots in einem Statement → mehrere record_slot Calls.

NICHT TUN
- Keine Briefings, keine Phasenwechsel, keine Diskussion.
- Keine Aktion wenn Statement keine konkreten Werte enthält.`

/**
 * Returns the fresh step_tracker after extraction, or null if no tool calls were made.
 * Callers should use the returned tracker directly to avoid an extra DB round-trip.
 */
export async function runQuickExtract(opts: QuickExtractOptions): Promise<StepEntry[] | null> {
  // Bail out if no registered steps — nothing to fill.
  if (opts.stepTracker.length === 0) return null
  // Bail out on trivial user inputs.
  if (opts.userInput.trim().length < 20) return null

  const modelString =
    process.env.INTERVIEW_QUICK_EXTRACT_MODEL ??
    process.env.INTERVIEW_MODEL ??
    'google/gemini-3.1-flash-lite'
  const model = resolveModel(modelString)
  const isGoogleModel = modelString.startsWith('google/')

  const knowledgeTools = buildTools(opts.interviewId, opts.workspaceId, opts.userInput, { source: 'quick' })
  // Restrict toolset: only filling tools, no register_step.
  const tools = {
    record_slot: knowledgeTools.record_slot,
    update_walkthrough_data: knowledgeTools.update_walkthrough_data,
  }

  const stepSummary = opts.stepTracker
    .map((s) => `- "${s.title}" [${s.status}]`)
    .join('\n')

  const userMessage = `## Bereits registrierte Schritte\n${stepSummary}\n\n## Letztes Mitarbeiter-Statement (Turn ${opts.currentTurnNumber})\n${opts.userInput}\n\nExtrahiere konkrete Slot-Werte. Nutze source_turn=${opts.currentTurnNumber}.`

  let madeToolCalls = false
  try {
    const result = await generateText({
      model,
      system: QUICK_EXTRACT_SYSTEM_PROMPT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: 'user', content: userMessage }] as any,
      tools,
      stopWhen: stepCountIs(5),
      ...(isGoogleModel && {
        providerOptions: {
          google: { thinkingConfig: { thinkingBudget: 0 } },
        },
      }),
      experimental_telemetry: buildTraceMetadata('interview.quick_extract', {
        interviewId: opts.interviewId,
        model: modelString,
        environment: (opts.traceCtx?.environment ?? 'prod') as 'prod' | 'eval',
        component: 'quick_extract',
        ...opts.traceCtx,
      }),
    })
    madeToolCalls = result.steps.some(s => (s.toolCalls?.length ?? 0) > 0)
  } catch (err) {
    // Quick-extract failures are non-fatal — full Analyst will catch up.
    console.error('[quick_extract] run failed (non-fatal):', err)
    return null
  }

  // Return fresh tracker only when tool calls were made (avoid unnecessary DB read).
  if (!madeToolCalls) return null

  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase
      .from('interview_state')
      .select('step_tracker')
      .eq('interview_id', opts.interviewId)
      .maybeSingle()
    return (data?.step_tracker as StepEntry[] | null) ?? null
  } catch {
    return null
  }
}

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
import { buildTools } from './interviewAgent'
import type { StepEntry } from './interviewSemantic'
import { buildTraceMetadata, type TraceCtx } from './_telemetry'
import type { TurnStore } from './turnStore/port'

export interface QuickExtractOptions {
  interviewId: string
  workspaceId: string
  userInput: string
  stepTracker: StepEntry[]
  currentTurnNumber: number
  /** Title of the step currently being explored/walked through. Restricts writes to prevent cross-step contamination. */
  activeStepTitle?: string | null
  traceCtx?: TraceCtx
  /** TurnStore for the staged slot writes. Defaults to the prod Supabase store. */
  store?: TurnStore
}

const QUICK_EXTRACT_SYSTEM_PROMPT = `Du bist ein schneller Slot-Extraktor für ein laufendes Interview.

AUFGABE: Aus dem letzten Mitarbeiter-Statement Werte für BEREITS registrierte Prozessschritte ableiten. Nur wenn explizit genannt — keine Inferenz.

STEP-ROUTING REGEL (KRITISCH)
- Wenn ein aktiver Schritt angegeben ist: schreibe AUSSCHLIESSLICH in diesen Schritt.
- Abweichung nur wenn das Statement einen anderen registrierten Schritt EXPLIZIT beim Namen nennt (z.B. "Beim Monatsabschluss..."). In diesem Fall NUR Werte für den explizit genannten Schritt schreiben, nicht für den aktiven.
- Spricht das Statement über einen neuen, noch nicht registrierten Prozess → KEINE Slots schreiben. Der Analyst registriert den neuen Schritt.

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

SLOT-GUARD (KRITISCH)
- Slot bereits mit Wert gefüllt (in Schritt-Tracker mit "✓") → KEIN record_slot Aufruf. Nie überschreiben.
- Nur NULL-Slots befüllen.

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

  // PROJ-34/ADR-018: one session per pass; tools stage, commit persists at the end.
  const store = opts.store ?? (await import('./turnStore/supabaseTurnStore')).createSupabaseTurnStore()
  const session = await store.openTurn(opts.interviewId, opts.workspaceId)

  const knowledgeTools = buildTools(session, opts.userInput, { source: 'quick' })
  // Restrict toolset: only filling tools, no register_step.
  const tools = {
    record_slot: knowledgeTools.record_slot,
    update_walkthrough_data: knowledgeTools.update_walkthrough_data,
  }

  const stepSummary = opts.stepTracker
    .map((s) => {
      const filledSlots = Object.entries(s.slots)
        .filter(([, v]) => v !== null)
        .map(([k]) => k)
        .join(', ')
      const nullSlots = Object.entries(s.slots)
        .filter(([, v]) => v === null)
        .map(([k]) => k)
        .join(', ')
      const filledLine = filledSlots ? '\n  Bereits gefüllt (KEIN record_slot): ' + filledSlots : ''
      const nullLine = nullSlots ? '\n  Noch null (schreibbar): ' + nullSlots : ''
      return '- "' + s.title + '" [' + s.status + ']' + filledLine + nullLine
    })
    .join('\n')

  const activeStepLine = opts.activeStepTitle
    ? `\n## Aktiv explorierter Schritt (STEP-ROUTING)\nSchreibe NUR in diesen Schritt: "${opts.activeStepTitle}"\nAusnahme: Statement nennt explizit einen anderen registrierten Schritt beim Namen.\n`
    : ''

  const userMessage = `## Bereits registrierte Schritte\n${stepSummary}\n${activeStepLine}\n## Letztes Mitarbeiter-Statement (Turn ${opts.currentTurnNumber})\n${opts.userInput}\n\nExtrahiere konkrete Slot-Werte. Nutze source_turn=${opts.currentTurnNumber}.`

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

  // Return fresh tracker only when tool calls were made.
  if (!madeToolCalls) return null

  try {
    // Persist the staged writes, then hand back the post-pass snapshot tracker
    // (same end state as the previous DB re-read, without the round-trip).
    await session.commit()
    return session.snapshot().stepTracker
  } catch (err) {
    console.error('[quick_extract] commit failed (non-fatal):', err)
    return null
  }
}

import { resolveModel } from '@/lib/llm-provider'
import { generateText, stepCountIs, tool } from 'ai'
import { z } from 'zod'
import { buildTraceMetadata, type TraceCtx } from './_telemetry'
import {
  buildTools,
  MANDATORY_SLOTS,
  type InterviewContext,
  type TurnMessage,
  type AnalystBriefing,
  type ClarificationCard,
  type StepEntry,
} from './interviewAgent'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// ─── Analyst (Iteration 3) ────────────────────────────────────────────────────
// Runs async via after() in chat/route.ts (Vercel Fluid Compute).
// Responsibilities: knowledge extraction (register_step, record_slot, etc.)
// + produce_briefing for the next Talker turn.
// Does NOT generate user-facing text.

export interface AnalystRunOptions {
  context: InterviewContext
  /** History up to and including the current user turn (WITHOUT Talker's response for this turn) */
  history: TurnMessage[]
  traceCtx?: TraceCtx
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ClarificationCardSchema = z.object({
  process_step_id: z.string().describe('ID of the process step (use step title if ID unknown)'),
  step_title: z.string(),
  question: z.string().describe('Natural language question for the missing slot'),
  options: z.array(z.string()).min(2).max(4).describe('Answer options, last option must be "Andere"'),
  slot_key: z.string().describe('Which slot key this fills, e.g. frequency, duration_minutes'),
})

const AnalystBriefingSchema = z.object({
  next_focus: z.string().describe('Which topic or slot should the next Talker turn prioritize'),
  suggested_question: z.string().describe('A concrete follow-up question for the interviewer to use'),
  wrap_up_question_asked: z.boolean().optional().describe('true if the Talker asked the closing wrap-up question in this turn'),
  clarification_cards: z.array(ClarificationCardSchema).max(8).optional().describe('Only generate when phase=wrap_up and mandatory slots are empty'),
})

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildAnalystSystemPrompt(ctx: InterviewContext): string {
  return `Du bist Interview-Analyst für ein laufendes Mitarbeiter-Interview. Deine Aufgabe: strukturierte Wissens-Extraktion nach jedem Mitarbeiter-Turn.

Sprache des Interviews: Deutsch.

## Deine Aufgaben pro Turn

1. Analysiere den letzten Mitarbeiter-Turn auf extrahierbare Informationen
2. Rufe alle relevanten Wissens-Tools auf
3. Erstelle via produce_briefing eine Handlungsempfehlung für den nächsten Turn

## Tool-Entscheidungsregeln

**register_step**: Wenn der Mitarbeiter einen klar benannten, eigenständigen Prozessschritt beschreibt. Nicht für Varianten oder Ausnahmen eines bestehenden Schritts.

**record_slot**: Für jeden explizit genannten Wert:
- frequency_per_month: Häufigkeitsangaben (umrechnen auf Monat)
- duration_minutes: Zeit pro Durchführung (NICHT wöchentliche/monatliche Gesamtaufwände)
- rule_based: Aussagen zur Regelbasierung ("immer gleich", "variiert", "nach Schema")
- data_sources: Genannte Systeme, Tools, Datenbanken
- evidence_quote muss wörtliches Zitat aus dem Mitarbeiter-Statement sein

**update_walkthrough_data**: Wenn Mitarbeiter Prozessschritte (Signalwörter: "zuerst", "dann", "danach"), Reibungspunkte oder Systeme beschreibt.

**link_bottleneck**: Wenn Pain Point klar an einem registrierten Schritt verortet werden kann.

**update_topics**: Mit aktualisierten covered/open Listen aufrufen.

**produce_briefing**: Als letzten Tool-Call aufrufen. Enthält next_focus, suggested_question und optional wrap_up_question_asked.

## Halluzinations-Guard
Nur extrahieren was der Mitarbeiter explizit gesagt hat. Keine Inferenzen als Fakten setzen.

## Aktueller Kontext
- Interview ID: ${ctx.interviewId}
- Phase: ${ctx.phase}
- Mitarbeiter: ${ctx.employeeName}${ctx.employeeRole ? `, ${ctx.employeeRole}` : ''}
- Abteilung: ${ctx.department}
- Fokusthemen: ${ctx.focusTopics ?? 'keine spezifischen'}
`
}

// ─── Clarification Cards Generation ──────────────────────────────────────────

function shouldGenerateClarificationCards(ctx: InterviewContext): boolean {
  return ctx.phase === 'wrap_up' && computeEmptyMandatorySlots(ctx.stepTracker).length > 0
}

function computeEmptyMandatorySlots(tracker: StepEntry[]): { step: StepEntry; slot: string }[] {
  const empty: { step: StepEntry; slot: string }[] = []
  for (const step of tracker) {
    for (const slot of MANDATORY_SLOTS) {
      if (step.slots[slot] === null) {
        empty.push({ step, slot })
      }
    }
  }
  return empty
}

// ─── Main Analyst Function ────────────────────────────────────────────────────

export async function runAnalyst(opts: AnalystRunOptions): Promise<AnalystBriefing> {
  const modelString =
    process.env.INTERVIEW_ANALYST_MODEL ?? process.env.INTERVIEW_MODEL ?? 'google/gemini-3.5-flash'
  const model = resolveModel(modelString)
  const supabase = getSupabaseAdmin()
  const { interviewId, workspaceId } = opts.context

  const systemPrompt = buildAnalystSystemPrompt(opts.context)

  // Messages: full history as analyst context
  const messages = opts.history.map((t) => ({ role: t.role, content: t.content }))

  // Build tool set: all knowledge tools + produce_briefing
  let capturedBriefing: AnalystBriefing = {
    next_focus: '',
    suggested_question: '',
  }

  const knowledgeTools = buildTools(interviewId, workspaceId)

  const produceBriefingTool = tool({
    description: 'Generates the briefing for the next Talker turn. Call LAST, after all knowledge tools. Called exactly once.',
    inputSchema: AnalystBriefingSchema,
    execute: async (briefing) => {
      capturedBriefing = briefing as AnalystBriefing

      // Only include clarification_cards if conditions are met (guard against unnecessary cards)
      const shouldHaveCards = shouldGenerateClarificationCards(opts.context)
      if (!shouldHaveCards) {
        capturedBriefing = { ...capturedBriefing, clarification_cards: undefined }
      }

      try {
        await supabase
          .from('interviews')
          .update({
            next_briefing: capturedBriefing as unknown as import('@/lib/database.types').Json,
            analyst_status: 'done',
          })
          .eq('id', interviewId)
      } catch (err) {
        console.error('[analyst] produce_briefing DB write failed:', err)
      }

      return { success: true }
    },
  })

  const allTools = {
    ...knowledgeTools,
    produce_briefing: produceBriefingTool,
  }

  const isGoogleModel = modelString.startsWith('google/')

  try {
    await generateText({
      model,
      system: systemPrompt,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: messages as any,
      tools: allTools,
      stopWhen: stepCountIs(15),
      ...(isGoogleModel && {
        providerOptions: {
          google: { thinkingConfig: { thinkingBudget: 2048 } },
        },
      }),
      experimental_telemetry: buildTraceMetadata('interview.analyst', {
        interviewId,
        model: modelString,
        environment: (opts.traceCtx?.environment ?? 'prod') as 'prod' | 'eval',
        component: 'analyst',
        ...opts.traceCtx,
      }),
    })
  } catch (err) {
    // Analyst error: set status='failed' so next turn triggers catch-up run
    console.error('[analyst] run failed:', err)
    await supabase
      .from('interviews')
      .update({ analyst_status: 'failed' })
      .eq('id', interviewId)
    throw err
  }

  return capturedBriefing
}

/** Catch-up run: processes two turns at once when previous analyst run failed */
export async function runAnalystCatchup(opts: AnalystRunOptions & { previousUserInput: string }): Promise<AnalystBriefing> {
  const augmentedHistory: TurnMessage[] = [
    { role: 'user', content: opts.previousUserInput },
    ...opts.history,
  ]
  return runAnalyst({ ...opts, history: augmentedHistory })
}

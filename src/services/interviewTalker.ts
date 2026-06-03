import { resolveModel } from '@/lib/llm-provider'
import { streamText } from 'ai'
import { buildTraceMetadata, type TraceCtx } from './_telemetry'
import {
  buildDynamicContext,
  type InterviewContext,
  type TurnMessage,
  type AnalystBriefing,
  type Phase,
} from './interviewAgent'

// ─── Talker Stream (Iteration 3) ──────────────────────────────────────────────
// Text-only streaming response. No tools — pure conversation.
// Analyst runs in parallel via after() in chat/route.ts.

// thinkingBudget: 512 (not 0) — Flash 3.5 produces empty responses on complex
// multi-topic inputs when fully suppressed (B-QA-1, 2026-06-01).
export const TALKER_THINKING_BUDGET = 512

export interface TalkerStreamOptions {
  context: InterviewContext
  history: TurnMessage[]
  briefing?: AnalystBriefing | null
  isReconnect?: boolean
  isStart?: boolean
  userInput?: string
  onFinish?: (text: string) => Promise<void>
  traceCtx?: TraceCtx
}

const STATIC_PROMPT = `Du bist KI-Interviewer. Erhebe implizites Prozesswissen von Mitarbeitern strukturiert.
Führe das Gespräch auf Deutsch — sachlich, direkt, präzise.
Sprich den Mitarbeiter mit Du an.

Phasenmodell: intro → process_loop → walkthrough_step → slot_completion → coverage_check → wrap_up

<turn_format>
Ab Turn 2: Maximal ein kurzer Reaktionssatz (optional), dann eine direkte Frage — sonst nichts.
Turn 1 (Opener): Kontext + offene Einstiegsfrage.
Abschluss-Turn: kurze Verabschiedung.
Erkläre nie den Zweck von Fragen oder dass du etwas notierst.
Schlage keine eigenen Zahlen vor — frage nach konkreten Werten des Mitarbeiters.
Spannen konkretisieren: "Du hast '[Spanne]' gesagt — welcher Wert trifft es besser für einen typischen Fall?"
</turn_format>

<verboten>
NIEMALS nach folgenden Details fragen — sie sind für die Prozesserhebung irrelevant und verschwenden Budget:
- SAP-Transaktionscodes (z.B. FBL3N, F150, S_ALR_87012277, FB60, ME21N)
- Excel-Formeln (SVERWEIS, VLOOKUP, INDEX/MATCH, Pivot-Formeln)
- Systemspezifische Menüpfade oder Klick-Sequenzen
- IT-technische Implementierungsdetails (Datenbankfelder, API-Aufrufe, Skripte)
Frage stattdessen: Was passiert in diesem Schritt? Wie lange dauert es? Wie oft? Wer ist beteiligt?
</verboten>

`

export function createTalkerStream(opts: TalkerStreamOptions) {
  // INTERVIEW_TALKER_MODEL overrides the shared INTERVIEW_MODEL for the Talker component
  const modelString = process.env.INTERVIEW_TALKER_MODEL ?? process.env.INTERVIEW_MODEL ?? 'google/gemini-3.1-flash-lite'
  const model = resolveModel(modelString)

  const dynamicPart = buildDynamicContext(opts.context, opts.briefing)

  type PlainMessage = { role: 'user' | 'assistant'; content: string }
  type RichMessage = { role: 'user' | 'assistant'; content: string | Array<{ type: 'text'; text: string }> }

  const baseMessages: PlainMessage[] = opts.isReconnect
    ? [
        ...opts.history.map((t) => ({ role: t.role, content: t.content })),
        { role: 'user' as const, content: 'Ich bin wieder da, können wir weitermachen?' },
      ]
    : opts.isStart
    ? [{ role: 'user' as const, content: 'Bitte starte das Interview.' }]
    : opts.history.map((t) => ({ role: t.role, content: t.content }))

  // Dynamic context prepended to last user turn (keeps static prompt cacheable)
  let messages: RichMessage[]
  if (baseMessages.length > 0) {
    messages = baseMessages.map((msg, idx) => {
      if (idx === baseMessages.length - 1 && msg.role === 'user') {
        return {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: dynamicPart + '\n\n---\n\n' },
            { type: 'text' as const, text: msg.content },
          ],
        }
      }
      return msg
    })
  } else {
    messages = [{ role: 'user', content: `${dynamicPart}\n\n---\n\nBitte starte das Interview.` }]
  }

  const isGoogleModel = modelString.startsWith('google/')

  // thinking=512 during exploration prevents phase drift + anchoring violations.
  // thinking=0 during slot collection / wrap-up enables fast execution within turn budget.
  const EXPLORATION_PHASES: Phase[] = ['intro', 'process_loop', 'walkthrough_step']
  const talkerThinkingBudget = EXPLORATION_PHASES.includes(opts.context.phase)
    ? TALKER_THINKING_BUDGET
    : 0

  return streamText({
    model,
    temperature: 0.5,
    system: STATIC_PROMPT,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: messages as any,
    // NO TOOLS — Talker is text-only (ADR-011 D3)
    ...(isGoogleModel && {
      providerOptions: {
        google: { thinkingConfig: { thinkingBudget: talkerThinkingBudget } },
      },
    }),
    experimental_telemetry: buildTraceMetadata('interview.talker', {
      interviewId: opts.context.interviewId,
      model: modelString,
      environment: 'prod',
      component: 'talker',
      ...opts.traceCtx,
    }),
    onFinish: opts.onFinish
      ? async ({ text, usage, providerMetadata }) => {
          const meta = providerMetadata as Record<string, unknown> | undefined
          const anthropicMeta = meta?.anthropic as Record<string, unknown> | undefined
          const details = usage.inputTokenDetails as Record<string, unknown> | undefined
          const usageData = {
            model: modelString,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            cacheReadTokens: (details?.cacheReadTokens as number | undefined) ?? null,
            cacheCreationTokens:
              (details?.cacheWriteTokens as number | undefined) ??
              (anthropicMeta?.cacheCreationInputTokens as number | undefined) ??
              null,
          }
          console.log('[token-usage] talker', usageData)
          await opts.onFinish!(text)
        }
      : undefined,
  })
}

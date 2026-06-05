import { resolveModel } from '@/lib/llm-provider'
import { streamText } from 'ai'
import { buildTraceMetadata, type TraceCtx } from './_telemetry'
import {
  buildDynamicContext,
  detectNumberAnchoring,
  detectFillerPhrases,
  type InterviewContext,
  type TurnMessage,
  type AnalystBriefing,
} from './interviewAgent'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

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
Spannen NICHT mehr konkretisieren wenn Wert bereits erfasst ist (✓ im Tracker). Nur bei echtem null.
Ausweichen: Wenn Mitarbeiter keine konkrete Zahl nennen kann ("schwer zu sagen", "variiert stark"):
→ Einmal nachfragen: "Welcher Wert wäre eine grobe Schätzung?"
→ Wenn dann immer noch keine Zahl: Slot akzeptieren und weitergehn. KEIN drittes Mal fragen.
→ Keinen eigenen Durchschnitt vorschlagen. Fehlende Werte werden am Interviewende als Folgefragen erfasst.
</turn_format>

<verboten>
NIEMALS nach folgenden Details fragen — sie sind für die Prozesserhebung irrelevant und verschwenden Budget:
- SAP-Transaktionscodes (z.B. FBL3N, F150, S_ALR_87012277, FB60, ME21N)
- Excel-Formeln (SVERWEIS, VLOOKUP, INDEX/MATCH, Pivot-Formeln)
- Systemspezifische Menüpfade oder Klick-Sequenzen
- IT-technische Implementierungsdetails (Datenbankfelder, API-Aufrufe, Skripte)
Frage stattdessen: Was passiert in diesem Schritt? Wie lange dauert es? Wie oft? Wer ist beteiligt?
</verboten>

<no_repeat>
HARTE REGEL: Werte unter "Bereits erfasst" oder mit ✓ im Schritt-Tracker / READ_ONLY_STATE dürfen NICHT erneut erfragt werden.
Wenn du auf einen bekannten Wert eingehen willst, beziehe dich darauf statt nachzufragen ("Du hast vorhin ~100 Rechnungen/Monat genannt — ...").
Vor jeder Frage prüfen: Steht der Wert schon im Tracker? Wenn ja → andere Frage stellen oder Phase abschließen.
</no_repeat>

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

  // Fixed thinkingBudget across all phases. Adaptive thinkingBudget=0 in
  // execution phases caused dialog_naturalness regression (eval 2026-06-03):
  // Flash 3.5 lost coherence on already-known facts and re-asked questions.
  // See ADR-014 review (Naturalness 0.78 → 0.42).
  return streamText({
    model,
    temperature: 0.5,
    system: STATIC_PROMPT,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: messages as any,
    // NO TOOLS — Talker is text-only (ADR-011 D3)
    ...(isGoogleModel && {
      providerOptions: {
        google: { thinkingConfig: { thinkingBudget: TALKER_THINKING_BUDGET } },
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

          // Pt7: Anchoring detection — log violations for eval analysis.
          // No re-prompt (streaming architecture); prevention is via prompt injection in buildDynamicContext.
          const suggestedQ = opts.briefing?.suggested_question ?? ''
          if (suggestedQ) {
            const anchored = detectNumberAnchoring(text, suggestedQ)
            if (anchored.length > 0) {
              console.warn('[talker:anchoring] number re-quote detected', {
                numbers: anchored,
                interviewId: opts.context.interviewId,
              })
            }
          }

          // Pt13: Filler phrase tracking — persist detected opening phrases into
          // interviews.next_briefing.usedFillerPhrases (existing JSONB, no schema change).
          const fillers = detectFillerPhrases(text)
          if (fillers.length > 0) {
            try {
              const supabase = getSupabaseAdmin()
              const { data: interview } = await supabase
                .from('interviews')
                .select('next_briefing')
                .eq('id', opts.context.interviewId)
                .maybeSingle()
              const currentBriefing = (interview?.next_briefing as Record<string, unknown> | null) ?? {}
              const existing = (currentBriefing['usedFillerPhrases'] as string[] | undefined) ?? []
              // Cap at 20 total; dedup; newest last
              const merged = [...new Set([...existing, ...fillers])].slice(-20)
              await supabase
                .from('interviews')
                .update({
                  next_briefing: { ...currentBriefing, usedFillerPhrases: merged } as unknown as import('@/lib/database.types').Json,
                })
                .eq('id', opts.context.interviewId)
            } catch (err) {
              console.error('[talker:filler-tracking] failed (non-fatal):', err)
            }
          }

          await opts.onFinish!(text)
        }
      : undefined,
  })
}

import { resolveModel } from '@/lib/llm-provider'
import { streamText } from 'ai'
import { buildTraceMetadata, type TraceCtx } from './_telemetry'
import { buildDynamicContext, STATIC_PROMPT } from './talkerPrompt'
import { extractNumericTokens } from './conversationSignals'
import type { InterviewContext, TurnMessage, AnalystBriefing } from './interviewTypes'
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

// ─── Output Guards (PROJ-35 / ADR-017) ────────────────────────────────────────
// Post-hoc detectors on the *generated* Talker text — they live next to their
// only caller (onFinish below). Behaviour unchanged from interviewAgent.

/**
 * Pt7: Detect whether a Talker response re-quotes numeric values from the briefing.
 * Returns matched numbers if anchoring is found, empty array otherwise.
 * Used in onFinish for observability logging.
 */
export function detectNumberAnchoring(talkerText: string, suggestedQuestion: string): string[] {
  const numbers = extractNumericTokens(suggestedQuestion)
  if (numbers.length === 0) return []
  // Only flag if the number appears inside a question (ends with ?)
  const sentences = talkerText.split(/[.!]\s+/)
  const questionSentences = sentences.filter(s => s.includes('?'))
  return numbers.filter(n => questionSentences.some(q => {
    const re = new RegExp(`\\b${n.replace('.', '\\.')}\\b`)
    return re.test(q)
  }))
}

/**
 * Pt13: Detect formulaic acknowledgment phrases in Talker output.
 * Extracts the opening clause of each sentence that matches known filler patterns.
 * Stored in interview_state and injected back as an avoidance list each turn.
 */
const FILLER_PATTERNS = [
  /^Das ist (ein|eine|einer|eines|kein|keine|sehr|ein sehr)\b/i,
  /^Das klingt\b/i,
  /^Das klingt nach\b/i,
  /^Das ist ein wichtiger\b/i,
  /^Das ist interessant\b/i,
  /^Das macht\b/i,
  /^Das sind\b/i,
  /^Das war\b/i,
  /^Vielen Dank\b/i,
  /^Danke\b/i,
  /^Ich danke\b/i,
  /^Gut[,.]?\s/i,
  /^Gut zu wissen\b/i,
  /^Schön[,.]?\s/i,
  /^Sehr gut\b/i,
  /^Interessant\b/i,
  /^Verstanden[,.]?\s/i,
  /^Verstehe\b/i,
  /^Alles klar\b/i,
  /^Das ist ein klassischer\b/i,
  /^Das ist ein klarer\b/i,
]

// F1c: question-template fillers — repetitive estimation prompts that tank
// naturalness when used >2× in a run. Scanned across the FULL text (not just
// opener) and tracked alongside opener fillers so the avoidance list catches
// both kinds.
const QUESTION_TEMPLATE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /welcher wert wäre (eine|deine)? ?grobe schätzung/i, label: 'Welcher Wert wäre eine grobe Schätzung' },
  { pattern: /kannst du.*grobe schätzung/i, label: 'Kannst du eine grobe Schätzung geben' },
  { pattern: /wie viel(e)? .*im durchschnitt/i, label: 'Wie viel im Durchschnitt' },
  { pattern: /wie viel(e)? .*pro (rechnung|vorgang|beleg|fall)/i, label: 'Wie viel pro Vorgang' },
  // F1d: acceptance-phrase templates — track so the avoidance list rotates them.
  { pattern: /notiere ich als variabel/i, label: 'Notiere ich als variabel' },
  { pattern: /notiere ich mit \d/i, label: 'Notiere ich mit Zahl' },
  { pattern: /halten wir das offen/i, label: 'halten wir das offen' },
  { pattern: /halten wir .* fest/i, label: 'halten wir das fest' },
  { pattern: /das nehme ich so auf/i, label: 'Das nehme ich so auf' },
  { pattern: /das halten wir so fest/i, label: 'Das halten wir so fest' },
  { pattern: /gehen wir weiter zu/i, label: 'gehen wir weiter zu' },
  { pattern: /nächster punkt/i, label: 'Nächster Punkt' },
]

export function detectFillerPhrases(text: string): string[] {
  const matched: string[] = []
  // Opener fillers — first sentence only
  const firstSentence = text.split(/[.!?]\s+/)[0]?.trim() ?? ''
  for (const pattern of FILLER_PATTERNS) {
    if (pattern.test(firstSentence)) {
      matched.push(firstSentence.slice(0, 50))
      break
    }
  }
  // F1c: Question-template fillers — full-text scan
  for (const { pattern, label } of QUESTION_TEMPLATE_PATTERNS) {
    if (pattern.test(text)) {
      matched.push(label)
    }
  }
  return matched
}

export function createTalkerStream(opts: TalkerStreamOptions) {
  // INTERVIEW_TALKER_MODEL overrides the shared INTERVIEW_MODEL for the Talker component
  const modelString = process.env.INTERVIEW_TALKER_MODEL ?? process.env.INTERVIEW_MODEL ?? 'google/gemini-3.1-flash-lite'
  const model = resolveModel(modelString)

  // F1: feed last assistant turns into context for drill-stop detection.
  // F1b: also feed last user turn for refuse-detect.
  // E3.4: feed last user turns for laddering streak detection.
  const recentAssistantTurns = opts.history
    .filter((t) => t.role === 'assistant')
    .slice(-4)
    .map((t) => t.content)
  const lastUserTurn = [...opts.history].reverse().find((t) => t.role === 'user')?.content
  const recentUserTurns = opts.history
    .filter((t) => t.role === 'user')
    .slice(-4)
    .map((t) => t.content)
  const dynamicPart = buildDynamicContext(
    { ...opts.context, recentAssistantTurns, lastUserTurn, recentUserTurns },
    opts.briefing,
  )

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

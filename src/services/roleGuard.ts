import { generateText } from 'ai'
import { resolveModel } from '@/lib/llm-provider'
import { buildTraceMetadata, type TraceCtx, type OnTokenUsage } from './_telemetry'
import { resolveGuardJudgeModel, assertGuardFamilyDiffersFromTalker } from './talkerGroundingGuard'
import type { TurnMessage } from './interviewTypes'

/**
 * PROJ-42 (KI-24) — hybrid role guard: stops the Interviewer from answering
 * off-topic questions the interviewee asks back (Tim turns 15-17: VW-Golf
 * price, flight prices, both answered by the agent instead of redirected).
 *
 * Two-stage, same shape as talkerGroundingGuard.ts: a free deterministic
 * prefilter catches the small minority of turns that could even BE a question
 * (most turns are statements — no cost/latency overhead for the normal case),
 * then a judge call (cross-vendor, never the talker's own model family)
 * classifies exactly two classes: interview-relevant meta-clarification (b)
 * vs. fachfremde Wissensfrage/off-topic (c). Class (c) gets a fixed,
 * deterministic redirect — no Talker call needed, nothing to generate.
 */

const QUESTION_START_RE =
  /^(wie|was|warum|weshalb|wieso|wann|wo|wer|welche[rsn]?|kannst du|könntest du|weißt du|kann ich|darf ich|sag( mal)? mir|erzähl( mal)? mir)\b/i

/**
 * Deterministic prefilter — no LLM call. Fires on a trailing '?' OR a
 * question-word/request opener AT THE START of the (trimmed) turn. Embedded
 * question words mid-statement do NOT trigger ("ich weiß nicht wie oft das
 * auftritt" — no '?', starts with "ich" → no trigger).
 */
export function prefilterQuestionSignal(userInput: string): boolean {
  const trimmed = userInput.trim()
  if (trimmed.length === 0) return false
  if (trimmed.includes('?')) return true
  return QUESTION_START_RE.test(trimmed)
}

export type RoleGuardClass = 'meta' | 'off_topic'

export interface RoleGuardResult {
  /** True iff the prefilter fired and a judge call was made. */
  checked: boolean
  classification?: RoleGuardClass
}

const ROLE_GUARD_SYSTEM = `Du klassifizierst eine Mitarbeiter-Äußerung aus einem laufenden Prozesswissen-Interview, die eine Frage oder Bitte enthält.

Klassen:
- "meta": eine Rückfrage zum Interview selbst, zur zuletzt gestellten Interviewer-Frage, oder eine Bitte um Wiederholung/Klärung. Beispiele: "Wie meinst du das?", "Und die wäre?", "Kannst du das wiederholen?", "Was möchtest du dazu wissen?".
- "off_topic": eine fachfremde Wissensfrage oder eine Gegenfrage an den Interviewer außerhalb des Interview-Themas — z.B. Produktpreise, private Themen, allgemeines Weltwissen, "Darf ich dir auch eine Frage stellen?" gefolgt von einem fachfremden Thema.

Im Zweifel: wenn die Äußerung erkennbar NICHTS mit dem laufenden Prozessgespräch oder der zuletzt gestellten Interviewer-Frage zu tun hat, klassifiziere als "off_topic".

Antworte AUSSCHLIESSLICH mit JSON, kein Markdown, kein Fließtext: {"class": "meta" | "off_topic"}`

function parseGuardClass(text: string): RoleGuardClass {
  const match = text.match(/"class"\s*:\s*"(meta|off_topic)"/)
  if (match) return match[1] as RoleGuardClass
  console.warn('[roleGuard] unexpected judge format, fail-safe passthrough (class=meta)')
  return 'meta'
}

/**
 * Runs the prefilter, and — only if it fires — the judge classification.
 * Fail-safe on judge failure (network blip, rate limit): one retry, then
 * classify as 'meta' (passthrough) with a loud console.error — mirrors the
 * talkerGroundingGuard retry pattern (KI-18 sixth fix) so a judge outage never
 * silently blocks a turn nor silently over-redirects.
 */
export async function checkRoleGuard(
  userInput: string,
  history: TurnMessage[],
  talkerModelString: string,
  traceCtx?: TraceCtx,
  onTokenUsage?: OnTokenUsage,
): Promise<RoleGuardResult> {
  if (!prefilterQuestionSignal(userInput)) return { checked: false }

  const judgeModel = resolveGuardJudgeModel(talkerModelString)
  assertGuardFamilyDiffersFromTalker(judgeModel, talkerModelString)

  const lastAssistantTurn = [...history].reverse().find((t) => t.role === 'assistant')?.content ?? ''
  const prompt = lastAssistantTurn
    ? `Letzte Interviewer-Frage: "${lastAssistantTurn}"\n\nMitarbeiter-Äußerung: "${userInput}"`
    : `Mitarbeiter-Äußerung: "${userInput}"`

  const retries = 1
  const delayMs = 300
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const model = resolveModel(judgeModel)
      const result = await generateText({
        model,
        system: ROLE_GUARD_SYSTEM,
        prompt,
        maxOutputTokens: 30,
        temperature: 0,
        experimental_telemetry: buildTraceMetadata('roleGuard.judge', {
          model: judgeModel,
          component: 'role_guard',
          ...traceCtx,
        }),
      })
      onTokenUsage?.({
        component: 'role_guard',
        model: judgeModel,
        inputTokens: result.usage?.inputTokens ?? 0,
        cacheReadTokens: (result.usage?.inputTokenDetails as Record<string, unknown> | undefined)?.cacheReadTokens as number | undefined,
        outputTokens: result.usage?.outputTokens ?? 0,
      })
      return { checked: true, classification: parseGuardClass(result.text) }
    } catch (err) {
      lastErr = err
      if (attempt < retries) await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)))
    }
  }
  console.error(`[roleGuard] judge call failed after ${retries + 1} attempts, fail-safe passthrough (class=meta):`, lastErr)
  return { checked: true, classification: 'meta' }
}

import { generateText } from 'ai'
import { resolveModel } from '@/lib/llm-provider'
import { buildTraceMetadata, type TraceCtx } from '@/services/_telemetry'
import { getJudgeModel } from './dialogNaturalness'
import type { TurnRecord } from './types'

/**
 * KI-9 — Talker-Faktentreue gegen History.
 *
 * hallucination_rate (PROJ-28) only checks whether *stored slot quotes* exist
 * in the transcript. It is blind to a different failure mode: the Talker
 * asserting a false premise about what the persona said earlier in plain
 * conversation ("Du hast vorhin 1200 Minuten erwähnt"), even though that
 * value never appears in any prior user turn. talkerPrompt.ts explicitly
 * forbids this (line 43) — this scorer checks whether the Talker actually
 * follows that rule, not whether the rule exists.
 *
 * Single judge call over the full transcript (not sampled — grounding needs
 * the complete prior-turn context, unlike dialogNaturalness which only needs
 * a style sample). Reuses the cross-vendor judge-model pairing from
 * dialogNaturalness to avoid self-serving bias.
 */
const JUDGE_SYSTEM = `Du prüfst ein Interview-Transkript (Agent fragt, Mitarbeiter antwortet) auf falsche Prämissen.

Suche im Agent-Text nach Referenzen auf frühere Mitarbeiter-Aussagen, z.B. "Du hast vorhin X erwähnt", "Du sagtest X", "Wie du beschrieben hast, X", "Du hast von X gesprochen". Prüfe für jede solche Referenz, ob X (wörtlich oder sinngemäß, auch Umrechnungen wie Tage→Minuten zählen als ungedeckt wenn sie einem ANDEREN Sachverhalt zugeordnet werden) tatsächlich in einem VORHERIGEN Mitarbeiter-Turn steht.

Eine Verletzung liegt vor, wenn der Agent dem Mitarbeiter eine Aussage zuschreibt, die er so nicht gemacht hat — auch wenn der referenzierte Wert an anderer Stelle im Transkript zu einem anderen Sachverhalt vorkommt.

WICHTIG: Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, kein Markdown, kein Fließtext.
Format: {"violations": [{"turn": <Turn-Nummer des Agent-Texts>, "claim": "<die falsche Zuschreibung>", "reason": "<kurz, warum ungedeckt>"}]}
Keine Verletzungen gefunden: {"violations": []}`

export interface TalkerFactualGroundingResult {
  violations: number
  rationale: string
}

// Extracts the first balanced JSON object from text, skipping any trailing content
// that would cause the greedy /\{[\s\S]*\}/ regex to grab too much (e.g. when the
// judge adds an explanation after the JSON object that itself contains braces).
function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

export function parseGroundingResponse(text: string): TalkerFactualGroundingResult {
  const jsonStr = extractFirstJsonObject(text)
  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr) as { violations?: Array<{ turn?: number; claim?: string; reason?: string }> }
      const violations = Array.isArray(parsed.violations) ? parsed.violations : []
      const rationale = violations
        .map((v) => `Turn ${v.turn ?? '?'}: "${v.claim ?? ''}" — ${v.reason ?? ''}`)
        .join('\n')
      return { violations: violations.length, rationale }
    } catch {
      // fall through
    }
  }
  console.warn('[talkerFactualGrounding] unexpected judge format, fallback 0')
  console.debug('[talkerFactualGrounding] judge response was:', text.slice(0, 300))
  return { violations: 0, rationale: '' }
}

export async function scoreTalkerFactualGrounding(
  turns: TurnRecord[],
  evalModel: string,
  traceCtx?: TraceCtx,
): Promise<TalkerFactualGroundingResult> {
  // Turn 1 has no prior history to violate — nothing to check.
  if (turns.length < 2) return { violations: 0, rationale: '' }

  // Causal order within a turn is Mitarbeiter (the input) then Agent (the reply reacting
  // to it, posing the next question) — matching runner.ts's conversationLog convention.
  // Swapped (Agent-first) here previously made same-turn references look like forward
  // fabrications to the judge: it saw a claim before the statement it was responding to.
  const transcript = turns
    .map((t) => `[Turn ${t.turnNumber}] Mitarbeiter: "${t.userInput}"\n[Turn ${t.turnNumber}] Agent: "${t.agentText}"`)
    .join('\n\n')

  try {
    const model = resolveModel(getJudgeModel(evalModel))
    const { text } = await generateText({
      model,
      system: JUDGE_SYSTEM,
      prompt: `Transkript:\n\n${transcript}`,
      maxOutputTokens: 800,
      temperature: 0,
      experimental_telemetry: buildTraceMetadata('scorer.talker_factual_grounding', {
        ...traceCtx,
        component: 'judge_talker_grounding',
        environment: traceCtx?.environment ?? 'eval',
      }),
    })
    return parseGroundingResponse(text)
  } catch (err) {
    console.warn('[scorer:talker_factual_grounding] judge call failed, returning 0:', err)
    return { violations: 0, rationale: '' }
  }
}

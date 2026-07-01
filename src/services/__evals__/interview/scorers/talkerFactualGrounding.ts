import { generateText } from 'ai'
import { resolveModel } from '@/lib/llm-provider'
import { getJudgeModel } from './dialogNaturalness'
import type { TurnRecord, TokenUsageRecord } from './types'

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
  /**
   * True only when the score is a fallback-0 from an unparseable judge response or a failed judge
   * call, NOT a genuinely observed "0 violations". Lets consumers (Judge-Kalibrierung, PROJ-40 D)
   * distinguish a real zero from the KI-18 parser-fallback artifact, which otherwise pollutes the
   * grounding agreement statistic. Unset (falsy) on the normal path and on the len<2 no-op — the
   * prod runner reads only `.violations`/`.rationale`, so this stays backward-compatible.
   */
  parseFailed?: boolean
}

export function parseGroundingResponse(text: string): TalkerFactualGroundingResult {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { violations?: Array<{ turn?: number; claim?: string; reason?: string }> }
      const violations = Array.isArray(parsed.violations) ? parsed.violations : []
      const rationale = violations
        .map((v) => `Turn ${v.turn ?? '?'}: "${v.claim ?? ''}" — ${v.reason ?? ''}`)
        .join('\n')
      return { violations: violations.length, rationale }
    }
  } catch {
    // fall through
  }
  console.warn('[talkerFactualGrounding] unexpected judge format, fallback 0')
  return { violations: 0, rationale: '', parseFailed: true }
}

export async function scoreTalkerFactualGrounding(
  turns: TurnRecord[],
  evalModel: string,
  onTokenUsage?: (r: TokenUsageRecord) => void,
  judgeModelOverride?: string,
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
    // PROJ-40 D: Judge-Override für die Kalibrierung (s. dialogNaturalness).
    const judgeModelString = judgeModelOverride ?? getJudgeModel(evalModel)
    const model = resolveModel(judgeModelString)
    const result = await generateText({
      model,
      system: JUDGE_SYSTEM,
      prompt: `Transkript:\n\n${transcript}`,
      maxOutputTokens: 800,
      temperature: 0,
    })
    onTokenUsage?.({
      component: 'judge_talker_grounding',
      model: judgeModelString,
      inputTokens: result.usage.inputTokens ?? 0,
      cacheReadTokens: (result.usage.inputTokenDetails as Record<string, unknown> | undefined)?.cacheReadTokens as number | undefined,
      outputTokens: result.usage.outputTokens ?? 0,
    })
    return parseGroundingResponse(result.text)
  } catch (err) {
    console.warn('[scorer:talker_factual_grounding] judge call failed, returning 0:', err)
    // A failed judge call is an unreliable 0, same artifact class as a parser fallback.
    return { violations: 0, rationale: '', parseFailed: true }
  }
}

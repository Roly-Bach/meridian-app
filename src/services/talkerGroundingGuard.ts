import { generateText } from 'ai'
import { resolveModel } from '@/lib/llm-provider'
import type { TurnMessage } from './interviewTypes'

type OnTokenUsage = (r: {
  component: string
  model: string
  inputTokens: number
  cacheReadTokens?: number
  outputTokens: number
}) => void

/**
 * KI-18 — live per-turn grounding guard for the Talker's natural-language callbacks.
 *
 * Two prior prompt-only fix attempts (more anti-fabrication instructions in
 * talkerPrompt.ts) reproduced the same dialog_naturalness regression on the
 * it-support persona (gemini-3.1-flash-lite) without reducing violations — the
 * model conflates topics/turns under the mandatory Anker-Pflicht (E3.3,
 * PROJ-29) regardless of how the rule is worded. This guard does not touch the
 * prompt: it classifies the CANDIDATE response against the actual prior
 * history with a cross-vendor judge before the text reaches the client, and
 * interviewTalker.ts regenerates once if it's flagged. Same judge-pairing
 * idea as the eval-time scorers (dialogNaturalness/talkerFactualGrounding),
 * duplicated here (not imported from __evals__) to keep prod code independent
 * of the eval-only module tree.
 */
function crossVendorJudgeModel(talkerModel: string): string {
  const isGemini =
    talkerModel.toLowerCase().includes('gemini') || talkerModel.toLowerCase().startsWith('google/')
  return isGemini ? 'anthropic/claude-haiku-4-5' : 'google/gemini-3.1-flash-lite'
}

const GUARD_SYSTEM = `Du prüfst EINE Agent-Antwort aus einem laufenden Interview auf falsche Prämissen.

Suche im Agent-Text nach Referenzen auf frühere Mitarbeiter-Aussagen, z.B. "Du hast vorhin X erwähnt", "Du sagtest X", "Wie du beschrieben hast, X", "Du hast von X gesprochen", "Du hattest X genannt". Prüfe für jede solche Referenz, ob X (wörtlich oder sinngemäß) tatsächlich in einem VORHERIGEN Mitarbeiter-Turn so vorkommt — auch eine Verletzung, wenn X einem ANDEREN im Verlauf genannten Sachverhalt zugeordnet wird (z.B. eine Zeit- oder Mengenangabe aus Prozess A wird Prozess B zugeschrieben), oder wenn X erst im AKTUELLEN Turn zum ersten Mal genannt wurde.

Legitime Rückbezüge auf tatsächlich Gesagtes (auch grob gerundet) sind KEINE Verletzung.

Antworte AUSSCHLIESSLICH mit JSON, kein Markdown, kein Fließtext:
{"violation": true/false, "claim": "<falsche Zuschreibung, falls violation>", "reason": "<kurz>"}`

export interface GroundingGuardResult {
  violation: boolean
  claim?: string
  reason?: string
}

export function parseGuardResponse(text: string): GroundingGuardResult {
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0]) as { violation?: boolean; claim?: string; reason?: string }
      return { violation: parsed.violation === true, claim: parsed.claim, reason: parsed.reason }
    }
  } catch {
    // fall through
  }
  return { violation: false }
}

export async function checkGroundingViolation(
  candidateText: string,
  priorTurns: TurnMessage[],
  talkerModelString: string,
  _traceCtx?: unknown,
  onTokenUsage?: OnTokenUsage,
): Promise<GroundingGuardResult> {
  if (priorTurns.length === 0) return { violation: false }

  const transcript = priorTurns
    .map((t) => `${t.role === 'user' ? 'Mitarbeiter' : 'Agent'}: "${t.content}"`)
    .join('\n')

  try {
    const judgeModel = crossVendorJudgeModel(talkerModelString)
    const model = resolveModel(judgeModel)
    const result = await generateText({
      model,
      system: GUARD_SYSTEM,
      prompt: `Bisheriger Verlauf:\n${transcript}\n\nZU PRÜFENDE Agent-Antwort:\n"${candidateText}"`,
      maxOutputTokens: 300,
      temperature: 0,
    })
    onTokenUsage?.({
      component: 'grounding_guard',
      model: judgeModel,
      inputTokens: result.usage?.inputTokens ?? 0,
      cacheReadTokens: (result.usage?.inputTokenDetails as Record<string, unknown> | undefined)?.cacheReadTokens as number | undefined,
      outputTokens: result.usage?.outputTokens ?? 0,
    })
    return parseGuardResponse(result.text)
  } catch (err) {
    console.warn('[talkerGroundingGuard] judge call failed, treating as no violation:', err)
    return { violation: false }
  }
}

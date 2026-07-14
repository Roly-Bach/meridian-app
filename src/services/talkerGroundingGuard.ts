import { generateText } from 'ai'
import { resolveModel } from '@/lib/llm-provider'
import type { TurnMessage } from './interviewTypes'
import { buildTraceMetadata, type TraceCtx, type OnTokenUsage } from './_telemetry'

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
/**
 * Coarse vendor "family" of a model string, used to guarantee the guard judge never
 * shares a lineage with the talker (no self-assessment). Robust to provider/aggregator
 * prefixes: `anthropic/claude-…`, `nebius/deepseek-ai/…`, `openrouter/deepseek/…` all
 * normalize to their vendor family. Substring table first (handles prefix variants), then
 * a structural fallback to the vendor segment of the slug. Heuristic by design — err toward
 * grouping models that share a base model, since the cost of a false "same family" is only a
 * config error the operator resolves, while a false "different" would let a model grade itself.
 */
export function modelFamily(modelString: string): string {
  const s = modelString.toLowerCase()
  const table: Array<[RegExp, string]> = [
    [/claude|anthropic/, 'anthropic'],
    [/gemini|gemma|(^|\/)google\//, 'google'],
    [/deepseek/, 'deepseek'],
    [/glm|z-ai|zhipu/, 'zhipu'],
    [/minimax/, 'minimax'],
    [/kimi|moonshot/, 'moonshot'],
    [/mimo|xiaomi/, 'xiaomi'],
    [/qwen/, 'qwen'],
    [/llama|meta-llama/, 'meta'],
    [/mistral|mixtral/, 'mistral'],
    [/(^|\/)gpt|openai\/|(^|\/)o[134](-|$)/, 'openai'],
  ]
  for (const [re, fam] of table) {
    if (re.test(s)) return fam
  }
  // Fallback: the vendor segment. Aggregator strings (openrouter/nebius/fireworks + 3 segments)
  // carry the real vendor in segment[1]; provider-native strings put it in segment[0].
  const parts = s.split('/')
  const aggregators = new Set(['openrouter', 'nebius', 'fireworks'])
  if (parts.length >= 3 && aggregators.has(parts[0])) return parts[1]
  return parts[0]
}

/** Existing cross-vendor default used when GUARD_JUDGE_MODEL is unset (dev/eval convenience). */
function defaultGuardJudgeModel(talkerModel: string): string {
  const isGemini =
    talkerModel.toLowerCase().includes('gemini') || talkerModel.toLowerCase().startsWith('google/')
  return isGemini ? 'anthropic/claude-haiku-4-5' : 'google/gemini-3.1-flash-lite'
}

/**
 * PROJ-41 (D2): the prod guard judge must be configurable so the EU route can pin it to the
 * chosen provider (ADR-020 D2/D5) instead of the hardcoded Gemini/Anthropic pair. Honors
 * GUARD_JUDGE_MODEL; falls back to the cross-vendor default otherwise.
 */
export function resolveGuardJudgeModel(talkerModel: string): string {
  const override = process.env.GUARD_JUDGE_MODEL?.trim()
  return override && override.length > 0 ? override : defaultGuardJudgeModel(talkerModel)
}

/**
 * Hard invariant (ADR-020 D2): a model must never grade its own output. Throws on a config
 * error so a misconfigured guard fails the interview loudly instead of running a biased judge.
 * Deliberately raised OUTSIDE the judge-call try/catch in checkGroundingViolation so it is not
 * swallowed into a silent no-violation.
 */
export function assertGuardFamilyDiffersFromTalker(guardModel: string, talkerModel: string): void {
  const guardFam = modelFamily(guardModel)
  const talkerFam = modelFamily(talkerModel)
  if (guardFam === talkerFam) {
    throw new Error(
      `GUARD_JUDGE_MODEL misconfigured: guard judge "${guardModel}" (family "${guardFam}") shares the talker's model family "${talkerModel}" — a model may not grade its own output (ADR-020 D2). Set GUARD_JUDGE_MODEL to a different vendor family.`,
    )
  }
}

const GUARD_SYSTEM = `Du prüfst EINE Agent-Antwort aus einem laufenden Interview auf falsche Prämissen.

Suche im Agent-Text nach Referenzen auf frühere Mitarbeiter-Aussagen, z.B. "Du hast vorhin X erwähnt", "Du sagtest X", "Wie du beschrieben hast, X", "Du hast von X gesprochen", "Du hattest X genannt". Prüfe für jede solche Referenz, ob X (wörtlich oder sinngemäß) tatsächlich in einem VORHERIGEN Mitarbeiter-Turn so vorkommt.

Eine Verletzung liegt insbesondere in folgenden vier Fällen vor — auch wenn der Agent-Text den Bezug plausibel oder beiläufig formuliert:

1. ZAHL/WERT-FABRIKATION: X ist eine Zahl, Dauer oder Menge, die der Mitarbeiter so nie genannt hat (auch nicht gerundet oder umgerechnet) — egal ob völlig erfunden oder aus einer anderen Aussage "abgeleitet".
   Beispiel VERLETZUNG: Mitarbeiter sagte "3 bis 5 Hardware-Tausche wöchentlich. Zeitaufwand? Kommt drauf an." (explizite Nicht-Antwort auf die Dauer-Frage). Agent sagt später: "Du hast vorhin 3 bis 5 Tausche pro Woche erwähnt – jetzt klang es so, als würde der Prozess 3 Minuten dauern." → VERLETZUNG: "3 Minuten" wurde nie genannt, der Mitarbeiter hat die Dauer explizit offengelassen. Eine Weigerung oder ein Ausweichen ("kommt drauf an", "schwer zu sagen", "variiert") ist KEIN Anker für einen konkreten Wert, egal wie der Agent ihn formuliert.

2. SACHVERHALT-ZUORDNUNG: ein Wert oder eine Aussage aus Sachverhalt A wird im Agent-Text Sachverhalt B zugeschrieben.
   Beispiel VERLETZUNG: Mitarbeiter nannte eine Zahl für Prozess A. Agent sagt "Du hast vorhin bei Prozess B X erwähnt" — X gehörte zu A, nicht B.

3. GENERALISIERUNG/UMDEUTUNG: eine spezifische, enge Aussage des Mitarbeiters wird im Agent-Text zu einer breiteren oder andersartigen Behauptung verallgemeinert, die der Mitarbeiter so nicht gemacht hat — auch wenn der ursprüngliche Fakt korrekt zitiert wirkt.
   Beispiel VERLETZUNG: Mitarbeiter sagte "Im Schnitt dreifacher Wechsel zwischen Jira, Remote Desktop und Wiki" (eine reine Häufigkeits-/Mengenangabe). Agent sagt "Du hast vorhin den Wechsel zwischen Jira, Remote Desktop und Wiki als Standard beschrieben" → VERLETZUNG: die Mengenangabe ("dreifach") wurde stillschweigend zu einer anderen Behauptung ("als Standard beschrieben", einer Aussage über Prozessstatus statt Häufigkeit) umgedeutet. Prüfe bei jeder Zusammenfassung/Paraphrase: behauptet der Agent-Satz etwas qualitativ Anderes als das Original, auch wenn einzelne Wörter übereinstimmen?

4. WORTWAHL-ZUSCHREIBUNG: der Agent behauptet, der Mitarbeiter habe ein bestimmtes WORT oder eine bestimmte FORMULIERUNG bereits in einem früheren Turn benutzt, obwohl der Mitarbeiter dort nur sinngemäß/umschrieben formuliert hat und das konkrete Wort erstmals im AKTUELLEN oder einem späteren Turn fällt.
   Beispiel VERLETZUNG: Mitarbeiter sagte in Turn 9 "Kommt drauf an. Kann ich keine pauschale Zeitangabe machen. Hängt vom Einzelfall ab." (Umschreibung, OHNE das Wort "unmöglich"). In Turn 10 sagt der Mitarbeiter dann erstmals "Pauschale Dauer unmöglich". Agent sagt in seiner Antwort auf Turn 10: "Du hast vorhin gesagt, eine pauschale Zeitangabe sei unmöglich, und jetzt sprichst du wieder davon, dass sie nicht machbar ist." → VERLETZUNG: der Agent konstruiert eine falsche Kontinuität, als hätte der Mitarbeiter das Wort "unmöglich" schon in Turn 9 verwendet — tatsächlich war Turn 9 nur eine Umschreibung, "unmöglich" fiel erstmals in Turn 10 (also im selben Turn wie die Agent-Antwort, nicht "vorhin"). Sinngemäße Paraphrasen sind erlaubt — eine falsche Zeitangabe ("vorhin") für ein Wort, das so erst gerade gefallen ist, ist es nicht.

Kein Sonderfall, sondern Grundregel für alle vier: wenn du unsicher bist, ob die Mitarbeiter-Aussage X wirklich so trägt wie im Agent-Text behauptet, ist das eine Verletzung — im Zweifel für die Erkennung, nicht für den Agent-Text.

Legitime Rückbezüge auf tatsächlich Gesagtes (auch grob gerundet, ohne Bedeutungsverschiebung) sind KEINE Verletzung. Auch KEINE Verletzung: der Agent stellt eine neue Frage ohne Rückbezug auf eine frühere Aussage. Auch KEINE Verletzung: der Agent paraphrasiert eine frühere Mitarbeiter-Aussage korrekt, ohne ein Wort fälschlich als "vorhin gesagt" zu markieren, das erst jetzt fiel.

Antworte AUSSCHLIESSLICH mit JSON, kein Markdown, kein Fließtext. "reason" MAXIMAL EIN Satz (unter 20 Wörter) — knapp halten, nicht die Beispiele oben nacherzählen:
{"violation": true/false, "claim": "<falsche Zuschreibung, falls violation>", "reason": "<max. 1 kurzer Satz, welcher der vier Fälle (1/2/3/4) zutrifft>"}`

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
    // fall through — full JSON may be truncated (e.g. maxOutputTokens cutoff
    // mid-"reason"), no closing brace for the regex above. "violation" is the
    // first field the judge emits per GUARD_SYSTEM's schema, so it usually
    // survives truncation even when claim/reason don't — recover it directly
    // instead of defaulting to no-violation on a partial response (2026-06-30:
    // a real violation shipped unguarded this way, the parse failure swallowed
    // a genuine "violation": true).
  }
  const violationMatch = text.match(/"violation"\s*:\s*(true|false)/)
  if (violationMatch) {
    console.warn('[talkerGroundingGuard] truncated/malformed judge JSON, recovered violation flag via partial parse')
    return {
      violation: violationMatch[1] === 'true',
      claim: text.match(/"claim"\s*:\s*"([^"]*)/)?.[1],
      reason: text.match(/"reason"\s*:\s*"([^"]*)/)?.[1],
    }
  }
  console.warn('[talkerGroundingGuard] unexpected judge format, fallback no-violation')
  return { violation: false }
}

export async function checkGroundingViolation(
  candidateText: string,
  priorTurns: TurnMessage[],
  talkerModelString: string,
  traceCtx?: TraceCtx,
  onTokenUsage?: OnTokenUsage,
): Promise<GroundingGuardResult> {
  // Resolve + validate the judge model on every call, BEFORE the empty-history early return and
  // OUTSIDE the try/catch below: a family clash is a config error that must hard-fail the interview,
  // not degrade to a silent no-violation (ADR-020 D2). Cheap, pure — no judge call here.
  const judgeModel = resolveGuardJudgeModel(talkerModelString)
  assertGuardFamilyDiffersFromTalker(judgeModel, talkerModelString)

  if (priorTurns.length === 0) return { violation: false }

  const transcript = priorTurns
    .map((t) => `${t.role === 'user' ? 'Mitarbeiter' : 'Agent'}: "${t.content}"`)
    .join('\n')

  // Reliability (2026-07-11): a manual UI session reproduced the exact "180 Rechnungen"
  // fabrication (Zahl/Wert-Fabrikation, KI-18) live in prod. Re-running checkGroundingViolation
  // against the identical transcript afterward correctly flagged it — the judge prompt itself
  // is sound. The likely cause is a transient judge-call failure silently degrading to
  // "no violation" on the FIRST (and only) attempt below, with no retry — same failure class
  // as KI-11 (`withRetry` in supabaseTurnStore.ts), just never applied to this call site.
  // Bounded retries close that gap without changing the guard's detection logic.
  const retries = 1
  const delayMs = 300
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const model = resolveModel(judgeModel)
      const result = await generateText({
        model,
        system: GUARD_SYSTEM,
        prompt: `Bisheriger Verlauf:\n${transcript}\n\nZU PRÜFENDE Agent-Antwort:\n"${candidateText}"`,
        maxOutputTokens: 500,
        temperature: 0,
        experimental_telemetry: buildTraceMetadata('talkerGroundingGuard.judge', {
          model: judgeModel,
          component: 'grounding_guard',
          ...traceCtx,
        }),
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
      lastErr = err
      if (attempt < retries) await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)))
    }
  }
  // console.error (not warn): a judge failure here means this turn shipped with ZERO grounding
  // protection — indistinguishable from a real "no violation" pass unless logged loudly.
  console.error(`[talkerGroundingGuard] judge call failed after ${retries + 1} attempts, shipping WITHOUT grounding check:`, lastErr)
  return { violation: false }
}

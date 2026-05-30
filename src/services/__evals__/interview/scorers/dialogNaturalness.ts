import { generateText } from 'ai'
import { resolveModel } from '@/lib/llm-provider'
import type { TurnRecord } from './types'

/**
 * LLM-as-Judge scorer for dialog naturalness.
 * Uses a cross-vendor model to avoid self-serving bias:
 *   eval=Gemini → judge=claude-haiku-4-5
 *   eval=Anthropic → judge=google/gemini-3.1-flash-lite
 */
function getJudgeModel(evalModel: string): string {
  const isGemini =
    evalModel.toLowerCase().includes('gemini') || evalModel.toLowerCase().startsWith('google/')
  return isGemini ? 'anthropic/claude-haiku-4-5' : 'google/gemini-3.1-flash-lite'
}

const JUDGE_SYSTEM = `Du bist ein Qualitätsprüfer für KI-Interview-Dialoge auf Deutsch.
Bewerte die folgenden Agent-Texte nach diesen fünf Kriterien:

1. Natürliche, gesprächliche deutsche Sprache (kein Behördendeutsch, kein Denglisch)
2. Höfliche Du-Form konsequent verwendet
3. Keine generischen Einleitungen ("Sicher!", "Natürlich!", "Gerne!", "Das ist eine gute Frage!")
4. Keine abrupten Themensprünge ohne verbindende Formulierung
5. Grammatikalisch korrekte, leicht lesbare Sätze

Antworte NUR mit einer Dezimalzahl zwischen 0.00 und 1.00.
0.00 = durchgehend schlechte Qualität, 1.00 = durchgehend exzellente Qualität.
Keine weitere Erklärung, keine Begründung — nur die Zahl.`

const MAX_SAMPLE_TURNS = 8

export async function scoreDialogNaturalness(turns: TurnRecord[], evalModel: string): Promise<number> {
  const agentTexts = turns.map(t => t.agentText).filter(t => t.trim().length > 0)
  if (agentTexts.length === 0) return 0.5

  // Sample spread across conversation to keep judge prompt short
  const sample =
    agentTexts.length > MAX_SAMPLE_TURNS
      ? [
          agentTexts[0],
          agentTexts[1],
          agentTexts[Math.floor(agentTexts.length / 2)],
          ...agentTexts.slice(-5),
        ]
      : agentTexts

  const judgeModelString = getJudgeModel(evalModel)

  try {
    const model = resolveModel(judgeModelString)
    const { text } = await generateText({
      model,
      system: JUDGE_SYSTEM,
      prompt: `Agent-Texte:\n\n${sample.map((t, i) => `[${i + 1}] ${t}`).join('\n\n')}`,
      maxOutputTokens: 12,
      temperature: 0,
    })

    const score = parseFloat(text.trim().replace(',', '.'))
    if (isNaN(score) || score < 0 || score > 1) return 0.5
    return Math.round(score * 100) / 100
  } catch (err) {
    console.warn('[scorer:dialog_naturalness] judge call failed, returning 0.5:', err)
    return 0.5
  }
}

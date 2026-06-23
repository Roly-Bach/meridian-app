import { generateText } from 'ai'
import { resolveModel } from '@/lib/llm-provider'
import type { TurnRecord } from './types'

/**
 * LLM-as-Judge scorer for dialog naturalness.
 * Uses a cross-vendor model to avoid self-serving bias:
 *   eval=Gemini → judge=claude-haiku-4-5
 *   eval=Anthropic → judge=google/gemini-3.1-flash-lite
 */
export function getJudgeModel(evalModel: string): string {
  const isGemini =
    evalModel.toLowerCase().includes('gemini') || evalModel.toLowerCase().startsWith('google/')
  return isGemini ? 'anthropic/claude-haiku-4-5' : 'google/gemini-3.1-flash-lite'
}

const JUDGE_SYSTEM = `Du bist ein Qualitätsprüfer für KI-Interview-Dialoge auf Deutsch.
Bewerte die folgenden Agent-Texte nach ihrer Gesprächsnatürlichkeit.

Rubrik:
- Stufe 1 (oberflächlich): generische Einleitungen/Floskeln ("Sicher!", "Natürlich!", "Gerne!", "Das ist eine gute Frage!"), häufige Stilbrüche, inkonsistente Du-Form
- Stufe 2 (angemessen): überwiegend natürliche Sprache, vereinzelte Mängel, Du-Form meist eingehalten
- Stufe 3 (exzellent): durchgehend natürlich, höflich, keine generischen Floskeln, konsequente Du-Form, keine abrupten Themensprünge

WICHTIG: Antworte AUSSCHLIESSLICH mit einem JSON-Objekt. Kein Markdown, keine Überschriften, kein Fließtext davor oder danach.
Exaktes Format (beginne direkt mit der öffnenden geschweifte Klammer):
{"stufe": 2, "begruendung": "kurze Begründung in max 80 Wörtern"}`

const MAX_SAMPLE_TURNS = 8

export interface DialogNaturalnessResult {
  score: number
  rationale: string
}

/**
 * Parse the LLM judge response.
 * Returns { score, rationale } where score is 0.33 / 0.67 / 1.00.
 * Falls back to 0.5 with a warning on unexpected format.
 */
export function parseJudgeResponse(text: string): { score: number; rationale: string } {
  // 1. Try JSON format: {"stufe": X, "begruendung": "..."}
  try {
    // Extract JSON object from text (judge may wrap it in markdown code fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
      const stufeRaw = parsed['stufe']
      if (typeof stufeRaw === 'number' && stufeRaw >= 1 && stufeRaw <= 5) {
        const stufe = Math.round(stufeRaw) as 1 | 2 | 3
        const scoreMap: Record<number, number> = { 1: 0.33, 2: 0.67, 3: 1.0, 4: 1.0, 5: 1.0 }
        const score = scoreMap[stufe] ?? 0.5
        const rationale = typeof parsed['begruendung'] === 'string' ? parsed['begruendung'].trim() : ''
        return { score, rationale }
      }
    }
  } catch {
    // JSON parse failed — fall through to regex
  }

  // 2. Fallback: regex for "Stufe: X" (tolerant for bold markdown, extra spaces, colon variants)
  const regex = /\*{0,2}Stufe\s*[:\s]\s*([123])\*{0,2}/gi
  let lastMatch: RegExpExecArray | null = null
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    lastMatch = match
  }

  if (!lastMatch) {
    console.warn('[dialogNaturalness] unexpected format, fallback 0.5')
    return { score: 0.5, rationale: text.trim() }
  }

  const stufe = parseInt(lastMatch[1], 10) as 1 | 2 | 3
  const scoreMap: Record<1 | 2 | 3, number> = { 1: 0.33, 2: 0.67, 3: 1.0 }
  const score = scoreMap[stufe] ?? 0.5

  // Rationale = everything before the last "Stufe: X" marker
  const lastMatchIndex = text.lastIndexOf(lastMatch[0])
  const rationale = text.slice(0, lastMatchIndex).trim()

  return { score, rationale }
}

export async function scoreDialogNaturalness(
  turns: TurnRecord[],
  evalModel: string,
  isolatedCriteria = false,
): Promise<DialogNaturalnessResult> {
  const agentTexts = turns.map(t => t.agentText).filter(t => t.trim().length > 0)
  if (agentTexts.length === 0) return { score: 0.5, rationale: '' }

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

  if (isolatedCriteria) {
    return scoreWithIsolatedCriteria(sample, judgeModelString)
  }

  try {
    const model = resolveModel(judgeModelString)
    const { text } = await generateText({
      model,
      system: JUDGE_SYSTEM,
      prompt: `Agent-Texte:\n\n${sample.map((t, i) => `[${i + 1}] ${t}`).join('\n\n')}`,
      maxOutputTokens: 600,
      temperature: 0,
    })

    return parseJudgeResponse(text)
  } catch (err) {
    console.warn('[scorer:dialog_naturalness] judge call failed, returning 0.5:', err)
    return { score: 0.5, rationale: '' }
  }
}

// ─── Isolated criteria mode ───────────────────────────────────────────────────

interface CriterionResult {
  criterion: string
  weight: number
  score: number
  rationale: string
}

const ISOLATED_CRITERIA: Array<{ criterion: string; weight: number; prompt: string }> = [
  {
    criterion: 'Natürlichkeit',
    weight: 0.3,
    prompt: 'Bewerte ausschließlich die Natürlichkeit der Sprache (kein Behördendeutsch, kein Denglisch). Stufe 1 = sehr unnatürlich, Stufe 2 = teils natürlich, Stufe 3 = durchgehend natürlich. Schreibe deine Begründung in maximal 2 Sätzen. Die allerletzte Zeile deiner Antwort muss IMMER exakt lauten: `Stufe: X`',
  },
  {
    criterion: 'Du-Form',
    weight: 0.2,
    prompt: 'Bewerte ausschließlich die Konsistenz der Du-Form. Stufe 1 = oft falsch/gemischt, Stufe 2 = meistens korrekt, Stufe 3 = immer korrekt. Schreibe deine Begründung in maximal 2 Sätzen. Die allerletzte Zeile deiner Antwort muss IMMER exakt lauten: `Stufe: X`',
  },
  {
    criterion: 'Keine Floskeln',
    weight: 0.2,
    prompt: 'Bewerte ausschließlich ob generische Einleitungsfloskeln ("Sicher!", "Natürlich!", "Gerne!", "Das ist eine gute Frage!") verwendet werden. Stufe 1 = häufig, Stufe 2 = selten, Stufe 3 = nie. Schreibe deine Begründung in maximal 2 Sätzen. Die allerletzte Zeile deiner Antwort muss IMMER exakt lauten: `Stufe: X`',
  },
  {
    criterion: 'Kein Themensprung',
    weight: 0.2,
    prompt: 'Bewerte ausschließlich ob abrupte Themensprünge ohne verbindende Formulierung vorkommen. Stufe 1 = häufig, Stufe 2 = selten, Stufe 3 = nie. Schreibe deine Begründung in maximal 2 Sätzen. Die allerletzte Zeile deiner Antwort muss IMMER exakt lauten: `Stufe: X`',
  },
  {
    criterion: 'Grammatik',
    weight: 0.1,
    prompt: 'Bewerte ausschließlich die Grammatik und Lesbarkeit. Stufe 1 = viele Fehler, Stufe 2 = wenige Fehler, Stufe 3 = fehlerfrei. Schreibe deine Begründung in maximal 2 Sätzen. Die allerletzte Zeile deiner Antwort muss IMMER exakt lauten: `Stufe: X`',
  },
]

async function scoreWithIsolatedCriteria(
  sample: string[],
  judgeModelString: string,
): Promise<DialogNaturalnessResult> {
  const promptBase = `Agent-Texte:\n\n${sample.map((t, i) => `[${i + 1}] ${t}`).join('\n\n')}`
  const results: CriterionResult[] = []

  for (const crit of ISOLATED_CRITERIA) {
    try {
      const model = resolveModel(judgeModelString)
      const { text } = await generateText({
        model,
        system: crit.prompt,
        prompt: promptBase,
        maxOutputTokens: 600,
        temperature: 0,
      })
      const parsed = parseJudgeResponse(text)
      results.push({ criterion: crit.criterion, weight: crit.weight, score: parsed.score, rationale: parsed.rationale })
    } catch {
      results.push({ criterion: crit.criterion, weight: crit.weight, score: 0.5, rationale: '' })
    }
  }

  const totalWeight = results.reduce((s, r) => s + r.weight, 0)
  const weightedScore = results.reduce((s, r) => s + r.score * r.weight, 0) / totalWeight
  const score = Math.round(weightedScore * 100) / 100

  const rationale = results
    .map(r => `[${r.criterion}] Score: ${r.score} — ${r.rationale}`)
    .join('\n\n')

  return { score, rationale }
}

import { generateText } from 'ai'
import { resolveModel } from '@/lib/llm-provider'
import type { StepEntry } from '@/services/interviewSemantic'
import type { TurnRecord } from './types'

export interface SlotDepthResult {
  depth_score: number | null
  depth_distribution: { p1: number; p2: number; p3: number } | null
  rationale?: string
}

// See depth-rubric.md for anchor documentation (ADR-T011)
const RUBRIC = `Rubrik (ADR-T011):
- Stufe 1 (Oberflächlich): Sachverhalt benannt, keine Bedingung, keine Kausalstruktur, keine Ausnahme
- Stufe 2 (Adäquat): Mind. ein erklärender Kontext: Wer / Wann / Unter welcher Bedingung
- Stufe 3 (Tiefgründig): Kausalstruktur, Ausnahmefall oder taziter Aspekt durch konversationelles Nachfragen`

function getJudgeModel(evalModel: string): string {
  const isGemini =
    evalModel.toLowerCase().includes('gemini') || evalModel.toLowerCase().startsWith('google/')
  return isGemini ? 'anthropic/claude-haiku-4-5' : 'google/gemini-3.1-flash-lite'
}

interface FilledSlot {
  name: string
  value: string
  quote: string
}

function getFilledSlots(step: StepEntry): FilledSlot[] {
  const result: FilledSlot[] = []

  // Dynamic iteration over all named slots — picks up PROJ-25 O1-O5 extensions without code changes
  // Sorted by name for deterministic batch order (Order-Swap invariance, BL-E5.2)
  const slotEntries = (Object.entries(step.slots) as Array<[string, { value: string | string[] | null; quote: string | null } | null]>)
    .sort(([a], [b]) => a.localeCompare(b))
  for (const [name, slot] of slotEntries) {
    if (slot == null || slot.value == null) continue
    if (Array.isArray(slot.value)) {
      if (slot.value.length === 0) continue
      result.push({ name, value: slot.value.join(', '), quote: slot.quote ?? '' })
    } else {
      result.push({ name, value: slot.value, quote: slot.quote ?? '' })
    }
  }

  // Potenzial slots (schemaagnostisch — evaluate if quote is substantive)
  const { frequency_per_month, duration_minutes, error_rate_percent, media_breaks } = step.potenzial
  if (frequency_per_month?.value != null && (frequency_per_month.quote?.trim().length ?? 0) > 5) {
    result.push({ name: 'frequency_per_month', value: String(frequency_per_month.value), quote: frequency_per_month.quote })
  }
  if (duration_minutes?.value != null && (duration_minutes.quote?.trim().length ?? 0) > 5) {
    result.push({ name: 'duration_minutes', value: String(duration_minutes.value), quote: duration_minutes.quote })
  }
  if (error_rate_percent?.value != null && (error_rate_percent.quote?.trim().length ?? 0) > 5) {
    result.push({ name: 'error_rate_percent', value: String(error_rate_percent.value), quote: error_rate_percent.quote })
  }
  if (media_breaks?.value != null && (media_breaks.quote?.trim().length ?? 0) > 5) {
    result.push({ name: 'media_breaks', value: String(media_breaks.value), quote: media_breaks.quote })
  }

  return result
}

function getStepTurns(stepTitle: string, turns: TurnRecord[]): TurnRecord[] {
  return turns.filter(t =>
    t.toolCalls.some(
      tc =>
        (tc.toolName === 'register_step' || tc.toolName === 'record_slot') &&
        typeof tc.args.step_title === 'string' &&
        tc.args.step_title === stepTitle,
    ),
  )
}

interface SlotJudgment {
  slot: string
  begruendung: string
  stufe: 1 | 2 | 3
}

async function callJudge(
  step: StepEntry,
  filledSlots: FilledSlot[],
  stepTurns: TurnRecord[],
  judgeModelString: string,
): Promise<SlotJudgment[] | null> {
  const turnsText =
    stepTurns.length > 0
      ? stepTurns.map(t => `Mitarbeiter: ${t.userInput}\nAgent: ${t.agentText}`).join('\n\n')
      : '(keine zugehörigen Gesprächsauszüge)'

  const slotsText = filledSlots
    .map(s => `Slot: ${s.name}\nWert: ${s.value}\nBeleg: "${s.quote}"`)
    .join('\n\n')

  const prompt = `Du bist ein Evaluations-Judge für die Tiefe von extrahiertem Prozesswissen.

${RUBRIC}

Beurteile jeden Slot unabhängig voneinander. Schreibe für jeden Slot zuerst die Begründung, dann die Stufe (REQ-010: Begründung vor Stufe).
Verweise in der Begründung eines Slots nicht auf das Urteil anderer Slots in diesem Batch.

Prozessschritt: ${step.title}

Gesprächsauszüge des Schritts (für Stufe-3-Beurteilung):
${turnsText}

Zu bewertende Slots:
${slotsText}

Antworte ausschließlich als JSON-Array:
[
  { "slot": "<slot_name>", "begruendung": "<begründung>", "stufe": <1|2|3> }
]`

  try {
    const model = resolveModel(judgeModelString)
    const { text } = await generateText({ model, prompt, temperature: 0, maxOutputTokens: 2048 })
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed = JSON.parse(cleaned) as unknown[]
    if (!Array.isArray(parsed)) return null
    return parsed.filter(
      (j): j is SlotJudgment =>
        typeof (j as SlotJudgment).slot === 'string' &&
        typeof (j as SlotJudgment).begruendung === 'string' &&
        [1, 2, 3].includes((j as SlotJudgment).stufe),
    )
  } catch {
    return null
  }
}

const TIMEOUT_MS = 60_000

export async function scoreSlotDepth(
  finalStepTracker: StepEntry[],
  turns: TurnRecord[],
  evalModel: string,
): Promise<SlotDepthResult> {
  if (finalStepTracker.length === 0) return { depth_score: null, depth_distribution: null }

  const judgeModelString = getJudgeModel(evalModel)
  const startTime = Date.now()
  const allStufen: number[] = []
  const rationaleLines: string[] = []

  for (const step of finalStepTracker) {
    if (Date.now() - startTime > TIMEOUT_MS) break

    const filledSlots = getFilledSlots(step)
    if (filledSlots.length === 0) continue

    const stepTurns = getStepTurns(step.title, turns)

    let judgments = await callJudge(step, filledSlots, stepTurns, judgeModelString)
    if (judgments === null) {
      judgments = await callJudge(step, filledSlots, stepTurns, judgeModelString)
    }
    if (judgments === null) continue

    for (const j of judgments) {
      if ([1, 2, 3].includes(j.stufe)) {
        allStufen.push(j.stufe)
        rationaleLines.push(`[${step.title}/${j.slot}] Stufe ${j.stufe}: ${j.begruendung}`)
      }
    }
  }

  if (allStufen.length === 0) return { depth_score: null, depth_distribution: null }

  const total = allStufen.length
  const round2 = (n: number) => Math.round(n * 100) / 100
  const p1 = round2(allStufen.filter(s => s === 1).length / total)
  const p2 = round2(allStufen.filter(s => s === 2).length / total)
  const p3 = round2(allStufen.filter(s => s === 3).length / total)
  const depth_score = round2(allStufen.reduce((a, b) => a + b, 0) / total)
  const rationale = rationaleLines.join('\n')

  return { depth_score, depth_distribution: { p1, p2, p3 }, rationale }
}

#!/usr/bin/env tsx
/**
 * Prints the MODEL_PRICING rate (USD / 1M tokens) for every model this eval run
 * will actually bill, resolved with the same env-var fallback chains the runner
 * and its components use. Run BEFORE `npm run eval:interview` so a stale or
 * missing MODEL_PRICING entry is visible at model-confirmation time, not buried
 * in a finished transcript (see costSummary.ts MODEL_PRICING comment).
 *
 * Usage: npm run eval:pricing-check
 */
import path from 'path'
import { config } from 'dotenv'

// Load .env.local from project root before any other imports that read env vars.
config({ path: path.resolve(process.cwd(), '.env.local') })

import { MODEL_PRICING } from './scorers/costSummary'
import { getJudgeModel } from './scorers/dialogNaturalness'
import { resolveGuardJudgeModel } from '@/services/talkerGroundingGuard'

function resolveComponentModels(): Map<string, string[]> {
  const interviewModel = process.env.INTERVIEW_MODEL ?? 'google/gemini-3.1-flash-lite'
  const talkerModel = process.env.INTERVIEW_TALKER_MODEL ?? interviewModel
  const analystModel = process.env.INTERVIEW_ANALYST_MODEL ?? interviewModel
  const testerModel = process.env.TESTER_MODEL ?? 'google/gemini-3.1-flash-lite'
  // Guard + judges are cross-vendor by design (never grade the model under test) —
  // resolveGuardJudgeModel/getJudgeModel mirror the exact runtime resolution so this
  // preview can't silently diverge from what the run actually calls.
  const guardJudgeModel = resolveGuardJudgeModel(talkerModel)
  const judgeModel = getJudgeModel(interviewModel)

  const byModel = new Map<string, string[]>()
  const add = (model: string, component: string) => {
    byModel.set(model, [...(byModel.get(model) ?? []), component])
  }
  add(talkerModel, 'talker')
  add(analystModel, 'analyst / analyst_online / analyst_catchup')
  add(testerModel, 'tester')
  add(guardJudgeModel, 'grounding_guard')
  add(judgeModel, 'judge_dialog_naturalness / judge_slot_depth / judge_talker_grounding')

  return byModel
}

function fmtRate(n: number): string {
  return `$${n.toFixed(4)}`
}

function main(): void {
  const byModel = resolveComponentModels()

  console.log('\n[eval] Modell-Preise (USD / 1M Tokens) — Stand MODEL_PRICING in src/services/__evals__/interview/scorers/costSummary.ts\n')

  let anyMissing = false
  for (const [model, components] of byModel) {
    const p = MODEL_PRICING[model]
    console.log(`  ${components.join(', ')}`)
    if (p) {
      console.log(`    ${model}\n      Input ${fmtRate(p.inputPer1M)}  Cache Read ${fmtRate(p.cachePer1M)}  Output ${fmtRate(p.outputPer1M)}`)
    } else {
      anyMissing = true
      console.log(`    ${model}\n      ⚠ KEINE MODEL_PRICING-ANGABE — Kostenbeitrag würde im Report als $0 gemeldet`)
    }
    console.log('')
  }

  if (anyMissing) {
    console.log('⚠ Mindestens ein Modell hat keinen MODEL_PRICING-Eintrag. Vor dem Lauf in costSummary.ts ergänzen, sonst wird sein Kostenbeitrag als $0 gemeldet (kein Fehlschlag, aber falscher Kostenvergleich).\n')
  } else {
    console.log('Alle Modelle haben eine MODEL_PRICING-Angabe. Preise gegen die aktuelle Provider-Preisliste prüfen (Stand siehe Kommentar in costSummary.ts), bevor der Lauf gestartet wird.\n')
  }
}

main()

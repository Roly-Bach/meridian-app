#!/usr/bin/env tsx
/**
 * Eval runner for interview agent benchmarking (PROJ-17/PROJ-21).
 *
 * Usage (single run — backward-compatible):
 *   npm run eval:interview buchhalter
 *   INTERVIEW_MODEL=google/gemini-3.5-flash npm run eval:interview buchhalter
 *
 * Usage (model matrix):
 *   npm run eval:interview -- --models gemini-3.1-flash-lite,gemini-3.5-flash --personas buchhalter,vertriebler
 *   npm run eval:interview -- --models gemini-3.1-flash-lite --personas buchhalter --baseline-label PROJ-22-pre-refactor
 *
 * Usage (multi-run with seed):
 *   npm run eval:interview -- --personas buchhalter --runs 3
 *   npm run eval:interview -- --personas buchhalter --runs 5 --seed 42 --no-perturbation
 *   npm run eval:interview -- --personas buchhalter --runs 3 --isolated-criteria
 *
 * LANGFUSE_ENABLED is set to true automatically for eval runs.
 *
 * Requires in .env.local:
 *   EVAL_WORKSPACE_ID=<uuid of a workspace in your local DB>
 *   All other standard env vars (Supabase, AI provider keys, Langfuse keys)
 */

import path from 'path'
import { config } from 'dotenv'

// Load .env.local from project root before any other imports that read env vars.
config({ path: path.resolve(process.cwd(), '.env.local') })

import fs from 'fs'
import { randomUUID } from 'crypto'
import { generateText } from 'ai'
import { resolveModel } from '@/lib/llm-provider'
import { initLangfuse, flushLangfuse, forceFlushLangfuse } from '@/lib/langfuse'
import type { Phase, StepEntry } from '@/services/interviewSemantic'
import type { TurnMessage, ClarificationCard } from '@/services/interviewTypes'
import { createTalkerStream, TALKER_THINKING_BUDGET } from '@/services/interviewTalker'
import {
  decideNextPhase,
  type OrchestratorContext,
} from '@/services/interviewOrchestrator'
import { ANALYST_THINKING_BUDGET, type AnalystToolCallRecord } from '@/services/interviewAnalyst'
import { runInterviewTurn } from '@/services/runInterviewTurn'
import { buildTraceMetadata, type TraceCtx } from '@/services/_telemetry'
import type { Persona } from './personas/types'
import { perturbPersona } from './perturbation'
import { createEvalStore, type EvalStore, type EvalStoreKind, type ClarificationAnswer } from './evalStore'
import { runAllScorers, type TurnRecord, type ScoreSet } from './scorers'

// ─── Persona loader ───────────────────────────────────────────────────────────

const PERSONA_MAP: Record<string, () => Promise<Persona>> = {
  buchhalter: async () => (await import('./personas/buchhalter')).buchhalter,
  vertriebler: async () => (await import('./personas/vertriebler')).vertriebler,
  'it-support': async () => (await import('./personas/it-support')).itSupport,
}

// ─── CLI arg parser ───────────────────────────────────────────────────────────

interface RunArgs {
  models: string[]
  personas: string[]
  baselineLabel: string | null
  runs: number
  seed: number
  noPerturbation: boolean
  isolatedCriteria: boolean
  store: EvalStoreKind
}

function printUsage(): void {
  console.error('Usage: npm run eval:interview <persona>')
  console.error('       npm run eval:interview -- --models m1,m2 --personas p1,p2')
  console.error('       npm run eval:interview -- --personas buchhalter --runs 3')
  console.error('       npm run eval:interview -- --personas buchhalter --runs 5 --seed 42 --no-perturbation')
  console.error('')
  console.error('Options:')
  console.error('  --models      Comma-separated model IDs (default: INTERVIEW_MODEL env or gemini-3.1-flash-lite)')
  console.error('  --personas    Comma-separated persona names')
  console.error('  --runs N      Number of runs per model×persona (1–10, default: 1)')
  console.error('  --seed S      Seeded PRNG seed (default: random)')
  console.error('  --no-perturbation  Skip persona perturbation (default: false)')
  console.error('  --isolated-criteria  Use isolated criteria mode for dialogNaturalness (default: false)')
  console.error('  --store           Persistence backend: supabase | pglite (default: supabase, env: EVAL_STORE)')
  console.error('  --baseline-label  Label for this run (stored in report frontmatter)')
}

function parseArgs(): RunArgs {
  const args = process.argv.slice(2)
  let models: string[] | null = null
  let personas: string[] | null = null
  let baselineLabel: string | null = null
  let runs = 1
  let seed: number | null = null
  let noPerturbation = false
  let isolatedCriteria = false
  let store: string | null = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--models' && args[i + 1]) {
      models = args[++i].split(',').map(s => s.trim()).filter(Boolean)
    } else if (args[i] === '--personas' && args[i + 1]) {
      personas = args[++i].split(',').map(s => s.trim()).filter(Boolean)
    } else if (args[i] === '--baseline-label' && args[i + 1]) {
      baselineLabel = args[++i]
    } else if (args[i] === '--runs' && args[i + 1]) {
      const parsed = parseInt(args[++i], 10)
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
        console.error(`[runner] --runs must be an integer between 1 and 10, got: ${args[i]}`)
        printUsage()
        process.exit(1)
      }
      runs = parsed
    } else if (args[i] === '--seed' && args[i + 1]) {
      const parsed = parseInt(args[++i], 10)
      if (!Number.isInteger(parsed)) {
        console.error(`[runner] --seed must be an integer, got: ${args[i]}`)
        printUsage()
        process.exit(1)
      }
      seed = parsed
    } else if (args[i] === '--no-perturbation') {
      noPerturbation = true
    } else if (args[i] === '--isolated-criteria') {
      isolatedCriteria = true
    } else if (args[i] === '--store' && args[i + 1]) {
      store = args[++i].trim()
    } else if (!args[i].startsWith('--') && !personas) {
      // Backward-compatible: positional persona arg
      personas = [args[i]]
    }
  }

  // If seed not provided, generate one and log it
  if (seed === null) {
    seed = Math.floor(Math.random() * 100000)
  }

  // Persistence backend: flag > EVAL_STORE env > supabase default.
  // Supabase stays the default so the standard eval is byte-intact; pglite is
  // opt-in until the fidelity proof flips it (PROJ-34 / ADR-018 §C).
  const storeRaw = (store ?? process.env.EVAL_STORE ?? 'supabase').toLowerCase()
  if (storeRaw !== 'supabase' && storeRaw !== 'pglite') {
    console.error(`[runner] --store must be 'supabase' or 'pglite', got: ${storeRaw}`)
    printUsage()
    process.exit(1)
  }

  // Normalize bare model IDs (no provider prefix) → google/ default
  const normalizeModel = (m: string) => (m.includes('/') ? m : `google/${m}`)

  return {
    models: (models ?? [process.env.INTERVIEW_MODEL ?? 'google/gemini-3.1-flash-lite']).map(normalizeModel),
    personas: personas ?? [],
    baselineLabel,
    runs,
    seed,
    noPerturbation,
    isolatedCriteria,
    store: storeRaw,
  }
}

// ─── Clarification helpers (PROJ-23) ─────────────────────────────────────────
//
// All DB access (state/history/briefing reads, interview creation, clarification
// completion) moved behind the EvalStore adapter (evalStore.ts) — the runner is
// now persistence-agnostic (PROJ-34 / ADR-018 §C). Only the pure card→answer
// mapping stays here.

// Deterministic synthetic answers for each card type
function buildSyntheticClarificationAnswers(cards: ClarificationCard[]): ClarificationAnswer[] {
  const SLOT_DEFAULTS: Record<string, string> = {
    frequency_per_month: 'Wöchentlich',
    duration_minutes: '15–30 Min',
    rule_based: 'Meistens gleich',
    error_rate_percent: 'Gelegentlich',
    open_item: 'Ja',
  }
  return cards.map(card => {
    const def = SLOT_DEFAULTS[card.slot_key]
    if (def) return { process_step_id: card.process_step_id, slot_key: card.slot_key, answer: def }
    // Qualitative: first non-"Weiß ich nicht" option
    const valid = card.options.filter(o => o !== 'Weiß ich nicht')
    const chosen = valid[0] ?? card.options[0] ?? 'Weiß ich nicht'
    return {
      process_step_id: card.process_step_id,
      slot_key: card.slot_key,
      answer: card.answer_type === 'multi' ? [chosen] : chosen,
    }
  })
}

// ─── Persona simulator ────────────────────────────────────────────────────────

async function generatePersonaResponse(
  persona: Persona,
  agentText: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  traceCtx?: TraceCtx,
): Promise<string> {
  const testerModelString = process.env.TESTER_MODEL ?? 'google/gemini-3.1-flash-lite'
  const model = resolveModel(testerModelString)

  const historyText = history
    .map(m => `${m.role === 'assistant' ? 'Interviewer' : persona.identity.name}: ${m.content}`)
    .join('\n')

  const { text } = await generateText({
    model,
    system: [
      `Du bist ${persona.identity.name}, ${persona.identity.role} in der Abteilung ${persona.identity.department} mit ${persona.identity.yearsExperience} Jahren Erfahrung.`,
      '',
      'Dein Prozesswissen:',
      JSON.stringify(persona.processKnowledge, null, 2),
      '',
      `Kommunikationsstil: ${persona.style.verbosity === 'detailed' ? 'ausführlich' : 'knapp'}, ${persona.style.tone === 'formal' ? 'formell' : 'informell'}.`,
      `Besonderheiten: ${persona.style.tendencies.join('; ')}`,
      '',
      'WICHTIG: Antworte AUSSCHLIESSLICH auf Basis deines Prozesswissens. Erfinde keine Fakten.',
      'Teile konkrete Zahlen (Mengen, Zeitangaben, Prozentwerte) und Tool-Namen nur auf direkte Nachfrage mit.',
      'Antworte in der Ich-Perspektive, auf Deutsch. Maximal 3–4 Sätze.',
      'WICHTIG: Verwende NIEMALS dieselbe Einleitungsphrase wie in einer vorherigen Antwort dieses Gesprächs. Wenn du "Ich fange damit an, die Rechnung zu prüfen" oder eine ähnliche Formulierung bereits gesagt hast, ist sie VERBOTEN — wähle einen anderen Einstieg.',
      'KONTEXTREGEL: Beantworte immer den gerade erfragten Prozess. Wenn der Interviewer nach Monatsabschluss, Mahnprozess oder einem anderen Thema fragt, beginne NICHT mit Rechnungsprüfungs-Phrasen.',
    ].join('\n'),
    prompt: historyText
      ? `Bisheriges Gespräch:\n${historyText}\n\nInterviewer sagt gerade: ${agentText}\n\nDeine Antwort als ${persona.identity.name}:`
      : `Interviewer sagt: ${agentText}\n\nDeine Antwort als ${persona.identity.name}:`,
    maxOutputTokens: 300,
    experimental_telemetry: buildTraceMetadata('tester.persona', {
      ...traceCtx,
      component: 'tester_persona',
      environment: 'eval',
    }),
  })

  return text.trim()
}

// ─── Trail metrics ────────────────────────────────────────────────────────────

export interface TrailMetrics {
  totalWrites: number
  blockedWrites: number
  /** blocked_writes / total_writes — target < 0.10 */
  blockedRate: number
  /** non-blocked overwrites / total_writes — target < 0.20 */
  overwriteChurn: number
}

/**
 * Parse the slot-write trail JSONL and compute diagnostic metrics.
 * These measure write-path health independent of interview quality.
 */
function computeTrailMetrics(trailFile: string): TrailMetrics | null {
  try {
    if (!fs.existsSync(trailFile)) return null
    const lines = fs.readFileSync(trailFile, 'utf8').split('\n').filter(Boolean)
    if (lines.length === 0) return null

    let blockedWrites = 0
    let nonBlockedOverwrites = 0
    for (const line of lines) {
      const event = JSON.parse(line) as { blocked?: boolean; overwrite?: boolean; source?: string }
      if (event.blocked) {
        blockedWrites++
      } else if (event.overwrite && !event.source?.startsWith('analyst')) {
        // Analyst overwrites are intentional paraphrase-refinements, not churn.
        // Only online (quick-extract / online-extract) overwrites count toward churn.
        nonBlockedOverwrites++
      }
    }
    const totalWrites = lines.length
    return {
      totalWrites,
      blockedWrites,
      blockedRate: Math.round((blockedWrites / totalWrites) * 100) / 100,
      overwriteChurn: Math.round((nonBlockedOverwrites / totalWrites) * 100) / 100,
    }
  } catch {
    return null
  }
}

// ─── Report writer ────────────────────────────────────────────────────────────

function modelSlug(model: string): string {
  return model.replace(/[/\.]/g, '-')
}

// 2026-06-08 retune — phase_progression dropped from gate, replaced by dedup_slot_coverage.
// Phase progression penalized short efficient interviews (buchhalter 17 turns, perfect data → FAIL).
// The real PASS signal is data quality: completion + all steps registered + slots filled +
// dialog still natural + no race-condition data loss.
// 2026-06-18: threshold lowered 0.70 → 0.65.
// Judge produces discrete 0.33/0.67/1.0 (Stufe 1-3). Stufe 2 (0.67) = "angemessen" — acceptable.
// Requiring ≥ 0.70 meant only Stufe 3 could pass, which was too strict for the holistic judge.
//
// Single source of truth for PASS/FAIL — used by buildReport (report status) AND by main()
// (process exit code, 2026-06-24 audit: this gate previously had no CI-visible consequence,
// a non-PASS report could sit unnoticed since nothing read its status programmatically).
function evaluateGate(scores: ScoreSet, trailMetrics: TrailMetrics | null | undefined): boolean {
  return (
    scores.completionCorrectness === true &&
    scores.dedupSlotCoverage >= 0.75 &&
    scores.stepRegistrationCoverage >= 0.8 &&
    scores.dialogNaturalness >= 0.65 &&
    (trailMetrics?.blockedRate ?? 0) < 0.1
  )
}

function buildReport(opts: {
  model: string
  personaName: string
  interviewId: string
  evalRunId: string
  baselineLabel: string | null
  turns: TurnRecord[]
  finalStepTracker: StepEntry[]
  interviewStatus: string
  scores: ScoreSet
  trailMetrics?: TrailMetrics | null
  runIndex?: number
  runSeed?: number
  isolatedCriteria?: boolean
  totalRuns?: number
}): string {
  const {
    model, personaName, interviewId, evalRunId, baselineLabel,
    turns, finalStepTracker, interviewStatus, scores, trailMetrics,
    runIndex, runSeed, isolatedCriteria, totalRuns,
  } = opts

  const testerModel = process.env.TESTER_MODEL ?? 'google/gemini-3.1-flash-lite'
  const talkerModel = process.env.INTERVIEW_TALKER_MODEL ?? process.env.INTERVIEW_MODEL ?? 'google/gemini-3.1-flash-lite'
  const analystModel = process.env.INTERVIEW_ANALYST_MODEL ?? process.env.INTERVIEW_MODEL ?? 'google/gemini-3.5-flash'
  const evalDate = new Date().toISOString().slice(0, 10)
  const langfuseSession = process.env.LANGFUSE_PROJECT_URL
    ? `${process.env.LANGFUSE_PROJECT_URL}/sessions/${interviewId}`
    : null
  // 2026-06-08 retune — phase_progression dropped from gate, replaced by dedup_slot_coverage.
  const passed = evaluateGate(scores, trailMetrics)
  const status = passed ? 'PASS' : 'FAIL'

  const frontmatter = [
    '---',
    `interview_model: ${model}`,
    `tester_model: ${testerModel}`,
    `talker_model: ${talkerModel}`,
    `talker_thinking_budget: ${TALKER_THINKING_BUDGET}`,
    `analyst_model: ${analystModel}`,
    `analyst_thinking_budget: ${ANALYST_THINKING_BUDGET}`,
    `eval_date: ${evalDate}`,
    `persona: ${personaName}`,
    `interview_id: ${interviewId}`,
    `eval_run_id: ${evalRunId}`,
    langfuseSession ? `langfuse_session: ${langfuseSession}` : null,
    runIndex != null ? `run_index: ${runIndex}` : null,
    runSeed != null ? `run_seed: ${runSeed}` : null,
    runSeed != null ? `perturbation_seed: ${runSeed}` : null,
    isolatedCriteria ? `isolated_criteria: true` : null,
    isolatedCriteria && totalRuns && totalRuns > 1
      ? `judge_calls_note: "isolated_criteria=true runs=${totalRuns} => ${5 * totalRuns} judge calls per persona"`
      : null,
    `turns_total: ${turns.length}`,
    `status: ${status}`,
    `baseline_label: ${baselineLabel ?? 'null'}`,
    'scores:',
    `  slot_coverage: ${scores.slotCoverage}`,
    `  dedup_slot_coverage: ${scores.dedupSlotCoverage}`,
    `  slot_coverage_pre_clarification: ${scores.slotCoveragePreClarification}`,
    `  dedup_slot_coverage_pre_clarification: ${scores.dedupSlotCoveragePreClarification}`,
    `  clarification_coverage_delta: ${scores.clarificationCoverageDelta}`,
    `  phase_progression: ${scores.phaseProgression}`,
    `  phase_adherence: ${scores.phaseAdherence}`,
    `  anchoring_violations: ${scores.anchoringViolations}`,
    `  anchoring_violation_rate: ${scores.anchoringViolationRate}`,
    `  tool_call_plausibility: ${scores.toolCallPlausibility}`,
    `  dialog_naturalness: ${scores.dialogNaturalness}`,
    `  completion_correctness: ${scores.completionCorrectness}`,
    `  step_registration_coverage: ${scores.stepRegistrationCoverage}`,
    `  schema_conformance_rate: ${scores.schemaConformanceRate}`,
    `  hallucination_rate: ${scores.hallucinationRate}`,
    `  confidence_trigger_rate: ${scores.confidenceTriggerRate ?? 'n/a (keine unknown-Slots)'}`,
    `  talker_grounding_violations: ${scores.talkerGroundingViolations}`,
    `  depth_score: ${scores.depth_score ?? 'null'}`,
    `  depth_p1: ${scores.depth_distribution?.p1 ?? 'null'}`,
    `  depth_p2: ${scores.depth_distribution?.p2 ?? 'null'}`,
    `  depth_p3: ${scores.depth_distribution?.p3 ?? 'null'}`,
    trailMetrics ? 'trail:' : null,
    trailMetrics ? `  total_writes: ${trailMetrics.totalWrites}` : null,
    trailMetrics ? `  blocked_writes: ${trailMetrics.blockedWrites}` : null,
    trailMetrics ? `  blocked_rate: ${trailMetrics.blockedRate}` : null,
    trailMetrics ? `  overwrite_churn: ${trailMetrics.overwriteChurn}` : null,
    '---',
  ].filter(l => l !== null).join('\n')

  const scoreTable = [
    '',
    '## Quality Scores',
    '',
    '| Metrik | Score | Ziel |',
    '|--------|-------|------|',
    `| slot_coverage | ${scores.slotCoverage} | maximize |`,
    `| dedup_slot_coverage | ${scores.dedupSlotCoverage} | maximize |`,
    `| slot_coverage_pre_clarification | ${scores.slotCoveragePreClarification} | maximize |`,
    `| dedup_slot_coverage_pre_clarification | ${scores.dedupSlotCoveragePreClarification} | maximize |`,
    `| clarification_coverage_delta | ${scores.clarificationCoverageDelta} | > 0 wenn Clarification ran |`,
    `| phase_progression | ${scores.phaseProgression} | maximize |`,
    `| phase_adherence | ${scores.phaseAdherence} | maximize |`,
    `| anchoring_violations | ${scores.anchoringViolations} | 0 |`,
    `| anchoring_violation_rate | ${scores.anchoringViolationRate} | maximize (niedriger besser) |`,
    // 2026-06-24 audit: 0.85 war nie erreichbar (6 Live-Läufe: Min 0.72, Max 0.87) — auf
    // Basis echter Daten auf 0.70 kalibriert statt eines aspirational geschätzten Werts.
    `| tool_call_plausibility | ${scores.toolCallPlausibility} | ≥ 0.70 |`,
    `| dialog_naturalness | ${scores.dialogNaturalness} | maximize |`,
    `| completion_correctness | ${scores.completionCorrectness} | true |`,
    `| step_registration_coverage | ${scores.stepRegistrationCoverage} | 1.0 |`,
    `| schema_conformance_rate | ${scores.schemaConformanceRate} | 1.0 |`,
    `| hallucination_rate | ${scores.hallucinationRate} | < 0.01 |`,
    `| confidence_trigger_rate | ${scores.confidenceTriggerRate ?? 'n/a (keine unknown-Slots)'} | > 0.80 |`,
    `| talker_grounding_violations | ${scores.talkerGroundingViolations} | 0 |`,
    `| depth_score | ${scores.depth_score ?? 'n/a'} | maximize |`,
    `| depth_p1 | ${scores.depth_distribution?.p1 ?? 'n/a'} | — |`,
    `| depth_p2 | ${scores.depth_distribution?.p2 ?? 'n/a'} | — |`,
    `| depth_p3 | ${scores.depth_distribution?.p3 ?? 'n/a'} | — |`,
    trailMetrics ? `| blocked_rate | ${trailMetrics.blockedRate} | < 0.10 |` : null,
    trailMetrics ? `| overwrite_churn | ${trailMetrics.overwriteChurn} | < 0.20 |` : null,
    '',
  ].filter(l => l !== null).join('\n')

  const judgeRationale = scores.dialogNaturalnessRationale
    ? [
        '',
        '## Judge-Begründung',
        '',
        scores.dialogNaturalnessRationale,
        '',
      ].join('\n')
    : ''

  const groundingRationale = scores.talkerGroundingRationale
    ? [
        '',
        '## Talker-Faktentreue-Verletzungen (KI-9)',
        '',
        scores.talkerGroundingRationale,
        '',
      ].join('\n')
    : ''

  const conversationLog = [
    '## Gesprächsverlauf',
    '',
    ...turns.flatMap(t => [
      `[Turn ${t.turnNumber}] Persona: ${t.userInput}`,
      `[Turn ${t.turnNumber}] Agent: "${t.agentText}"`,
      '',
    ]),
  ].join('\n')

  const slotTable = buildSlotTable(finalStepTracker)

  return [frontmatter, scoreTable, judgeRationale, groundingRationale, conversationLog, slotTable].join('\n')
}

function buildSlotTable(stepTracker: StepEntry[]): string {
  if (stepTracker.length === 0) return ''

  const header = [
    '## Slot-Filling-Stand',
    '',
    '| Schritt | Status | frequency | duration | entscheidungslogik | hilfsmittel | error_rate | media_breaks |',
    '|---------|--------|-----------|----------|--------------------|-------------|------------|--------------|',
  ]

  const rows = stepTracker.map(step => {
    const fp = (s: import('@/services/interviewSemantic').SlotValue | null) =>
      s ? `${String(s.value).slice(0, 20)} ✓` : 'null'
    const ft = (s: import('@/services/interviewSemantic').TaziteSlot | import('@/services/interviewSemantic').TaziteSlotArray | null) =>
      s?.value != null ? `${String(s.value).slice(0, 20)} ✓` : s?.nicht_befund_typ ? `[${s.nicht_befund_typ}]` : 'null'
    return `| ${step.title} | ${step.status} | ${fp(step.potenzial.frequency_per_month)} | ${fp(step.potenzial.duration_minutes)} | ${ft(step.slots.entscheidungslogik)} | ${ft(step.slots.hilfsmittel)} | ${fp(step.potenzial.error_rate_percent)} | ${fp(step.potenzial.media_breaks)} |`
  })

  return [...header, ...rows, ''].join('\n')
}

function writeReport(opts: {
  model: string
  personaName: string
  interviewId: string
  evalRunId: string
  baselineLabel: string | null
  turns: TurnRecord[]
  finalStepTracker: StepEntry[]
  interviewStatus: string
  scores: ScoreSet
  runIndex?: number
  runSeed?: number
  totalRuns?: number
  isolatedCriteria?: boolean
}): { filepath: string; passed: boolean } {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10)
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-')

  const dir = path.resolve(process.cwd(), 'docs', 'evals', 'interview', dateStr)
  fs.mkdirSync(dir, { recursive: true })

  // Backward-compatible: runs=1 uses the same naming as before
  const runSuffix =
    opts.totalRuns && opts.totalRuns > 1 && opts.runIndex != null
      ? `-run${opts.runIndex}`
      : ''

  const filename = `${dateStr}-${timeStr}-${modelSlug(opts.model)}-${opts.personaName}${runSuffix}.md`
  const filepath = path.join(dir, filename)

  const trailMetrics = process.env.SLOT_TRAIL_FILE
    ? computeTrailMetrics(process.env.SLOT_TRAIL_FILE)
    : null

  const content = buildReport({ ...opts, trailMetrics })
  fs.writeFileSync(filepath, content, 'utf8')

  // Write frozen transcript.json alongside the MD report (ADR-015)
  const transcriptData = {
    evalRunId: opts.evalRunId,
    interviewId: opts.interviewId,
    model: opts.model,
    persona: opts.personaName,
    status: opts.interviewStatus,
    turns: opts.turns,
    finalStepTracker: opts.finalStepTracker,
    scores: opts.scores,
    generatedAt: now.toISOString(),
  }
  const transcriptFilename = `${dateStr}-${timeStr}-${modelSlug(opts.model)}-${opts.personaName}${runSuffix}.transcript.json`
  fs.writeFileSync(path.join(dir, transcriptFilename), JSON.stringify(transcriptData, null, 2), 'utf8')

  return { filepath, passed: evaluateGate(opts.scores, trailMetrics) }
}

// ─── Langfuse score writer ────────────────────────────────────────────────────

async function writeLangfuseScores(
  interviewId: string,
  evalRunId: string,
  personaName: string,
  model: string,
  baselineLabel: string | null,
  scores: ScoreSet,
): Promise<void> {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) return

  // Import langfuse SDK directly (separate from OTel integration in @/lib/langfuse)
  const { Langfuse } = await import('langfuse')
  const lf = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
  })

  const tags = ['eval', 'scoring', `persona:${personaName}`, `model:${model}`, `eval_run_id:${evalRunId}`]
  if (baselineLabel) tags.push(`baseline_label:${baselineLabel}`)

  const trace = lf.trace({
    name: 'eval-scores',
    sessionId: interviewId,
    tags,
    metadata: { evalRunId, persona: personaName, model, baselineLabel },
  })

  const scoreEntries: Array<{ name: string; value: number; dataType: 'NUMERIC' | 'BOOLEAN' }> = [
    { name: 'slot_coverage', value: scores.slotCoverage, dataType: 'NUMERIC' },
    { name: 'phase_adherence', value: scores.phaseAdherence, dataType: 'NUMERIC' },
    { name: 'anchoring_violations', value: scores.anchoringViolations, dataType: 'NUMERIC' },
    { name: 'anchoring_violation_rate', value: scores.anchoringViolationRate, dataType: 'NUMERIC' },
    { name: 'tool_call_plausibility', value: scores.toolCallPlausibility, dataType: 'NUMERIC' },
    { name: 'dialog_naturalness', value: scores.dialogNaturalness, dataType: 'NUMERIC' },
    { name: 'completion_correctness', value: scores.completionCorrectness ? 1 : 0, dataType: 'BOOLEAN' },
    { name: 'step_registration_coverage', value: scores.stepRegistrationCoverage, dataType: 'NUMERIC' },
    { name: 'schema_conformance_rate', value: scores.schemaConformanceRate, dataType: 'NUMERIC' },
    { name: 'hallucination_rate', value: scores.hallucinationRate, dataType: 'NUMERIC' },
    { name: 'talker_grounding_violations', value: scores.talkerGroundingViolations, dataType: 'NUMERIC' },
  ]

  // confidenceTriggerRate is null when the interview had zero estimate/unknown
  // slots — "no signal", not a score. Only push a Langfuse score when it's real.
  if (scores.confidenceTriggerRate !== null) {
    scoreEntries.push({ name: 'confidence_trigger_rate', value: scores.confidenceTriggerRate, dataType: 'NUMERIC' })
  }

  for (const entry of scoreEntries) {
    lf.score({ traceId: trace.id, name: entry.name, value: entry.value, dataType: entry.dataType })
  }

  if (scores.depth_score != null) {
    lf.score({ traceId: trace.id, name: 'depth_score', value: scores.depth_score, dataType: 'NUMERIC' })
  }
  if (scores.depth_distribution != null) {
    lf.score({ traceId: trace.id, name: 'depth_p1', value: scores.depth_distribution.p1, dataType: 'NUMERIC' })
    lf.score({ traceId: trace.id, name: 'depth_p2', value: scores.depth_distribution.p2, dataType: 'NUMERIC' })
    lf.score({ traceId: trace.id, name: 'depth_p3', value: scores.depth_distribution.p3, dataType: 'NUMERIC' })
  }

  await lf.shutdownAsync()
}

// ─── Interview runner ─────────────────────────────────────────────────────────

interface InterviewResult {
  interviewId: string
  evalRunId: string
  model: string
  personaName: string
  baselineLabel: string | null
  turnRecords: TurnRecord[]
  finalStepTracker: StepEntry[]
  /** L9: tracker snapshot right before clarification phase ran. Null if clarification did not run. */
  preClarificationStepTracker: StepEntry[] | null
  finalInterviewStatus: string
}

async function runInterview(
  model: string,
  persona: Persona,
  personaName: string,
  baselineLabel: string | null,
  evalStore: EvalStore,
  runIndex?: number,
  totalRuns?: number,
): Promise<InterviewResult> {
  // Override INTERVIEW_MODEL for this run
  process.env.INTERVIEW_MODEL = model

  const evalRunId = randomUUID()

  // Activate slot-write trail for this eval run (ADR-015)
  const now = new Date()
  const evalDateStr = now.toISOString().slice(0, 10)
  const evalTimeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-')
  const runDir = path.resolve(process.cwd(), 'docs', 'evals', 'interview', evalDateStr)
  fs.mkdirSync(runDir, { recursive: true })
  // Run-specific trail file when running multiple runs to avoid overwrite
  const trailSuffix =
    totalRuns && totalRuns > 1 && runIndex != null
      ? `-run${runIndex}`
      : ''
  process.env.SLOT_TRAIL_FILE = path.join(runDir, `${evalDateStr}-${evalTimeStr}-${modelSlug(model)}-${personaName}${trailSuffix}.slot-trail.jsonl`)

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`[eval] model=${model} persona=${personaName} store=${evalStore.kind} evalRunId=${evalRunId}`)

  // Create interview record (workspace + interview + interview_state)
  const { interviewId, workspaceId } = await evalStore.createInterview({
    employeeName: persona.identity.name,
    employeeRole: persona.identity.role,
    department: persona.identity.department,
    focusTopics: persona.processKnowledge.processes.map(p => p.name).join(', ') || null,
    maxDurationMinutes: 30,
  })
  console.log(`[eval] Interview created: ${interviewId}`)

  const traceCtx: TraceCtx = {
    interviewId,
    persona: personaName,
    model,
    environment: 'eval',
    evalRunId,
  }

  const conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
  const turnRecords: TurnRecord[] = []
  let preClarificationSnapshot: StepEntry[] | null = null

  // ── Start turn (greeting) ──────────────────────────────────────────────────
  const startStream = await createTalkerStream({
    context: {
      interviewId,
      workspaceId,
      employeeName: persona.identity.name,
      employeeRole: persona.identity.role,
      department: persona.identity.department,
      focusTopics: persona.processKnowledge.processes.map(p => p.name).join(', ') || null,
      phase: 'intro',
      timerMinutes: 0,
      topicsCovered: [],
      topicsOpen: [],
      extractionsLog: [],
      maxDurationMinutes: 30,
      stepTracker: [],
    },
    history: [],
    isStart: true,
    traceCtx,
    onFinish: async (text) => {
      if (!text) return
      await evalStore.saveOpenerText(interviewId, text)
    },
  })

  const greeting = await startStream.text
  console.log(`\n[Agent]: ${greeting}`)
  conversationHistory.push({ role: 'assistant', content: greeting })

  // ── Interview loop ─────────────────────────────────────────────────────────
  const MAX_TURNS = 35
  let lastAgentText = greeting

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const personaResponse = await generatePersonaResponse(persona, lastAgentText, conversationHistory, {
      evalRunId,
      persona: personaName,
      model,
    })
    console.log(`\n[${persona.identity.name}]: ${personaResponse}`)
    conversationHistory.push({ role: 'user', content: personaResponse })

    const [dbState, dbHistory, analystBriefing] = await Promise.all([
      evalStore.loadState(interviewId),
      evalStore.loadHistory(interviewId),
      evalStore.loadAnalystBriefing(interviewId),
    ])

    // Simulate elapsed time: eval runs in seconds so real timerMinutes stays ~0.
    // Proportional to turn count so time-based urgency and hard-stop fire correctly.
    const simulatedTimerMinutes = Math.floor((turn / MAX_TURNS) * 30)

    const agentHistory: TurnMessage[] = [...dbHistory, { role: 'user', content: personaResponse }]

    const orchCtx: OrchestratorContext = {
      phase: dbState.phase,
      stepTracker: dbState.stepTracker,
      topicsOpen: dbState.topicsOpen,
      topicsCovered: dbState.topicsCovered,
      timerMinutes: simulatedTimerMinutes,
      maxDurationMinutes: 30,
      historyLength: agentHistory.length,
      history: agentHistory,
    }

    // PROJ-23: Clarification phase — eval-specific handling stays in runner.
    const nextPhaseDecision = decideNextPhase(orchCtx, analystBriefing)
    const phaseForClarificationCheck: Phase =
      nextPhaseDecision === 'completed' ? 'wrap_up' : (nextPhaseDecision as Phase)

    if (phaseForClarificationCheck === 'clarification') {
      const cards = analystBriefing?.clarification_cards ?? []
      console.log(`\n[eval] Clarification phase: ${cards.length} cards — submitting synthetic answers`)
      // L9: snapshot tracker BEFORE synthetic answers land — used by scorer to
      // measure how much coverage the clarification phase contributes.
      preClarificationSnapshot = JSON.parse(JSON.stringify(dbState.stepTracker)) as StepEntry[]
      const syntheticAnswers = buildSyntheticClarificationAnswers(cards)
      for (const a of syntheticAnswers) {
        console.log(`  [card] ${a.slot_key} → ${JSON.stringify(a.answer)}`)
      }
      await evalStore.executeClarificationCompletion(interviewId, workspaceId, syntheticAnswers)
      console.log('[eval] Clarification complete → interview completed')
      break
    }

    // Delegate full turn logic to runInterviewTurn (PROJ-33 / ADR-016).
    // Supabase: turnPorts=undefined → defaultProdPorts (byte-intact). PGlite:
    // no-op ports → DB-free (PROJ-34 / ADR-018 §C).
    const turnResult = await runInterviewTurn({
      interviewId,
      userInput: personaResponse,
      timerMinutes: simulatedTimerMinutes,
      traceCtx: traceCtx as Record<string, unknown>,
    }, evalStore.turnPorts)

    const agentText = await turnResult.stream.text

    // Await background analyst to capture tool calls for scoring.
    const analystResult = await turnResult.background().catch(err => {
      console.error('[runner] background analyst failed:', err)
      return null
    })
    const analystToolCalls: AnalystToolCallRecord[] = analystResult?.toolCalls ?? []

    if (analystToolCalls.length > 0) {
      console.log(`  [analyst tools] ${analystToolCalls.map(tc => tc.toolName).join(', ')}`)
    }

    const turnNumber = dbHistory.length / 2 + 1

    console.log(`\n[Agent]: ${agentText}`)
    conversationHistory.push({ role: 'assistant', content: agentText })
    lastAgentText = agentText

    turnRecords.push({
      turnNumber,
      userInput: personaResponse,
      agentText,
      phase: turnResult.meta.phase,
      toolCalls: analystToolCalls,
    })

    if (turnResult.meta.completed) {
      console.log('\n[eval] Interview completed.')
      break
    }

    const status = await evalStore.loadStatus(interviewId)
    if (status === 'completed') {
      console.log('\n[eval] Interview completed.')
      break
    }
  }

  // Load final state for scorers
  const finalState = await evalStore.loadState(interviewId)
  const finalInterviewStatus = await evalStore.loadStatus(interviewId)

  return {
    interviewId,
    evalRunId,
    model,
    personaName,
    baselineLabel,
    turnRecords,
    finalStepTracker: finalState.stepTracker,
    preClarificationStepTracker: preClarificationSnapshot,
    finalInterviewStatus,
  }
}

// ─── Summary printer ──────────────────────────────────────────────────────────

interface RunSummary {
  model: string
  persona: string
  scores: ScoreSet | null
  reportPath: string | null
  /** Gate result (evaluateGate) for this run. null when the run errored before scoring. */
  passed?: boolean
  error?: string
}

function printSummary(results: RunSummary[]): void {
  console.log('\n' + '═'.repeat(80))
  console.log('EVAL SUMMARY')
  console.log('═'.repeat(80))
  console.log(
    `${'Model'.padEnd(40)} ${'Persona'.padEnd(15)} ${'slot_cov'.padStart(8)} ${'dedup_cov'.padStart(9)} ${'phase_prog'.padStart(10)} ${'anchoring'.padStart(9)} ${'natural'.padStart(8)} ${'complete'.padStart(9)}`,
  )
  console.log('─'.repeat(80))

  for (const r of results) {
    if (!r.scores) {
      console.log(`${r.model.padEnd(40)} ${r.persona.padEnd(15)} ERROR: ${r.error ?? 'unknown'}`)
      continue
    }
    const s = r.scores
    console.log(
      `${r.model.padEnd(40)} ${r.persona.padEnd(15)} ${String(s.slotCoverage).padStart(8)} ${String(s.dedupSlotCoverage).padStart(9)} ${String(s.phaseProgression).padStart(10)} ${String(s.anchoringViolations).padStart(9)} ${String(s.dialogNaturalness).padStart(8)} ${String(s.completionCorrectness).padStart(9)}`,
    )
    if (r.reportPath) console.log(`  → ${r.reportPath}`)
  }
  console.log('═'.repeat(80))
}

function printMultiRunSummary(
  model: string,
  personaName: string,
  allScores: ScoreSet[],
): void {
  if (allScores.length === 0) return

  const numericKeys = ['slotCoverage', 'dedupSlotCoverage', 'dialogNaturalness', 'phaseAdherence', 'stepRegistrationCoverage'] as const

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Multi-run summary: model=${model} persona=${personaName} runs=${allScores.length}`)
  console.log(`${'Scorer'.padEnd(35)} ${'Median'.padStart(8)} ${'Min'.padStart(8)} ${'Max'.padStart(8)}`)
  console.log('─'.repeat(60))

  for (const key of numericKeys) {
    const vals = allScores.map(s => s[key] as number)
    const sorted = [...vals].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 !== 0
      ? sorted[mid]
      : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    console.log(`${key.padEnd(35)} ${String(median).padStart(8)} ${String(min).padStart(8)} ${String(max).padStart(8)}`)
  }
  console.log('─'.repeat(60))
}

// ─── Aggregate report writer ──────────────────────────────────────────────────

type NumericScoreKey = NonNullable<{
  [K in keyof ScoreSet]-?: ScoreSet[K] extends number ? K : never
}[keyof ScoreSet]>

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100
}

function computeMedianBoolean(values: boolean[]): number {
  // Majority vote: 1 if more true than false, 0 if more false, 0.5 if equal
  const trueCount = values.filter(Boolean).length
  const falseCount = values.length - trueCount
  if (trueCount > falseCount) return 1
  if (falseCount > trueCount) return 0
  return 0.5
}

function writeAggregateReport(opts: {
  model: string
  personaName: string
  baselineLabel: string | null
  seed: number
  allScores: ScoreSet[]
  dir: string
  dateStr: string
  timeStr: string
}): string {
  const { model, personaName, baselineLabel, seed, allScores, dir, dateStr, timeStr } = opts

  const NUMERIC_KEYS: NumericScoreKey[] = [
    'slotCoverage', 'dedupSlotCoverage', 'slotCoveragePreClarification',
    'dedupSlotCoveragePreClarification', 'clarificationCoverageDelta',
    'phaseAdherence', 'phaseProgression', 'anchoringViolations', 'anchoringViolationRate',
    'toolCallPlausibility', 'dialogNaturalness', 'stepRegistrationCoverage',
    'schemaConformanceRate', 'hallucinationRate',
    'talkerGroundingViolations',
  ]

  const medians: Partial<Record<NumericScoreKey, number>> = {}
  const mins: Partial<Record<NumericScoreKey, number>> = {}
  const maxes: Partial<Record<NumericScoreKey, number>> = {}

  for (const key of NUMERIC_KEYS) {
    const vals = allScores.map(s => s[key] as number).filter(v => typeof v === 'number')
    if (vals.length === 0) continue
    medians[key] = computeMedian(vals)
    mins[key] = Math.min(...vals)
    maxes[key] = Math.max(...vals)
  }

  const completionMedian = computeMedianBoolean(allScores.map(s => s.completionCorrectness))

  const depthScores = allScores.map(s => s.depth_score).filter((v): v is number => v != null)
  const depthMedian = depthScores.length > 0 ? computeMedian(depthScores) : null
  const depthMin = depthScores.length > 0 ? Math.min(...depthScores) : null
  const depthMax = depthScores.length > 0 ? Math.max(...depthScores) : null

  // confidenceTriggerRate is null on runs with zero estimate/unknown slots — "no
  // signal", excluded the same way depth_score's nulls are (not coerced into the
  // median/min/max of the runs that DO have a real value).
  const confidenceScores = allScores.map(s => s.confidenceTriggerRate).filter((v): v is number => v != null)
  const confidenceMedian = confidenceScores.length > 0 ? computeMedian(confidenceScores) : null
  const confidenceMin = confidenceScores.length > 0 ? Math.min(...confidenceScores) : null
  const confidenceMax = confidenceScores.length > 0 ? Math.max(...confidenceScores) : null

  const frontmatter = [
    '---',
    `interview_model: ${model}`,
    `persona: ${personaName}`,
    `baseline_label: ${baselineLabel ?? 'null'}`,
    `run_count: ${allScores.length}`,
    `perturbation_seed: ${seed}`,
    `eval_date: ${dateStr}`,
    'scores_median:',
    ...NUMERIC_KEYS.filter(k => medians[k] != null).map(k => `  ${k}: ${medians[k]}`),
    `  completion_correctness: ${completionMedian}`,
    depthMedian != null ? `  depth_score: ${depthMedian}` : null,
    confidenceMedian != null ? `  confidenceTriggerRate: ${confidenceMedian}` : null,
    'scores_min:',
    ...NUMERIC_KEYS.filter(k => mins[k] != null).map(k => `  ${k}: ${mins[k]}`),
    depthMin != null ? `  depth_score: ${depthMin}` : null,
    confidenceMin != null ? `  confidenceTriggerRate: ${confidenceMin}` : null,
    'scores_max:',
    ...NUMERIC_KEYS.filter(k => maxes[k] != null).map(k => `  ${k}: ${maxes[k]}`),
    depthMax != null ? `  depth_score: ${depthMax}` : null,
    confidenceMax != null ? `  confidenceTriggerRate: ${confidenceMax}` : null,
    '---',
  ].filter(l => l !== null).join('\n')

  const tableRows = NUMERIC_KEYS
    .filter(k => medians[k] != null)
    .map(k => `| ${k} | ${medians[k]} | ${mins[k]} | ${maxes[k]} |`)

  tableRows.push(`| completion_correctness | ${completionMedian} | — | — |`)
  if (depthMedian != null) {
    tableRows.push(`| depth_score | ${depthMedian} | ${depthMin} | ${depthMax} |`)
  }
  if (confidenceMedian != null) {
    tableRows.push(`| confidenceTriggerRate | ${confidenceMedian} | ${confidenceMin} | ${confidenceMax} |`)
  }

  const body = [
    '',
    `## Aggregat (${allScores.length} Läufe, seed=${seed})`,
    '',
    '| Metrik | Median | Min | Max |',
    '|--------|--------|-----|-----|',
    ...tableRows,
    '',
  ].join('\n')

  const filename = `${dateStr}-${timeStr}-${modelSlug(model)}-${personaName}-aggregate.md`
  const filepath = path.join(dir, filename)
  fs.writeFileSync(filepath, frontmatter + body, 'utf8')
  return filepath
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { models, personas, baselineLabel, runs, seed, noPerturbation, isolatedCriteria, store } = parseArgs()

  if (personas.length === 0) {
    printUsage()
    console.error(`Available personas: ${Object.keys(PERSONA_MAP).join(', ')}`)
    process.exit(1)
  }

  const unknownPersonas = personas.filter(p => !PERSONA_MAP[p])
  if (unknownPersonas.length > 0) {
    console.error(`Unknown persona(s): ${unknownPersonas.join(', ')}`)
    console.error(`Available: ${Object.keys(PERSONA_MAP).join(', ')}`)
    process.exit(1)
  }

  console.log(`[runner] seed=${seed} runs=${runs} noPerturbation=${noPerturbation} isolatedCriteria=${isolatedCriteria} store=${store}`)

  // Enable Langfuse tracing for all eval runs
  process.env.LANGFUSE_ENABLED = 'true'
  initLangfuse()

  const results: RunSummary[] = []

  for (const model of [...models].sort()) {
    for (const personaName of personas) {
      const basePersona = await PERSONA_MAP[personaName]()
      const multiRunScores: ScoreSet[] = []

      for (let runIndex = 1; runIndex <= runs; runIndex++) {
        // Persona perturbation (unless disabled)
        let persona: Persona = basePersona
        if (!noPerturbation) {
          // Use a different seed per run to get different perturbations across runs
          const runSeed = seed + runIndex - 1
          const perturbedKnowledge = await perturbPersona(basePersona.processKnowledge, runSeed)
          persona = { ...basePersona, processKnowledge: perturbedKnowledge }
        }

        const evalStore = await createEvalStore(store)
        try {
          const result = await runInterview(model, persona, personaName, baselineLabel, evalStore, runIndex, runs)

          // forceFlush (not shutdown) so the SDK stays alive for scorer spans
          await forceFlushLangfuse().catch(() => {})

          const scores = await runAllScorers({
            turns: result.turnRecords,
            finalStepTracker: result.finalStepTracker,
            preClarificationStepTracker: result.preClarificationStepTracker ?? undefined,
            interviewStatus: result.finalInterviewStatus,
            evalModel: model,
            expectedProcessCount: persona.expectedProcessCount,
            evalRunId: result.evalRunId,
            interviewId: result.interviewId,
            persona: personaName,
          }, isolatedCriteria)

          // Flush scorer OTel spans immediately so they appear in the same Langfuse session
          // as the interview (session.id = interviewId). Without this, spans buffered in the
          // OTel SDK risk being lost between forceFlush and the final shutdown at end of run.
          await forceFlushLangfuse().catch(() => {})

          const { filepath: reportPath, passed } = writeReport({
            model,
            personaName,
            interviewId: result.interviewId,
            evalRunId: result.evalRunId,
            baselineLabel,
            turns: result.turnRecords,
            finalStepTracker: result.finalStepTracker,
            interviewStatus: result.finalInterviewStatus,
            scores,
            runIndex: runs > 1 ? runIndex : undefined,
            runSeed: runs > 1 ? seed + runIndex - 1 : undefined,
            totalRuns: runs,
            isolatedCriteria,
          })

          console.log(`\n[eval] Report written: ${reportPath}`)

          // Write scores to Langfuse (non-blocking, fire-and-forget)
          writeLangfuseScores(
            result.interviewId,
            result.evalRunId,
            personaName,
            model,
            baselineLabel,
            scores,
          ).catch(err => console.error('[runner] langfuse score write failed:', err))

          multiRunScores.push(scores)
          results.push({ model, persona: personaName, scores, reportPath, passed })

          console.log(`\n[eval] Done: interview_id=${result.interviewId} eval_run_id=${result.evalRunId}`)
          const projectUrl = process.env.LANGFUSE_PROJECT_URL
          if (projectUrl) {
            console.log(`  Langfuse session: ${projectUrl}/sessions/${result.interviewId}`)
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          console.error(`[runner] Run failed for model=${model} persona=${personaName} run=${runIndex}:`, err)
          results.push({ model, persona: personaName, scores: null, reportPath: null, error: errMsg })
        } finally {
          await evalStore.close()
        }
      }

      // Write aggregate report when multiple runs completed
      if (runs > 1 && multiRunScores.length > 0) {
        const now = new Date()
        const dateStr = now.toISOString().slice(0, 10)
        const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-')
        const dir = path.resolve(process.cwd(), 'docs', 'evals', 'interview', dateStr)
        fs.mkdirSync(dir, { recursive: true })
        const aggregatePath = writeAggregateReport({
          model,
          personaName,
          baselineLabel,
          seed,
          allScores: multiRunScores,
          dir,
          dateStr,
          timeStr,
        })
        console.log(`\n[eval] Aggregate report written: ${aggregatePath}`)
        printMultiRunSummary(model, personaName, multiRunScores)
      }
    }
  }

  if (models.length * personas.length > 1 && runs === 1) {
    // Multi-run mode uses printMultiRunSummary (printed per model×persona above)
    printSummary(results)
  }

  // Final Langfuse flush
  await flushLangfuse().catch(() => {})
  await new Promise(r => setTimeout(r, 3000))

  // 2026-06-24 audit: a non-PASS report previously had no consequence beyond its own
  // file — nothing read `status` programmatically, so a regression could sit in
  // docs/evals/ unnoticed indefinitely. Exit non-zero on any FAIL/error so CI (or a
  // human running this locally) actually sees it.
  const anyFailed = results.some(r => r.error !== undefined || r.passed === false)
  if (anyFailed) process.exitCode = 1
}

main().catch(err => {
  console.error('[runner] Fatal:', err)
  process.exit(1)
})

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
import { initLangfuse, flushLangfuse } from '@/lib/langfuse'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  computeMissingMandatorySlots,
  type Phase,
  type TurnMessage,
  type StepEntry,
  type MissingSlot,
  type ClarificationCard,
  type AnalystBriefing,
} from '@/services/interviewAgent'
import { createTalkerStream, TALKER_THINKING_BUDGET } from '@/services/interviewTalker'
import {
  decideNextPhase,
  checkLifecycle,
  shouldInjectWrapUpQuestion,
  WRAP_UP_QUESTION_TEXT,
  type OrchestratorContext,
} from '@/services/interviewOrchestrator'
import { extractAndEmbed, deduplicateKnowledgeObjects, type TurnTranscript, type RawExtraction } from '@/services/extraction'
import { runAnalyst, ANALYST_THINKING_BUDGET, type AnalystToolCallRecord } from '@/services/interviewAnalyst'
import { runQuickExtract } from '@/services/interviewQuickExtract'
import { createProcessStepsFromTracker } from '@/services/processEnrichment'
import { clusterProcessSteps } from '@/services/processClustering'
import { type TraceCtx } from '@/services/_telemetry'
import type { Persona } from './personas/types'
import type { Database } from '@/lib/database.types'

type ProcessStepUpdate = Database['public']['Tables']['process_steps']['Update']
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
}

function parseArgs(): RunArgs {
  const args = process.argv.slice(2)
  let models: string[] | null = null
  let personas: string[] | null = null
  let baselineLabel: string | null = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--models' && args[i + 1]) {
      models = args[++i].split(',').map(s => s.trim()).filter(Boolean)
    } else if (args[i] === '--personas' && args[i + 1]) {
      personas = args[++i].split(',').map(s => s.trim()).filter(Boolean)
    } else if (args[i] === '--baseline-label' && args[i + 1]) {
      baselineLabel = args[++i]
    } else if (!args[i].startsWith('--') && !personas) {
      // Backward-compatible: positional persona arg
      personas = [args[i]]
    }
  }

  // Normalize bare model IDs (no provider prefix) → google/ default
  const normalizeModel = (m: string) => (m.includes('/') ? m : `google/${m}`)

  return {
    models: (models ?? [process.env.INTERVIEW_MODEL ?? 'google/gemini-3.1-flash-lite']).map(normalizeModel),
    personas: personas ?? [],
    baselineLabel,
  }
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

interface DBState {
  phase: Phase
  timerMinutes: number
  topicsCovered: string[]
  topicsOpen: string[]
  extractionsLog: RawExtraction[]
  stepTracker: StepEntry[]
}

async function loadState(interviewId: string): Promise<DBState> {
  const supabase = getSupabaseAdmin()
  const [{ data: stateRow }, { data: turns }] = await Promise.all([
    supabase
      .from('interview_state')
      .select('phase, timer_minutes, topics_covered, topics_open, extractions_log, step_tracker')
      .eq('interview_id', interviewId)
      .maybeSingle(),
    supabase
      .from('turns')
      .select('created_at')
      .eq('interview_id', interviewId)
      .order('turn_number', { ascending: true })
      .limit(1),
  ])

  const firstTurnCreated = (turns as Array<{ created_at: string }> | null)?.[0]?.created_at
  const timerMinutes = firstTurnCreated
    ? Math.floor((Date.now() - new Date(firstTurnCreated).getTime()) / 60000)
    : 0

  return {
    phase: ((stateRow as Record<string, unknown> | null)?.phase ?? 'intro') as Phase,
    timerMinutes,
    topicsCovered: ((stateRow as Record<string, unknown> | null)?.topics_covered as string[]) ?? [],
    topicsOpen: ((stateRow as Record<string, unknown> | null)?.topics_open as string[]) ?? [],
    extractionsLog:
      ((stateRow as Record<string, unknown> | null)?.extractions_log as RawExtraction[]) ?? [],
    stepTracker:
      ((stateRow as Record<string, unknown> | null)?.step_tracker as StepEntry[]) ?? [],
  }
}

async function loadAnalystBriefing(interviewId: string): Promise<AnalystBriefing | null> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('interviews')
    .select('next_briefing')
    .eq('id', interviewId)
    .single()
  return (data?.next_briefing as AnalystBriefing | null) ?? null
}

async function loadHistory(interviewId: string): Promise<TurnMessage[]> {
  const supabase = getSupabaseAdmin()
  const { data: rows } = await supabase
    .from('turns')
    .select('user_input, agent_response')
    .eq('interview_id', interviewId)
    .order('turn_number', { ascending: true })

  return (
    (rows as Array<{ user_input: string; agent_response: string }> | null) ?? []
  ).flatMap(t => [
    { role: 'user' as const, content: t.user_input },
    { role: 'assistant' as const, content: t.agent_response },
  ])
}

// ─── Clarification helpers (PROJ-23) ─────────────────────────────────────────

// Slot answer maps (mirror of POST /clarification route)
const FREQUENCY_MAP: Record<string, number> = { 'Täglich': 22, 'Wöchentlich': 4, 'Mehrfach/Monat': 8, 'Monatlich': 1 }
const DURATION_MAP: Record<string, number> = { '< 5 Min': 3, '5–15 Min': 10, '15–30 Min': 22, '> 30 Min': 45 }
const RULE_BASED_MAP: Record<string, boolean> = { 'Immer gleich': true, 'Meistens gleich': true, 'Variiert stark': false }
const ERROR_RATE_MAP: Record<string, number> = { 'Selten Fehler': 2, 'Gelegentlich': 10, 'Häufig': 30 }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Deterministic synthetic answers for each card type
function buildSyntheticClarificationAnswers(cards: ClarificationCard[]): Array<{ process_step_id: string; slot_key: string; answer: string | string[] }> {
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

async function executeClarificationCompletion(
  interviewId: string,
  workspaceId: string,
  answers: Array<{ process_step_id: string; slot_key: string; answer: string | string[] }>,
): Promise<void> {
  const supabase = getSupabaseAdmin()

  // Persist clarification_answers
  const clarificationRecord: Record<string, string | string[]> = {}
  for (const a of answers) clarificationRecord[`${a.process_step_id}__${a.slot_key}`] = a.answer
  await supabase
    .from('interviews')
    .update({ clarification_answers: clarificationRecord as unknown as import('@/lib/database.types').Json })
    .eq('id', interviewId)

  // Process SlotCards → update process_steps
  const SLOT_KEYS = ['frequency_per_month', 'duration_minutes', 'rule_based', 'error_rate_percent']
  for (const a of answers) {
    if (!SLOT_KEYS.includes(a.slot_key) || typeof a.answer !== 'string' || a.answer === 'Weiß ich nicht') continue
    const update: ProcessStepUpdate = {}
    if (a.slot_key === 'frequency_per_month' && FREQUENCY_MAP[a.answer] !== undefined) update.frequency_per_month = FREQUENCY_MAP[a.answer]
    else if (a.slot_key === 'duration_minutes' && DURATION_MAP[a.answer] !== undefined) update.duration_minutes = DURATION_MAP[a.answer]
    else if (a.slot_key === 'rule_based' && RULE_BASED_MAP[a.answer] !== undefined) update.rule_based = RULE_BASED_MAP[a.answer]
    else if (a.slot_key === 'error_rate_percent' && ERROR_RATE_MAP[a.answer] !== undefined) update.error_rate_percent = ERROR_RATE_MAP[a.answer]
    if (Object.keys(update).length === 0) continue
    const isUuid = UUID_RE.test(a.process_step_id)
    if (isUuid) {
      await supabase.from('process_steps').update(update).eq('id', a.process_step_id).eq('interview_id', interviewId)
    } else {
      await supabase.from('process_steps').update(update).eq('title', a.process_step_id).eq('interview_id', interviewId)
    }
  }

  // Process OpenItemCards (Ja/Manchmal) → insert knowledge_objects
  for (const a of answers) {
    if (a.slot_key !== 'open_item' || typeof a.answer !== 'string') continue
    if (a.answer !== 'Ja' && a.answer !== 'Manchmal') continue
    await supabase.from('knowledge_objects').insert({
      interview_id: interviewId,
      workspace_id: workspaceId,
      type: 'process_step',
      content: { title: a.process_step_id, confirmed_via: 'clarification', answer: a.answer },
    })
  }

  // Complete interview + post-completion pipeline
  await supabase.from('interviews').update({ status: 'completed', extractions_pending: true }).eq('id', interviewId)
  try {
    await createProcessStepsFromTracker({ interviewId, workspaceId })
  } catch (err) {
    console.error('[runner] clarification createProcessStepsFromTracker failed:', err)
  }
  clusterProcessSteps(workspaceId).catch(err => console.error('[runner] clarification clusterProcessSteps failed:', err))
  deduplicateKnowledgeObjects(workspaceId).catch(err => console.error('[runner] clarification deduplicateKnowledgeObjects failed:', err))
}

// ─── Persona simulator ────────────────────────────────────────────────────────

async function generatePersonaResponse(
  persona: Persona,
  agentText: string,
  history: { role: 'user' | 'assistant'; content: string }[],
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
      const event = JSON.parse(line) as { blocked?: boolean; overwrite?: boolean }
      if (event.blocked) {
        blockedWrites++
      } else if (event.overwrite) {
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
}): string {
  const {
    model, personaName, interviewId, evalRunId, baselineLabel,
    turns, finalStepTracker, interviewStatus, scores, trailMetrics,
  } = opts

  const testerModel = process.env.TESTER_MODEL ?? 'google/gemini-3.1-flash-lite'
  const talkerModel = process.env.INTERVIEW_TALKER_MODEL ?? process.env.INTERVIEW_MODEL ?? 'google/gemini-3.1-flash-lite'
  const analystModel = process.env.INTERVIEW_ANALYST_MODEL ?? process.env.INTERVIEW_MODEL ?? 'google/gemini-3.5-flash'
  const evalDate = new Date().toISOString().slice(0, 10)
  const langfuseSession = process.env.LANGFUSE_PROJECT_URL
    ? `${process.env.LANGFUSE_PROJECT_URL}/sessions/${interviewId}`
    : null
  // F6: PASS gate retuned — completionCorrectness alone is too weak.
  // Real PASS requires: all steps registered, naturalness solid, no churn,
  // phases progressed cleanly. Otherwise FAIL surfaces regressions explicitly.
  const passed =
    scores.completionCorrectness === true &&
    scores.stepRegistrationCoverage >= 0.8 &&
    scores.dialogNaturalness >= 0.7 &&
    scores.phaseProgression >= 0.8 &&
    (trailMetrics?.blockedRate ?? 0) < 0.1
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
    `  tool_call_plausibility: ${scores.toolCallPlausibility}`,
    `  dialog_naturalness: ${scores.dialogNaturalness}`,
    `  completion_correctness: ${scores.completionCorrectness}`,
    `  step_registration_coverage: ${scores.stepRegistrationCoverage}`,
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
    `| tool_call_plausibility | ${scores.toolCallPlausibility} | ≥ 0.80 |`,
    `| dialog_naturalness | ${scores.dialogNaturalness} | maximize |`,
    `| completion_correctness | ${scores.completionCorrectness} | true |`,
    `| step_registration_coverage | ${scores.stepRegistrationCoverage} | 1.0 |`,
    trailMetrics ? `| blocked_rate | ${trailMetrics.blockedRate} | < 0.10 |` : null,
    trailMetrics ? `| overwrite_churn | ${trailMetrics.overwriteChurn} | < 0.20 |` : null,
    '',
  ].filter(l => l !== null).join('\n')

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

  return [frontmatter, scoreTable, conversationLog, slotTable].join('\n')
}

function buildSlotTable(stepTracker: StepEntry[]): string {
  if (stepTracker.length === 0) return ''

  const header = [
    '## Slot-Filling-Stand',
    '',
    '| Schritt | Status | frequency | duration | rule_based | data_sources | error_rate | media_breaks |',
    '|---------|--------|-----------|----------|------------|--------------|------------|--------------|',
  ]

  const rows = stepTracker.map(step => {
    const f = (s: StepEntry['slots'][keyof StepEntry['slots']]) =>
      s ? `${String(s.value).slice(0, 30)} ✓` : 'null'
    return `| ${step.title} | ${step.status} | ${f(step.slots.frequency_per_month)} | ${f(step.slots.duration_minutes)} | ${f(step.slots.rule_based)} | ${f(step.slots.data_sources)} | ${f(step.slots.error_rate_percent)} | ${f(step.slots.media_breaks)} |`
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
}): string {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10)
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-')

  const dir = path.resolve(process.cwd(), 'docs', 'evals', 'interview', dateStr)
  fs.mkdirSync(dir, { recursive: true })

  const filename = `${dateStr}-${timeStr}-${modelSlug(opts.model)}-${opts.personaName}.md`
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
  const transcriptFilename = `${dateStr}-${timeStr}-${modelSlug(opts.model)}-${opts.personaName}.transcript.json`
  fs.writeFileSync(path.join(dir, transcriptFilename), JSON.stringify(transcriptData, null, 2), 'utf8')

  return filepath
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
    { name: 'tool_call_plausibility', value: scores.toolCallPlausibility, dataType: 'NUMERIC' },
    { name: 'dialog_naturalness', value: scores.dialogNaturalness, dataType: 'NUMERIC' },
    { name: 'completion_correctness', value: scores.completionCorrectness ? 1 : 0, dataType: 'BOOLEAN' },
    { name: 'step_registration_coverage', value: scores.stepRegistrationCoverage, dataType: 'NUMERIC' },
  ]

  for (const entry of scoreEntries) {
    lf.score({ traceId: trace.id, name: entry.name, value: entry.value, dataType: entry.dataType })
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
): Promise<InterviewResult> {
  // Override INTERVIEW_MODEL for this run
  process.env.INTERVIEW_MODEL = model

  const evalRunId = randomUUID()
  const supabase = getSupabaseAdmin()

  const workspaceId = process.env.EVAL_WORKSPACE_ID
  if (!workspaceId) throw new Error('[runner] EVAL_WORKSPACE_ID not set in .env.local')

  // Activate slot-write trail for this eval run (ADR-015)
  const now = new Date()
  const evalDateStr = now.toISOString().slice(0, 10)
  const evalTimeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-')
  const runDir = path.resolve(process.cwd(), 'docs', 'evals', 'interview', evalDateStr)
  fs.mkdirSync(runDir, { recursive: true })
  process.env.SLOT_TRAIL_FILE = path.join(runDir, `${evalDateStr}-${evalTimeStr}-${modelSlug(model)}-${personaName}.slot-trail.jsonl`)

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`[eval] model=${model} persona=${personaName} evalRunId=${evalRunId}`)

  // Create interview record
  const { data: interview, error: insertError } = await supabase
    .from('interviews')
    .insert({
      workspace_id: workspaceId,
      employee_name: persona.identity.name,
      employee_role: persona.identity.role,
      department: persona.identity.department,
      focus_topics: persona.processKnowledge.processes.map(p => p.name).join(', ') || null,
      status: 'active',
      access_token: randomUUID(),
      token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      max_duration_minutes: 30,
    })
    .select('id')
    .single()

  if (insertError || !interview) throw new Error(`[runner] Interview insert failed: ${insertError?.message}`)

  const interviewId: string = interview.id
  console.log(`[eval] Interview created: ${interviewId}`)

  await supabase.from('interview_state').insert({
    interview_id: interviewId,
    phase: 'intro',
    timer_minutes: 0,
    topics_covered: [],
    topics_open: [],
    extractions_log: [],
    step_tracker: [],
  })

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
  const startStream = createTalkerStream({
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
      await supabase.from('interview_state').update({ opener_text: text }).eq('interview_id', interviewId)
    },
  })

  const greeting = await startStream.text
  console.log(`\n[Agent]: ${greeting}`)
  conversationHistory.push({ role: 'assistant', content: greeting })

  // ── Interview loop ─────────────────────────────────────────────────────────
  const MAX_TURNS = 35
  let lastAgentText = greeting

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const personaResponse = await generatePersonaResponse(persona, lastAgentText, conversationHistory)
    console.log(`\n[${persona.identity.name}]: ${personaResponse}`)
    conversationHistory.push({ role: 'user', content: personaResponse })

    const [dbState, dbHistory, analystBriefing] = await Promise.all([
      loadState(interviewId),
      loadHistory(interviewId),
      loadAnalystBriefing(interviewId),
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

    const lifecycle = checkLifecycle(orchCtx, analystBriefing)
    if (lifecycle.shouldComplete) {
      await supabase
        .from('interviews')
        .update({ status: 'completed', extractions_pending: true })
        .eq('id', interviewId)
      console.log('\n[eval] Orchestrator: lifecycle complete:', lifecycle.reason)

      // Mirror post-completion pipeline from chat route
      await createProcessStepsFromTracker({ interviewId, workspaceId })
      clusterProcessSteps(workspaceId).catch((err) =>
        console.error('[runner] post-complete clusterProcessSteps failed:', err),
      )
      deduplicateKnowledgeObjects(workspaceId).catch((err) =>
        console.error('[runner] post-complete deduplicateKnowledgeObjects failed:', err),
      )

      break
    }

    const nextPhaseDecision = decideNextPhase(orchCtx, analystBriefing)
    const orchestratedPhase: Phase =
      nextPhaseDecision === 'completed' ? 'wrap_up' : (nextPhaseDecision as Phase)

    // PROJ-23: Clarification phase — submit synthetic answers and complete
    if (orchestratedPhase === 'clarification') {
      const cards = analystBriefing?.clarification_cards ?? []
      console.log(`\n[eval] Clarification phase: ${cards.length} cards — submitting synthetic answers`)
      // L9: snapshot tracker BEFORE synthetic answers land — used by scorer to
      // measure how much coverage the clarification phase contributes.
      preClarificationSnapshot = JSON.parse(JSON.stringify(dbState.stepTracker)) as StepEntry[]
      const syntheticAnswers = buildSyntheticClarificationAnswers(cards)
      for (const a of syntheticAnswers) {
        console.log(`  [card] ${a.slot_key} → ${JSON.stringify(a.answer)}`)
      }
      await executeClarificationCompletion(interviewId, workspaceId, syntheticAnswers)
      console.log('[eval] Clarification complete → interview completed')
      break
    }

    if (orchestratedPhase !== dbState.phase) {
      await supabase
        .from('interview_state')
        .update({ phase: orchestratedPhase, updated_at: new Date().toISOString() })
        .eq('interview_id', interviewId)
    }

    // Fix 1 (ADR-015): Deterministic wrap_up question injection.
    // Mirrors chat/route.ts behaviour for eval runs.
    if (shouldInjectWrapUpQuestion(orchestratedPhase, agentHistory)) {
      const turnNumber = dbHistory.length / 2 + 1
      const agentText = WRAP_UP_QUESTION_TEXT
      console.log(`\n[Agent (injected wrap-up question)]: ${agentText}`)
      await supabase.from('turns').insert({
        interview_id: interviewId,
        turn_number: turnNumber,
        user_input: personaResponse,
        agent_response: agentText,
      })
      conversationHistory.push({ role: 'assistant', content: agentText })
      lastAgentText = agentText
      continue
    }

    // Pre-Talker Quick-Extract — returns fresh tracker when tool calls were made.
    let preTalkerStepTracker = dbState.stepTracker
    if (dbState.stepTracker.length > 0) {
      const currentTurnNumber = dbHistory.length / 2 + 1
      const qeTracker = await runQuickExtract({
        interviewId,
        workspaceId,
        userInput: personaResponse,
        stepTracker: dbState.stepTracker,
        currentTurnNumber,
        traceCtx,
      })
      if (qeTracker !== null) preTalkerStepTracker = qeTracker
    }

    const missingSlotsForCoverageCheck: MissingSlot[] | undefined =
      orchestratedPhase === 'coverage_check' || orchestratedPhase === 'slot_completion'
        ? computeMissingMandatorySlots(preTalkerStepTracker)
        : undefined

    const agentStream = createTalkerStream({
      context: {
        interviewId,
        workspaceId,
        employeeName: persona.identity.name,
        employeeRole: persona.identity.role,
        department: persona.identity.department,
        focusTopics: persona.processKnowledge.processes.map(p => p.name).join(', ') || null,
        phase: orchestratedPhase,
        timerMinutes: simulatedTimerMinutes,
        topicsCovered: dbState.topicsCovered,
        topicsOpen: dbState.topicsOpen,
        extractionsLog: dbState.extractionsLog,
        maxDurationMinutes: 30,
        stepTracker: preTalkerStepTracker,
        missingSlotsForCoverageCheck,
      },
      history: agentHistory,
      briefing: analystBriefing,
      userInput: personaResponse,
      traceCtx,
    })

    const agentText = await agentStream.text

    const turnNumber = dbHistory.length / 2 + 1

    console.log(`\n[Agent]: ${agentText}`)
    conversationHistory.push({ role: 'assistant', content: agentText })
    lastAgentText = agentText

    // Save turn to DB
    const { data: newTurn } = await supabase
      .from('turns')
      .insert({
        interview_id: interviewId,
        turn_number: turnNumber,
        user_input: personaResponse,
        agent_response: agentText,
      })
      .select('id')
      .single()

    if (newTurn?.id) {
      const transcript: TurnTranscript[] = [
        ...dbHistory
          .filter((_, i) => i % 2 === 0)
          .map((u, i) => ({
            user_input: u.content,
            agent_response: dbHistory[i * 2 + 1]?.content ?? '',
          })),
        { user_input: personaResponse, agent_response: agentText },
      ]
      extractAndEmbed({ interviewId, workspaceId, turnId: newTurn.id, transcript, traceCtx }).catch(
        err => console.error('[runner] extractAndEmbed failed:', err),
      )
    }

    // Run Analyst every turn — Talker has zero tools so no duplicate step_tracker entries.
    // Reload state so Analyst sees fresh DB after Talker streamed + turn was saved.
    // next_briefing written here is picked up by loadAnalystBriefing at the start of the next turn.
    // Simulate elapsed time proportionally to turn count (eval runs in seconds, real timer stays ~0).
    let analystToolCalls: AnalystToolCallRecord[] = []
    {
      const freshAnalystState = await loadState(interviewId)
      const analystResult = await runAnalyst({
        context: {
          interviewId,
          workspaceId,
          employeeName: persona.identity.name,
          employeeRole: persona.identity.role,
          department: persona.identity.department,
          focusTopics: persona.processKnowledge.processes.map(p => p.name).join(', ') || null,
          phase: orchestratedPhase,
          timerMinutes: simulatedTimerMinutes,
          topicsCovered: freshAnalystState.topicsCovered,
          topicsOpen: freshAnalystState.topicsOpen,
          extractionsLog: freshAnalystState.extractionsLog,
          maxDurationMinutes: 30,
          stepTracker: freshAnalystState.stepTracker,
        },
        history: [...agentHistory, { role: 'assistant', content: agentText }],
        traceCtx,
      }).catch(err => { console.error('[runner] runAnalyst failed:', err); return null })
      analystToolCalls = analystResult?.toolCalls ?? []

      // Log tool calls for eval debugging
      if (analystToolCalls.length > 0) {
        console.log(`  [analyst tools] ${analystToolCalls.map(tc => tc.toolName).join(', ')}`)
      }
    }

    turnRecords.push({
      turnNumber,
      userInput: personaResponse,
      agentText,
      phase: orchestratedPhase,
      toolCalls: analystToolCalls,
    })

    const { data: iv } = await supabase
      .from('interviews')
      .select('status')
      .eq('id', interviewId)
      .single()
    if ((iv as { status: string } | null)?.status === 'completed') {
      console.log('\n[eval] Interview completed.')
      break
    }
  }

  // Load final state for scorers
  const finalState = await loadState(interviewId)
  const { data: finalInterview } = await supabase
    .from('interviews')
    .select('status')
    .eq('id', interviewId)
    .single()
  const finalInterviewStatus = (finalInterview as { status: string } | null)?.status ?? 'created'

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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { models, personas, baselineLabel } = parseArgs()

  if (personas.length === 0) {
    console.error('Usage: npm run eval:interview <persona>')
    console.error('       npm run eval:interview -- --models m1,m2 --personas p1,p2')
    console.error(`Available personas: ${Object.keys(PERSONA_MAP).join(', ')}`)
    process.exit(1)
  }

  const unknownPersonas = personas.filter(p => !PERSONA_MAP[p])
  if (unknownPersonas.length > 0) {
    console.error(`Unknown persona(s): ${unknownPersonas.join(', ')}`)
    console.error(`Available: ${Object.keys(PERSONA_MAP).join(', ')}`)
    process.exit(1)
  }

  // Enable Langfuse tracing for all eval runs
  process.env.LANGFUSE_ENABLED = 'true'
  initLangfuse()

  const results: RunSummary[] = []

  for (const model of [...models].sort()) {
    for (const personaName of personas) {
      const persona = await PERSONA_MAP[personaName]()
      try {
        const result = await runInterview(model, persona, personaName, baselineLabel)

        // Flush OTel spans before scoring (ensures traces are in Langfuse)
        await flushLangfuse().catch(() => {})

        const scores = await runAllScorers({
          turns: result.turnRecords,
          finalStepTracker: result.finalStepTracker,
          preClarificationStepTracker: result.preClarificationStepTracker ?? undefined,
          interviewStatus: result.finalInterviewStatus,
          evalModel: model,
          expectedProcessCount: persona.expectedProcessCount,
        })

        const reportPath = writeReport({
          model,
          personaName,
          interviewId: result.interviewId,
          evalRunId: result.evalRunId,
          baselineLabel,
          turns: result.turnRecords,
          finalStepTracker: result.finalStepTracker,
          interviewStatus: result.finalInterviewStatus,
          scores,
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

        results.push({ model, persona: personaName, scores, reportPath })

        console.log(`\n[eval] Done: interview_id=${result.interviewId} eval_run_id=${result.evalRunId}`)
        const projectUrl = process.env.LANGFUSE_PROJECT_URL
        if (projectUrl) {
          console.log(`  Langfuse session: ${projectUrl}/sessions/${result.interviewId}`)
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error(`[runner] Run failed for model=${model} persona=${personaName}:`, err)
        results.push({ model, persona: personaName, scores: null, reportPath: null, error: errMsg })
      }
    }
  }

  if (models.length * personas.length > 1) {
    printSummary(results)
  }

  // Final Langfuse flush
  await flushLangfuse().catch(() => {})
  await new Promise(r => setTimeout(r, 3000))
}

main().catch(err => {
  console.error('[runner] Fatal:', err)
  process.exit(1)
})

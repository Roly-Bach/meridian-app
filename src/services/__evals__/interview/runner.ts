#!/usr/bin/env tsx
/**
 * Eval runner for interview agent benchmarking (PROJ-13).
 *
 * Usage:
 *   INTERVIEW_MODEL=google/gemini-3.5-flash npm run eval:interview buchhalter
 *
 * LANGFUSE_ENABLED is set to true automatically by this runner (process-local).
 * No manual env var needed. Reverts to .env.local value after the process exits.
 *
 * Requires in .env.local:
 *   EVAL_WORKSPACE_ID=<uuid of a workspace in your local DB>
 *   All other standard env vars (Supabase, AI provider keys, Langfuse keys)
 */

import path from 'path'
import { config } from 'dotenv'

// Load .env.local from project root before any other imports that read env vars.
config({ path: path.resolve(process.cwd(), '.env.local') })

import { randomUUID } from 'crypto'
import { generateText } from 'ai'
import { resolveModel } from '@/lib/llm-provider'
import { initLangfuse, flushLangfuse } from '@/lib/langfuse'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  createInterviewStream,
  computeMissingMandatorySlots,
  type Phase,
  type TurnMessage,
  type StepEntry,
  type MissingSlot,
} from '@/services/interviewAgent'
import { extractAndEmbed, type TurnTranscript, type RawExtraction } from '@/services/extraction'
import { type TraceCtx } from '@/services/_telemetry'
import type { Persona } from './personas/types'

// ─── Persona loader ───────────────────────────────────────────────────────────

const PERSONA_MAP: Record<string, () => Promise<Persona>> = {
  buchhalter: async () => (await import('./personas/buchhalter')).buchhalter,
  vertriebler: async () => (await import('./personas/vertriebler')).vertriebler,
  'it-support': async () => (await import('./personas/it-support')).itSupport,
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
  const timerMinutes = firstTurnCreated ? Math.floor((Date.now() - new Date(firstTurnCreated).getTime()) / 60000) : 0

  return {
    phase: ((stateRow as Record<string, unknown> | null)?.phase ?? 'intro') as Phase,
    timerMinutes,
    topicsCovered: ((stateRow as Record<string, unknown> | null)?.topics_covered as string[]) ?? [],
    topicsOpen: ((stateRow as Record<string, unknown> | null)?.topics_open as string[]) ?? [],
    extractionsLog: ((stateRow as Record<string, unknown> | null)?.extractions_log as RawExtraction[]) ?? [],
    stepTracker: ((stateRow as Record<string, unknown> | null)?.step_tracker as StepEntry[]) ?? [],
  }
}

async function loadHistory(interviewId: string): Promise<TurnMessage[]> {
  const supabase = getSupabaseAdmin()
  const { data: rows } = await supabase
    .from('turns')
    .select('user_input, agent_response')
    .eq('interview_id', interviewId)
    .order('turn_number', { ascending: true })

  return ((rows as Array<{ user_input: string; agent_response: string }> | null) ?? []).flatMap(t => [
    { role: 'user' as const, content: t.user_input },
    { role: 'assistant' as const, content: t.agent_response },
  ])
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
    ].join('\n'),
    prompt: historyText
      ? `Bisheriges Gespräch:\n${historyText}\n\nInterviewer sagt gerade: ${agentText}\n\nDeine Antwort als ${persona.identity.name}:`
      : `Interviewer sagt: ${agentText}\n\nDeine Antwort als ${persona.identity.name}:`,
    maxOutputTokens: 300,
  })

  return text.trim()
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const personaName = process.argv[2]
  if (!personaName || !PERSONA_MAP[personaName]) {
    console.error(`Usage: npm run eval:interview <persona>`)
    console.error(`Available personas: ${Object.keys(PERSONA_MAP).join(', ')}`)
    process.exit(1)
  }

  // Enable tracing for this run (override kill-switch for eval)
  process.env.LANGFUSE_ENABLED = 'true'
  initLangfuse()

  const evalRunId = randomUUID()
  const interviewModel = process.env.INTERVIEW_MODEL ?? 'google/gemini-3.1-flash-lite'

  console.log(`[eval] persona=${personaName} model=${interviewModel} evalRunId=${evalRunId}`)

  const persona = await PERSONA_MAP[personaName]()
  const supabase = getSupabaseAdmin()

  const workspaceId = process.env.EVAL_WORKSPACE_ID
  if (!workspaceId) throw new Error('[runner] EVAL_WORKSPACE_ID not set in .env.local')

  // Create interview record
  const { data: interview, error: insertError } = await supabase
    .from('interviews')
    .insert({
      workspace_id: workspaceId,
      employee_name: persona.identity.name,
      employee_role: persona.identity.role,
      department: persona.identity.department,
      focus_topics: persona.processKnowledge.processes.map(p => p.name).join(', ') || null,
      status: 'created',
      access_token: randomUUID(),
      token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      max_duration_minutes: 30,
    })
    .select('id')
    .single()

  if (insertError || !interview) throw new Error(`[runner] Interview insert failed: ${insertError?.message}`)

  const interviewId: string = interview.id
  console.log(`[eval] Interview created: ${interviewId}`)

  // Create initial interview_state
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
    model: interviewModel,
    environment: 'eval',
    evalRunId,
  }

  const conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []

  // ── Start turn (agent greeting, not saved as a turn per spec) ─────────────
  const startStream = createInterviewStream({
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
      await supabase
        .from('interview_state')
        .update({ opener_text: text })
        .eq('interview_id', interviewId)
    },
  })

  const greeting = await startStream.text
  console.log(`\n[Agent]: ${greeting}`)
  conversationHistory.push({ role: 'assistant', content: greeting })

  // ── Interview loop ─────────────────────────────────────────────────────────
  const MAX_TURNS = 25
  let lastAgentText = greeting

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    // Persona responds to last agent turn
    const personaResponse = await generatePersonaResponse(persona, lastAgentText, conversationHistory)
    console.log(`\n[${persona.identity.name}]: ${personaResponse}`)
    conversationHistory.push({ role: 'user', content: personaResponse })

    // Load fresh state from DB (agent tool calls update it during stream)
    const dbState = await loadState(interviewId)
    const dbHistory = await loadHistory(interviewId)

    const missingSlotsForCoverageCheck: MissingSlot[] | undefined =
      dbState.phase === 'coverage_check' || dbState.phase === 'slot_completion'
        ? computeMissingMandatorySlots(dbState.stepTracker)
        : undefined

    // Build history for agent: DB turns + current user turn
    const agentHistory: TurnMessage[] = [
      ...dbHistory,
      { role: 'user', content: personaResponse },
    ]

    // Agent responds
    const agentStream = createInterviewStream({
      context: {
        interviewId,
        workspaceId,
        employeeName: persona.identity.name,
        employeeRole: persona.identity.role,
        department: persona.identity.department,
        focusTopics: persona.processKnowledge.processes.map(p => p.name).join(', ') || null,
        phase: dbState.phase,
        timerMinutes: dbState.timerMinutes,
        topicsCovered: dbState.topicsCovered,
        topicsOpen: dbState.topicsOpen,
        extractionsLog: dbState.extractionsLog,
        maxDurationMinutes: 30,
        stepTracker: dbState.stepTracker,
        missingSlotsForCoverageCheck,
      },
      history: agentHistory,
      userInput: personaResponse,
      traceCtx,
    })

    const agentText = await agentStream.text
    console.log(`\n[Agent]: ${agentText}`)
    conversationHistory.push({ role: 'assistant', content: agentText })
    lastAgentText = agentText

    // Save turn to DB
    const turnNumber = dbHistory.length / 2 + 1
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

    // Fire-and-forget extraction (non-blocking, traceCtx carries eval tags)
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
      extractAndEmbed({
        interviewId,
        workspaceId,
        turnId: newTurn.id,
        transcript,
        traceCtx,
      }).catch(err => console.error('[runner] extractAndEmbed failed:', err))
    }

    // Check for completion
    const { data: iv } = await supabase
      .from('interviews')
      .select('status')
      .eq('id', interviewId)
      .single()
    if ((iv as { status: string } | null)?.status === 'completed') {
      console.log('\n[eval] Interview completed by agent.')
      break
    }

    // Failsafe: detect farewell text
    if (agentText.includes('complete_interview') || agentText.toLowerCase().includes('viel erfolg')) {
      await supabase.from('interviews').update({ status: 'completed' }).eq('id', interviewId)
      console.log('\n[eval] Farewell detected — marking completed.')
      break
    }
  }

  // Flush pending spans before exit
  await flushLangfuse().catch(() => {})
  await new Promise(r => setTimeout(r, 3000))

  console.log(`\n[eval] Done.`)
  console.log(`  interview_id (session): ${interviewId}`)
  console.log(`  eval_run_id:            ${evalRunId}`)
  const projectUrl = process.env.LANGFUSE_PROJECT_URL
  if (projectUrl) {
    console.log(`  Langfuse session:       ${projectUrl}/sessions/${interviewId}`)
    console.log(`  Langfuse traces:        ${projectUrl}/traces?search=${interviewId}`)
  } else {
    console.log(`  (Set LANGFUSE_PROJECT_URL=https://cloud.langfuse.com/<org>/<project> in .env.local for direct links)`)
  }
}

main().catch(err => {
  console.error('[runner] Fatal:', err)
  process.exit(1)
})

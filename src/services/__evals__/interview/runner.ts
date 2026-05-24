#!/usr/bin/env tsx
/**
 * Eval runner for the Meridian interview agent.
 *
 * Usage: npm run eval:interview [-- --persona buchhalter|vertriebler|it-support]
 *
 * Prerequisites:
 *  - npm run dev running on localhost:3000
 *  - A test workspace and interview created in the local DB
 *  - TEST_INTERVIEW_TOKEN and TEST_WORKSPACE_ID set in .env.local
 */

import { buchhalter } from './personas/buchhalter'
import { vertriebler } from './personas/vertriebler'
import { itSupport } from './personas/it-support'
import { computeMetrics } from './metrics'
import { generateReport } from './report'
import type { Persona } from './personas/buchhalter'
import type { StepEntry } from '../../interviewAgent'

const BASE_URL = process.env.EVAL_BASE_URL ?? 'http://localhost:3000'
const MAX_TURNS = 25
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Persona selection ────────────────────────────────────────────────────────

const PERSONAS: Record<string, Persona> = {
  buchhalter,
  vertriebler,
  'it-support': itSupport,
}

function selectPersona(): Persona {
  const arg = process.argv.find((a) => a.startsWith('--persona='))?.split('=')[1]
    ?? process.argv[process.argv.indexOf('--persona') + 1]
  return PERSONAS[arg ?? 'buchhalter'] ?? buchhalter
}

// ── Persona response selector ─────────────────────────────────────────────────

function selectPersonaResponse(persona: Persona, agentText: string): string {
  const text = agentText.toLowerCase()

  if (text.includes('wie oft') || text.includes('häufigkeit') || text.includes('monat')) {
    const probe = text.includes('täglich') || text.includes('wöchentlich')
    return probe
      ? (persona.responses['frequency_probe'] ?? persona.responses['frequency'])
      : persona.responses['frequency']
  }
  if (text.includes('wie lange') || text.includes('dauer') || text.includes('minuten')) {
    const probe = text.includes('glatt') || text.includes('hakt')
    return probe
      ? (persona.responses['duration_probe'] ?? persona.responses['duration'])
      : persona.responses['duration']
  }
  if (text.includes('immer gleich') || text.includes('reihenfolge') || text.includes('regel') || text.includes('checkliste')) {
    return persona.responses['rule_based_probe'] ?? persona.responses['rule_based']
  }
  if (text.includes('system') || text.includes('tool') || text.includes('software') || text.includes('daten')) {
    return persona.responses['data_sources']
  }
  if (text.includes('schief') || text.includes('fehler') || text.includes('nacharbeiten')) {
    return persona.responses['error_rate']
  }
  if (text.includes('wechsel') || text.includes('kopieren') || text.includes('übertragen') || text.includes('manuell')) {
    return persona.responses['media_breaks_probe'] ?? persona.responses['media_breaks']
  }
  if (text.includes('problem') || text.includes('aufwändig') || text.includes('ändern') || text.includes('schmerz')) {
    return persona.responses['bottleneck']
  }
  if (text.includes('zusammenfass') || text.includes('stundensatz') || text.includes('danke')) {
    return persona.responses['wrap_up']
  }
  if (text.includes('erzählen') || text.includes('konkreten fall') || text.includes('typischen')) {
    return persona.responses['process_question']
  }

  return persona.responses['default']
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function sendMessage(token: string, userInput: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/interview/${token}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_input: userInput }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Chat API ${res.status}: ${err}`)
  }

  // Collect streaming text response
  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')
  const decoder = new TextDecoder()
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    text += decoder.decode(value, { stream: true })
  }
  return text.trim()
}

async function fetchStepTracker(interviewId: string): Promise<StepEntry[]> {
  // Reads step_tracker via Supabase REST (requires service role key in env)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.warn('[runner] SUPABASE env vars not set — step_tracker cannot be fetched')
    return []
  }

  const res = await fetch(
    `${supabaseUrl}/rest/v1/interview_state?interview_id=eq.${interviewId}&select=step_tracker`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  )
  const rows = await res.json() as Array<{ step_tracker: StepEntry[] }>
  return rows[0]?.step_tracker ?? []
}

async function fetchCounts(interviewId: string, _workspaceId: string): Promise<{ bottlenecks: number; useCases: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) return { bottlenecks: 0, useCases: 0 }
  if (!UUID_RE.test(interviewId)) throw new Error(`TEST_INTERVIEW_ID is not a valid UUID: ${interviewId}`)

  const authHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }

  const [koRes, psRes] = await Promise.all([
    fetch(
      `${supabaseUrl}/rest/v1/knowledge_objects?interview_id=eq.${interviewId}&type=eq.pain_point&select=id`,
      { headers: { ...authHeaders, Prefer: 'count=exact' } }
    ),
    fetch(
      `${supabaseUrl}/rest/v1/process_steps?interview_id=eq.${interviewId}&select=id`,
      { headers: authHeaders }
    ),
  ])

  const bottleneckHeader = koRes.headers.get('content-range') ?? ''
  const parseCount = (h: string) => {
    const m = h.match(/\/(\d+)$/)
    return m ? parseInt(m[1], 10) : 0
  }

  const processStepIds: string[] = ((await psRes.json()) as Array<{ id: string }>).map((r) => r.id)
  let useCases = 0
  if (processStepIds.length > 0) {
    const ucRes = await fetch(
      `${supabaseUrl}/rest/v1/use_cases?process_step_id=in.(${processStepIds.map(encodeURIComponent).join(',')})&select=id`,
      { headers: { ...authHeaders, Prefer: 'count=exact' } }
    )
    useCases = parseCount(ucRes.headers.get('content-range') ?? '')
  }

  return {
    bottlenecks: parseCount(bottleneckHeader),
    useCases,
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const persona = selectPersona()
  const token = process.env.TEST_INTERVIEW_TOKEN
  const interviewId = process.env.TEST_INTERVIEW_ID
  const workspaceId = process.env.TEST_WORKSPACE_ID

  if (!token || !interviewId || !workspaceId) {
    console.error(
      'Missing env vars: TEST_INTERVIEW_TOKEN, TEST_INTERVIEW_ID, TEST_WORKSPACE_ID\n' +
      'Create a test interview in the local DB and set these in .env.local'
    )
    process.exit(1)
  }

  console.log(`\n=== Eval: ${persona.name} (${persona.role}) ===\n`)

  const transcript: Array<{ role: string; content: string }> = []
  let turnCount = 0
  let finished = false

  // Kick off with initial greeting
  let userInput = persona.responses['default']

  while (!finished && turnCount < MAX_TURNS) {
    turnCount++
    console.log(`[Turn ${turnCount}] User: ${userInput.slice(0, 80)}...`)
    transcript.push({ role: 'user', content: userInput })

    let agentText: string
    try {
      agentText = await sendMessage(token, userInput)
    } catch (err) {
      console.error(`[Turn ${turnCount}] Error:`, err)
      break
    }

    console.log(`[Turn ${turnCount}] Agent: ${agentText.slice(0, 120)}...\n`)
    transcript.push({ role: 'assistant', content: agentText })

    // Detect interview completion
    if (agentText.toLowerCase().includes('vielen dank') && turnCount > 5) {
      finished = true
      break
    }

    // Select next persona response based on agent question
    userInput = selectPersonaResponse(persona, agentText)
  }

  console.log(`\n=== Interview complete (${turnCount} turns) ===\n`)

  // Fetch final state for metrics
  const stepTracker = await fetchStepTracker(interviewId)
  const { bottlenecks, useCases } = await fetchCounts(interviewId, workspaceId)
  const metrics = computeMetrics(stepTracker, bottlenecks, useCases)

  console.log('Metrics:', JSON.stringify(metrics, null, 2))

  generateReport(persona, metrics, transcript)

  if (!metrics.passesOutputContract) {
    console.error('\n❌ Output contract NOT met. See report for details.')
    process.exit(1)
  }

  console.log('\n✅ Output contract passed.')
}

run().catch((err) => {
  console.error('Eval failed:', err)
  process.exit(1)
})

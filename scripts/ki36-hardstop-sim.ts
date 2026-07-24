#!/usr/bin/env tsx
/**
 * KI-36 Hard-Stop-Simulation — replays the REAL Sayang interview turn-by-turn
 * (verbatim user_input, PGlite-backed, no Supabase writes) through the real
 * runInterviewTurn() code path, forcing timerMinutes to reproduce the exact
 * hard-stop trigger observed in production (max_duration_minutes=10, turn 8,
 * interview 64c4bae1-393e-484d-8745-a894032f3a35, 2026-07-24).
 *
 * Verifies the KI-36 fix end-to-end with a real LLM call: does the hard-stop-
 * triggering turn produce a clean farewell (no further open question) instead
 * of the unanswerable question from the original bug? Re-run this after any
 * future change to resolveTurnLifecycle's hard-stop branch or talkerPrompt.ts's
 * clarification methodology to catch a regression of the same shape.
 *
 * Not part of the build or CI — a manual verification tool (same category as
 * scripts/judge-preflight.ts). Costs a handful of real Talker/Analyst LLM
 * calls (~9 turns) against INTERVIEW_MODEL from .env.local.
 *
 * Run: npx tsx --conditions react-server scripts/ki36-hardstop-sim.ts
 */

import path from 'path'
import { config } from 'dotenv'
config({ path: path.resolve(process.cwd(), '.env.local') })

import { createTalkerStream } from '@/services/interviewTalker'
import { runInterviewTurn } from '@/services/runInterviewTurn'
import { createEvalStore } from '@/services/__evals__/interview/evalStore'

// Verbatim from Supabase (interview 64c4bae1-393e-484d-8745-a894032f3a35, 2026-07-24).
// timerMinutes mirrors the real elapsed-minute values at each turn's completion
// (floor((created_at - firstTurnCreatedAt)/60000)) — turn 8 lands at >= 10,
// exactly reproducing the real hard-stop trigger.
const SAYANG_TURNS: { userInput: string; timerMinutes: number }[] = [
  { timerMinutes: 0, userInput: 'Active Sourcing (Kandidaten auf Linkedin finden und anschreiben), Stellenausschreibungen bearbeiten mit Head of Departments, Aufsetzen der Jobausschreibungen auf Linkedin, Indeed und Jopportal, diese ausscreibungen regelmäßig kontrollieren, Candidate journey von erstem Interview (mit mir), tests, personality tests und zweiten interviews, offer machen, onboarding' },
  { timerMinutes: 1, userInput: 'Wenn der Candidate flow schlecht ist, bzw wir nicht genug relevante kandidaten durch die stellenausschreibung kriegen. Oftmals in senior positionen oder finance' },
  { timerMinutes: 2, userInput: 'Kommt auf die Stelle an. In Finance gibt es sehr bestimme Kriterien (z.b. Abschluss von gewissen Prüfungen), in anderen Stellen kann es nach relevanter vorerfahrung in der ecommerce oder event industrie sein. Andererseits schauen wir auch oft nach leuten bei denen wir sehen dass sie potentiall zum wachsen haben aber zb seit einigen jahren keine promotion bekommen haben.' },
  { timerMinutes: 4, userInput: 'Ich habe relativ hohen Spielraum, vor allem wenn es um kandidaten im sales oder event bereich geht. da gibt es viele verschiedene wege auf denen man zu kandidaten kommen kann die nicht straightforward sind. Man kann aber auch sagen, dass es auf den manager kommt. manche manager sind festgefahrener als andere' },
  { timerMinutes: 5, userInput: 'Nein, meist ändert das nichts am vorgehen des active sourcing. Es ändert lediglich die filter die ich bei Linkedin angebe' },
  { timerMinutes: 7, userInput: 'wir nutzen linkedin recuriter. Dort kann man die kandidaten sehr präzise filtern nach Ort, abschluss, erfahrung, companies etc. wir spielen mit den filtern immer ein wenig um verschiedene kandidaten zu finden. Z.b. spielen wir mit dem ortsfilter und fangen immer im näheren umkreis und bewegen uns dann weiter entfernt. Teilweise approachen wir auch direkt bei der konkurrenz' },
  { timerMinutes: 8, userInput: 'Die Qualität ist bei diesen kandidaten sehr hoch. Wenn wir es schaffen eine antwort und ein erstes gesrpäch mit dem kandidaten zu kriegen, schaffen diese kandidaten es häufiger in dei letzte runde, da wir sie schon vorgefiltert haben' },
  // Turn 8 in production: real answer to turn 7's question, timerMinutes already
  // >= maxDurationMinutes(10) at request start — THIS is the hard-stop trigger.
  { timerMinutes: 10, userInput: 'Sehr viel. Active Sourcing ist oft nicht ganz effizient. Teilweise habe ich bis zu sechs stunden am tag verbracht mit kandidaten finden und anschreiben. Man versucht auch verschiedene texte um die aufmerksamkeit zu erzeugen. Wenn es eine position ist in der wir aktiv active sourcing machen gehen schon 20-30 stunden aufs active sourcing' },
]

async function main() {
  const evalStore = await createEvalStore('pglite')
  const { interviewId, workspaceId } = await evalStore.createInterview({
    employeeName: 'Sayang',
    employeeRole: 'Recruiter',
    department: 'HR',
    focusTopics: null,
    maxDurationMinutes: 10, // real production config for this interview
  })

  console.log(`[sim] interview ${interviewId} created, maxDurationMinutes=10\n`)

  // ── Start turn (greeting) — mirrors chat/route.ts's cold-start /start call ──
  const startStream = await createTalkerStream({
    context: {
      interviewId,
      workspaceId,
      employeeName: 'Sayang',
      employeeRole: 'Recruiter',
      department: 'HR',
      focusTopics: null,
      phase: 'intro',
      timerMinutes: 0,
      topicsCovered: [],
      topicsOpen: [],
      extractionsLog: [],
      maxDurationMinutes: 10,
      stepTracker: [],
    },
    history: [],
    isStart: true,
    onFinish: async (text) => {
      if (!text) return
      await evalStore.saveOpenerText(interviewId, text)
    },
  })
  const greeting = await startStream.text
  console.log(`[Agent/opener]: ${greeting}\n`)

  let lastResult: Awaited<ReturnType<typeof runInterviewTurn>> | null = null

  for (let i = 0; i < SAYANG_TURNS.length; i++) {
    const { userInput, timerMinutes } = SAYANG_TURNS[i]
    const turnNum = i + 1
    console.log(`\n=== Turn ${turnNum} (timerMinutes=${timerMinutes}) ===`)
    console.log(`[Sayang]: ${userInput}`)

    lastResult = await runInterviewTurn(
      { interviewId, userInput, timerMinutes },
      evalStore.turnPorts,
    )
    const agentText = await lastResult.stream.text
    await lastResult.finalize().catch((err) => console.error('[sim] finalize failed:', err))

    console.log(`[Agent]: ${agentText}`)
    console.log(`[meta] phase=${lastResult.meta.phase} completed=${lastResult.meta.completed} reason=${lastResult.meta.reason}`)

    if (turnNum === SAYANG_TURNS.length) {
      // ── Hard-stop turn — the KI-36 assertion ──────────────────────────────
      const briefing = await evalStore.loadAnalystBriefing(interviewId)
      const cards = briefing?.clarification_cards ?? []
      console.log(`\n[sim] clarification_cards attached: ${cards.length}`)
      for (const c of cards) console.log(`  - [${c.process_step_id}] ${c.slot_key}: ${c.question}`)

      const looksLikeFarewell = /verabschied|danke|vielen dank|schönen tag|alles gute/i.test(agentText)
      const asksOpenQuestion = /\?\s*$/.test(agentText.trim())
      const mentionsInterfaceCards = /abschlussfragen|interface/i.test(agentText)

      console.log(`\n[sim] === KI-36 VERDICT ===`)
      console.log(`  phase === 'clarification': ${lastResult.meta.phase === 'clarification'}`)
      console.log(`  cards attached (>0):        ${cards.length > 0}`)
      console.log(`  reads as farewell:          ${looksLikeFarewell}`)
      console.log(`  mentions Abschlussfragen:    ${mentionsInterfaceCards}`)
      console.log(`  ends in an open question:   ${asksOpenQuestion}  (should be FALSE)`)
      const pass = lastResult.meta.phase === 'clarification' && cards.length > 0 && !asksOpenQuestion
      console.log(`  ${pass ? '✅ PASS' : '❌ FAIL'} — hard-stop turn is ${pass ? 'answerable-cutoff-free' : 'STILL cutting off an open question'}`)
    }
  }

  await evalStore.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

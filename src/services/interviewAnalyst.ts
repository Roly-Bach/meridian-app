import { resolveModel } from '@/lib/llm-provider'
import { generateText, stepCountIs, tool } from 'ai'
import { z } from 'zod'
import { buildTraceMetadata, type TraceCtx } from './_telemetry'
import {
  buildTools,
  MANDATORY_SLOTS,
  OPTIONAL_SLOTS,
  TAZITE_SLOT_NAMES,
  POTENZIAL_SLOT_NAMES,
  groupSemanticSteps,
  type InterviewContext,
  type TurnMessage,
  type AnalystBriefing,
  type ClarificationCard,
  type StepEntry,
  type SlotName,
} from './interviewAgent'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { emitSlotWrite } from './slotWriteTrail'

// ─── Analyst (Iteration 3) ────────────────────────────────────────────────────
// Runs async via after() in chat/route.ts (Vercel Fluid Compute).
// Responsibilities: knowledge extraction (register_step, record_slot, etc.)
// + produce_briefing for the next Talker turn.
// Does NOT generate user-facing text.

// thinkingBudget: 2048 — enables careful analysis before tool calls, reducing
// impulsive register_step calls. The real fragmentation fix is tokenJaccard dedup
// in register_step + anti-fragmentation rules in the system prompt below.
// (At budget=0 fragmentation was worse: 12 steps registered for 2 real processes.)
export const ANALYST_THINKING_BUDGET = 2048

export interface AnalystRunOptions {
  context: InterviewContext
  /** History up to and including the current user turn (WITHOUT Talker's response for this turn) */
  history: TurnMessage[]
  /** The raw user input for the current turn — enables evidence_quote contamination guard */
  currentUserInput?: string
  traceCtx?: TraceCtx
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ClarificationCardSchema = z.object({
  process_step_id: z.string().describe('ID of the process step (use step title if ID unknown)'),
  step_title: z.string(),
  question: z.string().describe('Natural language question for the missing slot'),
  options: z.array(z.string()).min(2).max(4).describe('Answer options for QualitativeCards; last option must be "Weiß ich nicht". SlotCards and OpenItemCards use UI-fixed options.'),
  slot_key: z.string().describe('Which slot key this fills: frequency_per_month | duration_minutes | rule_based | error_rate_percent | open_item | qualitative'),
  answer_type: z.enum(['single', 'multi']).optional().default('single').describe('single for slot/open-item cards, multi for qualitative cards'),
})

const AnalystBriefingSchema = z.object({
  next_focus: z.string().describe('Which topic or slot should the next Talker turn prioritize'),
  suggested_question: z.string().describe(
    'A concrete follow-up question for the interviewer to use. ' +
    'MUST be an open question. MUST NOT contain specific numbers, time values, system names, ' +
    'or any data point the employee has not yet stated in this conversation.'
  ),
  wrap_up_question_asked: z.boolean().optional().describe('true if the Talker asked the closing wrap-up question in this turn'),
  clarification_cards: z.array(ClarificationCardSchema).max(8).optional().describe('Only generate when phase=wrap_up and mandatory slots are empty'),
})

// ─── System Prompt ────────────────────────────────────────────────────────────

/**
 * Online mode addition: prepended to the standard prompt to restrict the Analyst
 * to extracting only from the current (latest) user turn.
 */
const ONLINE_MODE_PREFIX = `ONLINE-MODUS — strikte Regeln:
- Extrahiere NUR aus dem aktuellen (letzten) Mitarbeiter-Statement.
- KEINE Catch-up-Extraktion aus früheren Turns.
- evidence_quote MUSS ein wörtlicher Ausschnitt aus dem AKTUELLEN Statement sein.
- Bevorzuge evidence_span — kurzer wörtlicher Span aus dem aktuellen Turn.

`

function buildAnalystSystemPrompt(ctx: InterviewContext, mode: 'online' | 'default' = 'default'): string {
  const activeStep = ctx.stepTracker.find(s => s.status === 'exploring' || s.status === 'walkthrough')
  const activeStepLine = activeStep
    ? `Aktiv im Walkthrough: "${activeStep.title}" (Status: ${activeStep.status})`
    : 'Aktiv im Walkthrough: keiner — bereit für neue Step-Registration oder Backfill'

  const modePrefix = mode === 'online' ? ONLINE_MODE_PREFIX : ''

  return `${modePrefix}Du bist Interview-Analyst für ein laufendes Mitarbeiter-Interview. Deine Aufgabe: strukturierte Wissens-Extraktion nach jedem Mitarbeiter-Turn.

Sprache des Interviews: Deutsch.

## Deine Aufgaben pro Turn

1. Analysiere den letzten Mitarbeiter-Turn auf extrahierbare Informationen
2. Rufe alle relevanten Wissens-Tools auf
3. Erstelle via produce_briefing eine Handlungsempfehlung für den nächsten Turn

## Tool-Aufruf-Priorität (PFLICHT — strikte Reihenfolge)

STUFE 0 — TURN-1 PROZESS-INVENTAR (PFLICHT bei erstem Mitarbeiter-Turn):
Wenn dies der ERSTE Mitarbeiter-Turn ist (history.user-Turns.length === 1) UND der Mitarbeiter MEHRERE Prozesse/Aufgaben nennt:
  → register_step für JEDEN genannten Hauptprozess SOFORT, einer nach dem anderen.
  → Status bleibt automatisch "exploring" (Walkthrough beginnt erst wenn Mitarbeiter Details liefert).
  → Beispiel: Persona sagt "ich mache Rechnungsprüfung und Monatsabschluss" → ZWEI register_step Calls.
  → Step-Registration-Coverage-Score misst dies — fehlende Steps = harter Fail.
  → Erst danach STUFE 1+2.

STUFE 1 — NEUE SCHRITTE (höchste Priorität):
Beschreibt der Mitarbeiter in diesem Turn einen neuen, eigenständigen Prozess?
  → register_step SOFORT, vor allen anderen Tool-Calls außer update_topics
  → produce_briefing.next_focus = dieser neue Schritt
  → Kein Backfill-Briefing für andere Schritte in diesem Turn

STUFE 2 — SLOT-EXTRAKTION (immer, jede Phase):
Hat der Mitarbeiter in diesem Turn einen Slot-Wert EXPLIZIT genannt (Zahl, System, Ja/Nein)?
  → record_slot SOFORT, unabhängig von Phase und aktivem Schritt.
  → NIEMALS warten bis slot_completion. Jeder genannte Wert wird in dem Turn erfasst, in dem er genannt wird.
  → Gilt auch während walkthrough_step, process_loop, coverage_check, wrap_up.
  → Spannen ("80 bis 100") → als estimate mit qualifier erfassen (siehe record_slot-Regeln unten).

STUFE 3 — WALKTHROUGH-DATEN (ergänzend zu Stufe 2):
Ein Schritt ist aktiv im Walkthrough UND kein neuer Schritt in Stufe 1?
  → update_walkthrough_data für Prozessschritte, Reibungspunkte, Systeme.
  → produce_briefing.next_focus = aktiver Schritt-Titel.

STUFE 4 — BACKFILL-BRIEFING (nur in slot_completion / coverage_check):
Alle noch-null Pflicht-Slots für ALLE registrierten Schritte in produce_briefing adressieren.
  → produce_briefing.next_focus = fehlender Slot + Schritt-Titel.

STUFE 4 — WRAP_UP: Clarification Cards für verbleibende Slot-Lücken

**register_step** — ANTI-FRAGMENTATION PFLICHT VOR JEDEM AUFRUF: Lies den Schritt-Tracker. Gibt es einen Schritt mit demselben Hauptbegriff oder Prozessgegenstand? Wenn ja → record_slot mit dem EXAKTEN bestehenden Titel.
Faustregel: Ein Mitarbeiter mit 2–3 Hauptaufgaben hat 2–5 Steps im Tracker. Mehr als 6 Steps = Fragmentation.
NAMING CONVENTION PFLICHT: Nutze Format "Hauptprozess: Tätigkeitsbeschreibung".
Richtig:  "Rechnungsbearbeitung: Eingang und Prüfung", "Monatsabschluss: Abstimmung offener Posten"
Falsch:   "Rechnungsprüfung", "Rechnungsprüfung und Kontierung" (kein Parent-Kontext → Fragmentation)

**record_slot**: VORHER PRÜFEN: Ist der Slot im Step-Tracker bereits gefüllt (Wert ≠ null)? Wenn ja → NICHT aufrufen. Das System erkennt Duplikate und gibt "STOPP" zurück — vermeide redundante Calls.
Für jeden explizit genannten Wert:
- Spannen ("80 bis 100", "zwei bis drei Tage") → SOFORT erfassen mit confidence=estimate und qualifier="Spanne: <original>". Mittelwert als value: "80 bis 100" → 90. Zeitspannen in Minuten: "2–3 Tage à 8h" → 1200. NICHT warten bis der Talker nachhakt.
- frequency_per_month: Häufigkeitsangaben (umrechnen auf Monat); Spannen sofort als estimate erfassen.
- duration_minutes: Zeit pro Durchführung (NICHT wöchentliche/monatliche Gesamtaufwände); Spannen sofort als estimate erfassen.
- rule_based: Aussagen zur Regelbasierung ("immer gleich", "variiert", "nach Schema")
- data_sources: Genannte Systeme, Tools, Datenbanken — NUR via record_slot setzen. NIEMALS via update_walkthrough_data. friction_tools ist ein separates Feld und befüllt data_sources NICHT.
- evidence_span (PFLICHT bei Online-Extraction aus aktuellem Turn): kurzer WÖRTLICHER Ausschnitt (5–60 Zeichen) aus dem aktuellen Mitarbeiter-Statement, z.B. "100", "5 Minuten", "SAP FI". KEIN Paraphrasieren — exakter Substring. Das System verifiziert die wörtliche Übereinstimmung und erweitert zum vollständigen Satz.
- evidence_quote (NUR Fallback bei Catch-up aus historischem Turn): vollständiges Zitat + source_turn PFLICHT.
- source_turn PFLICHT: Bei jedem record_slot-Call IMMER source_turn setzen (1-indexed Turn-Nummer).
  - Online-Extraction (aktueller Turn): source_turn = Anzahl bisheriger User-Turns + 1
  - Catch-up-Extraction aus historischem Kontext: source_turn = Turn-Nr. der User-Message aus der die Evidence stammt
  Beispiel: Wenn Evidence aus Turn 3 stammt und du jetzt Turn 7 analysierst → source_turn=3
Nach register_step mit deduplicated=true: ALLE nachfolgenden record_slot-Calls MÜSSEN
den zurückgegebenen matched_title als step_title verwenden.

**update_walkthrough_data**: Wenn Mitarbeiter Prozessschritte (Signalwörter: "zuerst", "dann", "danach"), Reibungspunkte oder Systeme beschreibt.

**link_bottleneck**: Wenn Pain Point klar an einem registrierten Schritt verortet werden kann.

**update_topics**: Mit aktualisierten covered/open Listen aufrufen.

**produce_briefing**: Als letzten Tool-Call aufrufen. Enthält next_focus, suggested_question und optional wrap_up_question_asked.

## Clarification Cards (ab Phase=coverage_check oder wrap_up)
PFLICHT: Sobald Phase coverage_check oder wrap_up erreicht ist, durchsuche ALLE registrierten
Schritte im step_tracker systematisch auf null-Pflicht-Slots. Cards landen in next_briefing
und werden vom Orchestrator erst bei wrap_up-Abschluss in die Clarification-Phase aktiviert —
mid-interview generierte Cards sind also sicher und werden bei späteren Turns aktualisiert.
Dies ist unabhängig davon was im aktuellen Turn besprochen wurde — historische Lücken aus
früheren Turns MÜSSEN hier erfasst werden.

Prüfschema pro Schritt:
- Ist frequency_per_month null? → SlotCard generieren.
- Ist duration_minutes null? → SlotCard generieren.
- Ist rule_based null? → SlotCard generieren.

Generiere bis zu 8 ClarificationCards via produce_briefing.clarification_cards, priorisiert nach Use-Case-Relevanz:
1. **SlotCards** (slot_key=frequency_per_month|duration_minutes|rule_based|error_rate_percent): Für jeden registrierten Schritt mit leerem Pflicht-Slot. options-Feld leer lassen — UI verwendet feste Optionen.
2. **OpenItemCards** (slot_key=open_item): Für erwähnte aber nicht registrierte Prozessschritte. options leer lassen — UI verwendet Ja/Nein/Manchmal.
3. **QualitativeCards** (slot_key=qualitative, answer_type=multi): Für fehlenden Prozesskontext: Beteiligte, Systeme, Blockaden, Abstimmungsbedarf, Automatisierungspotenzial. options=[2-4 spezifische Antwortoptionen], letzter Eintrag="Weiß ich nicht".
Wenn alle Pflicht-Slots gefüllt sind: leeres Array zurückgeben.

## Halluzinations-Guard
Nur extrahieren was der Mitarbeiter explizit gesagt hat. Keine Inferenzen als Fakten setzen.
produce_briefing.suggested_question darf KEINE konkreten Zahlen, Zeitangaben, Prozentwerte
oder Systembezeichnungen enthalten die der Mitarbeiter noch nicht selbst genannt hat.
Falsch: "Kannst du bestätigen dass du 8 Stunden aufwendest?"
Richtig: "Wie viele Stunden wendest du pro Monat dafür auf?"

## Aktueller Kontext
- Interview ID: ${ctx.interviewId}
- Phase: ${ctx.phase}
- Mitarbeiter: ${ctx.employeeName}${ctx.employeeRole ? `, ${ctx.employeeRole}` : ''}
- Abteilung: ${ctx.department}
- Fokusthemen: ${ctx.focusTopics ?? 'keine spezifischen'}
- Step-Tracker: ${ctx.stepTracker.length} Steps registriert (Hard Cap: 5 — keinen neuen register_step wenn bereits 5 existieren)
- ${activeStepLine}
`
}

// ─── Clarification Cards Generation ──────────────────────────────────────────

function shouldGenerateClarificationCards(ctx: InterviewContext): boolean {
  // 2026-06-08 fix — phase guard dropped. Analyst runs in `after()` parallel to Talker,
  // so ctx.phase here is the PREVIOUS phase (set before Talker). When orchestrator
  // transitions to wrap_up at iter N+1, analyst at iter N still sees phase=coverage_check
  // and the old guard "phase !== 'wrap_up'" suppressed cards. Cards never landed in DB.
  //
  // Safe to drop because orchestrator double-gates clarification routing:
  //   - decideNextPhase wrap_up: only routes to clarification when wrap_up_question_asked
  //     AND last message is user response (line 286–291)
  //   - checkLifecycle farewell-detect / soft-confirm: cards block completion only when
  //     analyst already ran, never premature
  // Mid-interview cards therefore never trigger clarification phase prematurely.
  //
  // Tracker must have at least one step — empty trackers can't have missing slots.
  if (ctx.stepTracker.length === 0) return false
  return computeEmptyMandatorySlots(ctx.stepTracker).length > 0
}

function computeEmptyMandatorySlots(tracker: StepEntry[]): { step: StepEntry; slot: string }[] {
  const empty: { step: StepEntry; slot: string }[] = []
  for (const step of tracker) {
    for (const slot of POTENZIAL_SLOT_NAMES) {
      if (step.potenzial[slot] === null) {
        empty.push({ step, slot })
      }
    }
    for (const slot of TAZITE_SLOT_NAMES) {
      const sv = step.slots[slot]
      const filled = sv != null && (sv.value != null || sv.nicht_befund_typ != null)
      if (!filled) empty.push({ step, slot })
    }
  }
  return empty
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalystToolCallRecord {
  toolName: string
  args: Record<string, unknown>
}

export interface AnalystRunResult {
  briefing: AnalystBriefing
  toolCalls: AnalystToolCallRecord[]
}

// ─── Step Merger ──────────────────────────────────────────────────────────────

const STATUS_RANK: Record<StepEntry['status'], number> = { done: 2, walkthrough: 1, exploring: 0 }

/**
 * Deterministically merges semantically equivalent fragmented steps.
 * Uses groupSemanticSteps(threshold=0.2) — permissive to catch cross-context duplicates
 * (e.g. "Debitorenbuchhaltung: Mahnprozess" + "Mahnwesen: Bearbeitung" → one step).
 *
 * Merge rules:
 * - Canonical step = member with most filled mandatory slots (tie: first in group)
 * - Slots: canonical wins, falls back to any non-null value in group
 * - status: highest in group (done > walkthrough > exploring)
 * - process_steps / friction_points / friction_tools: union, deduplicated
 *
 * Idempotent: running twice produces the same result.
 * Called at the start of runAnalyst so the LLM sees a clean tracker.
 */
async function mergeFragmentedSteps(
  interviewId: string,
  tracker: StepEntry[],
): Promise<{ merged: StepEntry[]; changed: boolean }> {
  const groups = groupSemanticSteps(tracker, 0.2)
  if (groups.every(g => g.length === 1)) return { merged: tracker, changed: false }

  const merged: StepEntry[] = groups.map(group => {
    if (group.length === 1) return group[0]

    const canonical = group.reduce((best, s) => {
      const sc = POTENZIAL_SLOT_NAMES.filter(slot => s.potenzial[slot] !== null).length
      const bc = POTENZIAL_SLOT_NAMES.filter(slot => best.potenzial[slot] !== null).length
      return sc > bc ? s : best
    })

    // Merge potenzial slots
    const potenzial = { ...canonical.potenzial }
    for (const slot of POTENZIAL_SLOT_NAMES) {
      if (potenzial[slot] === null) {
        for (const s of group) {
          if (s.potenzial[slot] !== null) { potenzial[slot] = s.potenzial[slot]; break }
        }
      }
    }

    // Merge tazite slots
    const slots = { ...canonical.slots }
    for (const slot of TAZITE_SLOT_NAMES) {
      if (slots[slot] === null) {
        for (const s of group) {
          if (s.slots[slot] !== null) { slots[slot] = s.slots[slot] as never; break }
        }
      }
    }

    const bestStatus = group.reduce(
      (best, s) => STATUS_RANK[s.status] > STATUS_RANK[best] ? s.status : best,
      'exploring' as StepEntry['status'],
    )

    const allProcessSteps = [...new Set(group.flatMap(s => s.process_steps ?? []))]
    const allFrictionPoints = [...new Set(group.flatMap(s => s.friction_points ?? []))]
    const allFrictionTools = [...new Set(group.flatMap(s => s.friction_tools ?? []))]

    return {
      ...canonical,
      potenzial,
      slots,
      status: bestStatus,
      process_steps: allProcessSteps.length > 0 ? allProcessSteps : canonical.process_steps,
      friction_points: allFrictionPoints.length > 0 ? allFrictionPoints : canonical.friction_points,
      friction_tools: allFrictionTools.length > 0 ? allFrictionTools : canonical.friction_tools,
    }
  })

  const supabase = getSupabaseAdmin()
  await supabase
    .from('interview_state')
    .update({
      step_tracker: merged as unknown as import('@/lib/database.types').Json,
      updated_at: new Date().toISOString(),
    })
    .eq('interview_id', interviewId)

  console.log(`[analyst] merged ${tracker.length} → ${merged.length} steps`)
  return { merged, changed: true }
}

// ─── Catchup System Prompt ────────────────────────────────────────────────────

function buildCatchupSystemPrompt(ctx: InterviewContext, history: TurnMessage[]): string {
  const activeStep = ctx.stepTracker.find(s => s.status === 'exploring' || s.status === 'walkthrough')
  const activeStepLine = activeStep
    ? `Aktiv im Walkthrough: "${activeStep.title}" (Status: ${activeStep.status})`
    : 'Aktiv im Walkthrough: keiner'

  // Numbered turn index: only user turns (1-indexed) for unambiguous source_turn attribution.
  // Catchup LLM was consistently misattributing source_turn without this index (Pt12).
  const userTurns = history.filter(t => t.role === 'user')
  const turnIndex = userTurns.length > 0
    ? '\n## Mitarbeiter-Turns (für source_turn)\n' +
      userTurns.map((t, i) => `Turn ${i + 1}: "${t.content.slice(0, 300)}${t.content.length > 300 ? '…' : ''}"`).join('\n')
    : ''

  return `Du bist Interview-Analyst im Catch-up-Modus. Deine Aufgabe: nachzuholende Slots aus dem GESAMTEN Gesprächsverlauf extrahieren.

CATCHUP-MODUS — strikte Regeln:
- Analysiere alle User-Turns im Turn-Index unten auf verpasste Slot-Werte.
- Jeder record_slot-Call MUSS evidence_quote UND source_turn enthalten.
- source_turn = exakte 1-indexed Nummer des User-Turns (aus dem Turn-Index unten — NICHT schätzen).
- evidence_span ist NICHT gültig im Catchup — nutze stets evidence_quote + source_turn.
- NUR record_slot ist verfügbar. Kein register_step, kein produce_briefing, kein update_walkthrough_data.
- Extrahiere nur explizit genannte Werte, keine Inferenzen.
- Wenn keine verpassten Slots gefunden: sofort stoppen (keine Dummy-Calls nötig).

## Tool-Aufruf-Reihenfolge
1. record_slot für jeden verpassten Slot in chronologischer Turn-Reihenfolge
2. Fertig — kein weiterer Call nötig

## Aktueller Kontext
- Interview ID: ${ctx.interviewId}
- Phase: ${ctx.phase}
- Mitarbeiter: ${ctx.employeeName}${ctx.employeeRole ? `, ${ctx.employeeRole}` : ''}
- Abteilung: ${ctx.department}
- Step-Tracker: ${ctx.stepTracker.length} Steps registriert
- ${activeStepLine}
${turnIndex}
`
}

// ─── Internal Core ────────────────────────────────────────────────────────────

interface RunAnalystCoreOptions extends AnalystRunOptions {
  /** Prompt mode: 'online' restricts extraction to the current turn; 'default' is unrestricted. */
  promptMode?: 'online' | 'default'
  /** Source marker written to the slot-write trail. */
  writeSource?: 'analyst' | 'analyst_online' | 'analyst_catchup'
  /** When set, only these tools are exposed to the LLM (allowedTools filter). */
  allowedTools?: string[]
  /** When true, skip step-merger (catchup mode should not mutate tracker before history scan). */
  skipMerge?: boolean
}

/**
 * Core analyst runner — shared implementation. Public variants (runAnalystOnline,
 * runAnalystCatchup, runAnalyst) call this with appropriate options.
 */
async function runAnalystCore(opts: RunAnalystCoreOptions): Promise<AnalystRunResult> {
  const modelString =
    process.env.INTERVIEW_ANALYST_MODEL ?? process.env.INTERVIEW_MODEL ?? 'google/gemini-3.5-flash'
  const model = resolveModel(modelString)
  const supabase = getSupabaseAdmin()
  const { interviewId, workspaceId } = opts.context
  const promptMode = opts.promptMode ?? 'default'
  const writeSource = opts.writeSource ?? 'analyst'

  if (!opts.skipMerge) {
    // Merge fragmented steps before building LLM context so the Analyst sees a clean
    // tracker and generates correct clarification cards.
    try {
      const { merged, changed } = await mergeFragmentedSteps(interviewId, opts.context.stepTracker)
      if (changed) {
        opts = { ...opts, context: { ...opts.context, stepTracker: merged } }
      }
    } catch (err) {
      console.error('[analyst] mergeFragmentedSteps failed (non-fatal):', err)
    }
  }

  const systemPrompt = promptMode === 'default'
    ? buildAnalystSystemPrompt(opts.context, 'default')
    : buildAnalystSystemPrompt(opts.context, 'online')

  // Messages: full history as analyst context
  const messages = opts.history.map((t) => ({ role: t.role, content: t.content }))

  // Build tool set: all knowledge tools + produce_briefing
  let capturedBriefing: AnalystBriefing = {
    next_focus: '',
    suggested_question: '',
  }

  const knowledgeTools = buildTools(interviewId, workspaceId, opts.currentUserInput, {
    source: writeSource,
    allowedTools: opts.allowedTools,
  })

  const produceBriefingTool = tool({
    description: 'Generates the briefing for the next Talker turn. Call LAST, after all knowledge tools. Called exactly once.',
    inputSchema: AnalystBriefingSchema,
    execute: async (briefing) => {
      capturedBriefing = briefing as AnalystBriefing

      // Only include clarification_cards if conditions are met (guard against unnecessary cards)
      const shouldHaveCards = shouldGenerateClarificationCards(opts.context)
      if (!shouldHaveCards) {
        capturedBriefing = { ...capturedBriefing, clarification_cards: undefined }
      }

      try {
        await supabase
          .from('interviews')
          .update({
            next_briefing: capturedBriefing as unknown as import('@/lib/database.types').Json,
            analyst_status: 'done',
          })
          .eq('id', interviewId)
      } catch (err) {
        console.error('[analyst] produce_briefing DB write failed:', err)
      }

      return { success: true }
    },
  })

  const allTools = {
    ...knowledgeTools,
    produce_briefing: produceBriefingTool,
  }

  const isGoogleModel = modelString.startsWith('google/')

  let capturedToolCalls: AnalystToolCallRecord[] = []

  try {
    const genResult = await generateText({
      model,
      system: systemPrompt,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: messages as any,
      tools: allTools,
      stopWhen: stepCountIs(15),
      ...(isGoogleModel && {
        providerOptions: {
          google: { thinkingConfig: { thinkingBudget: ANALYST_THINKING_BUDGET } },
        },
      }),
      experimental_telemetry: buildTraceMetadata('interview.analyst', {
        interviewId,
        model: modelString,
        environment: (opts.traceCtx?.environment ?? 'prod') as 'prod' | 'eval',
        component: 'analyst',
        ...opts.traceCtx,
      }),
    })

    capturedToolCalls = genResult.steps.flatMap(step =>
      (step.toolCalls ?? []).map(tc => ({
        toolName: tc.toolName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        args: (tc as any).input ?? (tc as any).args ?? {},
      }))
    )
  } catch (err) {
    // Analyst error: set status='failed' so next turn triggers catch-up run
    console.error('[analyst] run failed:', err)
    await supabase
      .from('interviews')
      .update({ analyst_status: 'failed' })
      .eq('id', interviewId)
    throw err
  }

  // Post-processing: deterministic data_sources backfill from friction_tools +
  // extractions_log (type=tool). Analyst frequently forgets data_sources even
  // when systems are explicitly named (eval 2026-06-03 Monatsabschluss case).
  try {
    await backfillDataSourcesFromMentions(interviewId)
  } catch (err) {
    console.error('[analyst] data_sources backfill failed:', err)
  }

  return { briefing: capturedBriefing, toolCalls: capturedToolCalls }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Online analyst — default path, runs after every user turn.
 * Extracts knowledge ONLY from the current user statement.
 * System prompt explicitly forbids catch-up extraction from prior turns.
 * evidence_quote must be a verbatim span from the current user input.
 */
export async function runAnalystOnline(opts: AnalystRunOptions): Promise<AnalystRunResult> {
  return runAnalystCore({ ...opts, promptMode: 'online', writeSource: 'analyst_online' })
}

/**
 * Catchup analyst — triggered on phase entry of coverage_check or wrap_up.
 * Scans the full conversation history for missed slot values.
 * Only record_slot and produce_briefing are available (no register_step, no update_walkthrough_data).
 * Every record_slot call MUST include evidence_quote + source_turn.
 */
export async function runAnalystCatchup(opts: AnalystRunOptions): Promise<AnalystRunResult> {
  const { interviewId, workspaceId } = opts.context
  const modelString =
    process.env.INTERVIEW_ANALYST_MODEL ?? process.env.INTERVIEW_MODEL ?? 'google/gemini-3.5-flash'
  const model = resolveModel(modelString)
  const supabase = getSupabaseAdmin()
  const isGoogleModel = modelString.startsWith('google/')

  const systemPrompt = buildCatchupSystemPrompt(opts.context, opts.history)
  const messages = opts.history.map((t) => ({ role: t.role, content: t.content }))

  // Catchup only gets record_slot — no produce_briefing, no structural tools.
  // The online analyst's next_briefing is preserved: catchup fills missed slots
  // but does not regenerate the conversation briefing (M2 fix).
  // F2: Pass user turn texts for evidence_quote Jaccard validation in record_slot
  const userTurns = opts.history.filter(t => t.role === 'user').map(t => t.content)
  const catchupTools = buildTools(interviewId, workspaceId, undefined, {
    source: 'analyst_catchup',
    allowedTools: ['record_slot'],
    userTurns,
  })

  let capturedBriefing: AnalystBriefing = { next_focus: '', suggested_question: '' }

  let capturedToolCalls: AnalystToolCallRecord[] = []

  try {
    const genResult = await generateText({
      model,
      system: systemPrompt,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: messages as any,
      tools: catchupTools,
      stopWhen: stepCountIs(10),
      ...(isGoogleModel && {
        providerOptions: {
          google: { thinkingConfig: { thinkingBudget: ANALYST_THINKING_BUDGET } },
        },
      }),
      experimental_telemetry: buildTraceMetadata('interview.analyst', {
        interviewId,
        model: modelString,
        environment: (opts.traceCtx?.environment ?? 'prod') as 'prod' | 'eval',
        component: 'analyst_catchup',
        ...opts.traceCtx,
      }),
    })

    capturedToolCalls = genResult.steps.flatMap(step =>
      (step.toolCalls ?? []).map(tc => ({
        toolName: tc.toolName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        args: (tc as any).input ?? (tc as any).args ?? {},
      }))
    )
  } catch (err) {
    console.error('[analyst:catchup] run failed:', err)
    // Don't set analyst_status=failed — catchup is supplementary, not critical
    throw err
  }

  return { briefing: capturedBriefing, toolCalls: capturedToolCalls }
}

/**
 * Legacy analyst — backward-compatible wrapper used by the eval runner.
 * Behaves identically to the previous runAnalyst: no online/catchup mode split.
 * New code should prefer runAnalystOnline.
 */
export async function runAnalyst(opts: AnalystRunOptions): Promise<AnalystRunResult> {
  return runAnalystCore({ ...opts, writeSource: 'analyst' })
}

/**
 * Failure-retry run: processes two turns at once when previous analyst run failed.
 * Renamed from the old runAnalystCatchup (which was semantically different from
 * the new history-scan runAnalystCatchup).
 */
export async function runAnalystFailureRetry(opts: AnalystRunOptions & { previousUserInput: string }): Promise<AnalystRunResult> {
  const augmentedHistory: TurnMessage[] = [
    { role: 'user', content: opts.previousUserInput },
    ...opts.history,
  ]
  return runAnalystOnline({ ...opts, history: augmentedHistory })
}

/**
 * Backfill data_sources for steps where it's null but tool/system mentions exist.
 * Sources (in priority order):
 *   1. step.friction_tools (most specific)
 *   2. extractions_log entries of type=tool (less precise — global, not step-scoped)
 *
 * Only fills steps where data_sources is null. Existing values are never overwritten.
 * Sets confidence=unknown so downstream consumers can distinguish from
 * Analyst-recorded values.
 */
async function backfillDataSourcesFromMentions(interviewId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { data: row } = await supabase
    .from('interview_state')
    .select('step_tracker, extractions_log')
    .eq('interview_id', interviewId)
    .maybeSingle()

  if (!row) return
  const tracker = (row.step_tracker as StepEntry[] | null) ?? []
  if (tracker.length === 0) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractions = (row.extractions_log as any[] | null) ?? []
  const globalToolMentions: string[] = extractions
    .filter((e) => e?.type === 'tool')
    .map((e) => {
      const c = e?.content as Record<string, unknown> | undefined
      return typeof c?.name === 'string' ? (c.name as string) : ''
    })
    .filter((n) => n.length > 0)

  let mutated = false
  const backfillEmits: Array<{ stepTitle: string; value: string[] }> = []
  const updated = tracker.map((step) => {
    // hilfsmittel replaces data_sources (PROJ-25)
    const hilfsmittelFilled = step.slots.hilfsmittel?.value != null || step.slots.hilfsmittel?.nicht_befund_typ != null
    if (hilfsmittelFilled) return step

    const fromFriction = Array.isArray(step.friction_tools) ? step.friction_tools : []
    const candidates = fromFriction.length > 0 ? fromFriction : globalToolMentions
    const deduped = Array.from(new Set(candidates.map((s) => s.trim()).filter(Boolean)))
    if (deduped.length === 0) return step

    mutated = true
    backfillEmits.push({ stepTitle: step.title, value: deduped })
    return {
      ...step,
      slots: {
        ...step.slots,
        hilfsmittel: {
          value: deduped,
          quote: '[auto-backfill aus erwähnten Tools/Systemen]',
          confidence: 'unknown' as const,
          nicht_befund_typ: null,
        },
      },
    }
  })

  if (!mutated) return
  await supabase
    .from('interview_state')
    .update({
      step_tracker: updated as unknown as import('@/lib/database.types').Json,
      updated_at: new Date().toISOString(),
    })
    .eq('interview_id', interviewId)

  // Emit trail events for each backfilled step (ADR-015) — fire-and-forget
  const now = new Date().toISOString()
  for (const { stepTitle, value } of backfillEmits) {
    emitSlotWrite({
      ts: now,
      interviewId,
      source: 'backfill',
      stepTitle,
      slot: 'data_sources',
      value,
      overwrite: false,
      evidence: '[auto-backfill aus erwähnten Tools/Systemen]',
    }).catch(() => {})
  }
}


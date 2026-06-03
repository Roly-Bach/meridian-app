import { resolveModel } from '@/lib/llm-provider'
import { generateText, stepCountIs, tool } from 'ai'
import { z } from 'zod'
import { buildTraceMetadata, type TraceCtx } from './_telemetry'
import {
  buildTools,
  MANDATORY_SLOTS,
  type InterviewContext,
  type TurnMessage,
  type AnalystBriefing,
  type ClarificationCard,
  type StepEntry,
} from './interviewAgent'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

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

function buildAnalystSystemPrompt(ctx: InterviewContext): string {
  const activeStep = ctx.stepTracker.find(s => s.status === 'exploring' || s.status === 'walkthrough')
  const activeStepLine = activeStep
    ? `Aktiv im Walkthrough: "${activeStep.title}" (Status: ${activeStep.status})`
    : 'Aktiv im Walkthrough: keiner — bereit für neue Step-Registration oder Backfill'

  return `Du bist Interview-Analyst für ein laufendes Mitarbeiter-Interview. Deine Aufgabe: strukturierte Wissens-Extraktion nach jedem Mitarbeiter-Turn.

Sprache des Interviews: Deutsch.

## Deine Aufgaben pro Turn

1. Analysiere den letzten Mitarbeiter-Turn auf extrahierbare Informationen
2. Rufe alle relevanten Wissens-Tools auf
3. Erstelle via produce_briefing eine Handlungsempfehlung für den nächsten Turn

## Tool-Aufruf-Priorität (PFLICHT — strikte Reihenfolge)

STUFE 1 — NEUE SCHRITTE (höchste Priorität):
Beschreibt der Mitarbeiter in diesem Turn einen neuen, eigenständigen Prozess?
  → register_step SOFORT, vor allen anderen Tool-Calls außer update_topics
  → produce_briefing.next_focus = dieser neue Schritt
  → Kein Backfill-Briefing für andere Schritte in diesem Turn

STUFE 2 — AKTIVER WALKTHROUGH:
Ein Schritt ist als "Aktiv im Walkthrough" markiert (siehe Kontext unten) UND kein neuer Schritt in Stufe 1?
  → update_walkthrough_data + record_slot NUR für diesen aktiven Schritt
  → produce_briefing.next_focus = aktiver Schritt-Titel
  → Backfill für andere Schritte: KEIN produce_briefing-Hinweis in diesem Turn

STUFE 3 — BACKFILL (nur wenn BEIDE Bedingungen erfüllt):
  a) Phase = slot_completion ODER coverage_check (nicht walkthrough_step)
  b) Kein neuer Schritt in diesem Turn registriert
  → record_slot + produce_briefing mit Backfill-Fokus
  Backfill-Regel: "Wenn frequency_per_month noch null → nachfragen"
  gilt AUSSCHLIESSLICH in Phase slot_completion oder coverage_check
  UND nur wenn kein neuer Schritt in diesem Turn registriert wurde.

STUFE 4 — WRAP_UP: Clarification Cards für verbleibende Slot-Lücken

**register_step** — ANTI-FRAGMENTATION PFLICHT VOR JEDEM AUFRUF: Lies den Schritt-Tracker. Gibt es einen Schritt mit demselben Hauptbegriff oder Prozessgegenstand? Wenn ja → record_slot mit dem EXAKTEN bestehenden Titel.
Faustregel: Ein Mitarbeiter mit 2–3 Hauptaufgaben hat 2–5 Steps im Tracker. Mehr als 6 Steps = Fragmentation.
NAMING CONVENTION PFLICHT: Nutze Format "Hauptprozess: Tätigkeitsbeschreibung".
Richtig:  "Rechnungsbearbeitung: Eingang und Prüfung", "Monatsabschluss: Abstimmung offener Posten"
Falsch:   "Rechnungsprüfung", "Rechnungsprüfung und Kontierung" (kein Parent-Kontext → Fragmentation)

**record_slot**: Für jeden explizit genannten Wert:
- frequency_per_month: Häufigkeitsangaben (umrechnen auf Monat)
- duration_minutes: Zeit pro Durchführung (NICHT wöchentliche/monatliche Gesamtaufwände)
- rule_based: Aussagen zur Regelbasierung ("immer gleich", "variiert", "nach Schema")
- data_sources: Genannte Systeme, Tools, Datenbanken — NUR via record_slot setzen. NIEMALS via update_walkthrough_data. friction_tools ist ein separates Feld und befüllt data_sources NICHT.
- evidence_quote muss wörtliches Zitat aus dem Mitarbeiter-Statement sein
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

## Clarification Cards (nur bei Phase=wrap_up)
Generiere bis zu 8 ClarificationCards via produce_briefing.clarification_cards, priorisiert nach Use-Case-Relevanz:
1. **SlotCards** (slot_key=frequency_per_month|duration_minutes|rule_based|error_rate_percent): Für jeden registrierten Schritt mit leerem Pflicht-Slot. options-Feld leer lassen — UI verwendet feste Optionen.
2. **OpenItemCards** (slot_key=open_item): Für erwähnte aber nicht registrierte Prozessschritte. options leer lassen — UI verwendet Ja/Nein/Manchmal.
3. **QualitativeCards** (slot_key=qualitative, answer_type=multi): Für fehlenden Prozesskontext: Beteiligte, Systeme, Blockaden, Abstimmungsbedarf, Automatisierungspotenzial. options=[2-4 spezifische Antwortoptionen], letzter Eintrag="Weiß ich nicht".
Wenn keine Lücken existieren: leeres Array zurückgeben.

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
  return ctx.phase === 'wrap_up'
}

function computeEmptyMandatorySlots(tracker: StepEntry[]): { step: StepEntry; slot: string }[] {
  const empty: { step: StepEntry; slot: string }[] = []
  for (const step of tracker) {
    for (const slot of MANDATORY_SLOTS) {
      if (step.slots[slot] === null) {
        empty.push({ step, slot })
      }
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

// ─── Main Analyst Function ────────────────────────────────────────────────────

export async function runAnalyst(opts: AnalystRunOptions): Promise<AnalystRunResult> {
  const modelString =
    process.env.INTERVIEW_ANALYST_MODEL ?? process.env.INTERVIEW_MODEL ?? 'google/gemini-3.5-flash'
  const model = resolveModel(modelString)
  const supabase = getSupabaseAdmin()
  const { interviewId, workspaceId } = opts.context

  const systemPrompt = buildAnalystSystemPrompt(opts.context)

  // Messages: full history as analyst context
  const messages = opts.history.map((t) => ({ role: t.role, content: t.content }))

  // Build tool set: all knowledge tools + produce_briefing
  let capturedBriefing: AnalystBriefing = {
    next_focus: '',
    suggested_question: '',
  }

  const knowledgeTools = buildTools(interviewId, workspaceId, opts.currentUserInput)

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

  return { briefing: capturedBriefing, toolCalls: capturedToolCalls }
}

/** Catch-up run: processes two turns at once when previous analyst run failed */
export async function runAnalystCatchup(opts: AnalystRunOptions & { previousUserInput: string }): Promise<AnalystRunResult> {
  const augmentedHistory: TurnMessage[] = [
    { role: 'user', content: opts.previousUserInput },
    ...opts.history,
  ]
  return runAnalyst({ ...opts, history: augmentedHistory })
}

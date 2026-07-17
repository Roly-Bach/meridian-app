import { resolveModel } from '@/lib/llm-provider'
import { generateText, stepCountIs, tool } from 'ai'
import { z } from 'zod'
import { buildTraceMetadata, type TraceCtx, type OnTokenUsage } from './_telemetry'
import { buildTools } from './interviewTools'
import {
  MANDATORY_SLOTS,
  OPTIONAL_SLOTS,
  TAZITE_SLOT_NAMES,
  POTENZIAL_SLOT_NAMES,
  groupSemanticSteps,
  type StepEntry,
  type SlotName,
} from './interviewSemantic'
import type {
  InterviewContext,
  TurnMessage,
  AnalystBriefing,
  ClarificationCard,
  ODroughtState,
} from './interviewTypes'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { TurnStore, TurnSession, InterviewStore } from './turnStore/port'
import type { TurnSnapshot } from './turnStore/intents'

// ─── Analyst (PROJ-44 / ADR-021) ───────────────────────────────────────────────
// Runs SYNCHRONOUSLY before the phase decision and the Talker (runInterviewTurn.ts).
// Responsibilities: knowledge extraction (register_step, record_slot, etc.)
// + produce_briefing for THIS turn's Talker call.
// Does NOT generate user-facing text.

// thinkingBudget: 2048 — enables careful analysis before tool calls, reducing
// impulsive register_step calls. The real fragmentation fix is tokenJaccard dedup
// in register_step + anti-fragmentation rules in the system prompt below.
// (At budget=0 fragmentation was worse: 12 steps registered for 2 real processes.)
export const ANALYST_THINKING_BUDGET = 2048

/**
 * PROJ-42: tool names that count as "new extraction" for the deterministic
 * No-New-Extraction-Zähler (interviewOrchestrator.ts). Deliberately excludes
 * produce_briefing itself (bookkeeping, not new knowledge).
 */
const EXTRACTION_TOOL_NAMES = new Set([
  'register_step',
  'record_slot',
  'record_governance',
  'record_dependency',
  'update_walkthrough_data',
  'link_bottleneck',
])

/**
 * Pure, deterministic (no LLM involved) — computes the next produce_briefing
 * payload for this pass. Extracted so the bridging logic (streak reset/increment
 * + carry-forward-when-not-called) is independently unit-testable without
 * mocking generateText/turnStore.
 *
 * - hadExtraction=true (any knowledge tool call ACTUALLY APPLIED this pass —
 *   PROJ-44 Remediation Runde 2/H-2 Fix 2: a call the evidence_span/priority/
 *   step-lookup guard rejected, or an idempotent no-op re-write of an already-
 *   filled slot, does NOT count — only `tc.applied` does. Before this fix the
 *   streak counted ATTEMPTS, not applied writes: a guard-rejected record_slot
 *   (e.g. re-extracting an old value from a courtesy-phrase turn) reset the
 *   streak just like a real write, making the safety net practically
 *   unreachable — 53 record_slot attempts vs. 17 real writes in one QA sample) →
 *   streak resets to 0.
 * - modelCalledBriefing=true → the LLM's own next_focus/suggested_question/
 *   clarification_cards win, streak is merged in.
 * - modelCalledBriefing=false → the analyst prompt's own "skip on a boring turn"
 *   instruction was followed: carry the PREVIOUS briefing forward unchanged
 *   ("das vorherige next_briefing bleibt gültig") — only the streak advances,
 *   so the safety-net counter still sees every turn, including the ones judged
 *   non-substantial.
 */
export function computeNextBriefing(
  capturedBriefing: AnalystBriefing,
  modelCalledBriefing: boolean,
  toolCalls: AnalystToolCallRecord[],
  previousBriefing: AnalystBriefing | null | undefined,
): AnalystBriefing {
  const hadExtraction = toolCalls.some(tc => tc.applied && EXTRACTION_TOOL_NAMES.has(tc.toolName))
  const prevStreak = previousBriefing?.noNewExtractionStreak ?? 0
  const noNewExtractionStreak = hadExtraction ? 0 : prevStreak + 1

  return modelCalledBriefing
    ? { ...capturedBriefing, noNewExtractionStreak }
    : { ...(previousBriefing ?? { next_focus: '', suggested_question: '' }), noNewExtractionStreak }
}

export interface AnalystRunOptions {
  context: InterviewContext
  /** History up to and including the current user turn (WITHOUT Talker's response for this turn) */
  history: TurnMessage[]
  /** The raw user input for the current turn — enables evidence_span contamination guard + online-mode extraction */
  currentUserInput: string
  /**
   * The briefing as persisted from the PREVIOUS turn (interviews.next_briefing).
   * Used to (a) carry next_focus/suggested_question/clarification_cards forward
   * unchanged when this pass makes no substantial change (the analyst prompt's
   * own "don't call produce_briefing on a boring turn" instruction), and (b) as
   * the base for the deterministic noNewExtractionStreak computed in code below.
   */
  previousBriefing?: AnalystBriefing | null
  /**
   * interview.analyst_status as loaded at turn start (ADR-021 D2/D4). 'failed'
   * selects the failure-window augmentation: the previous (missed) turn's raw
   * user input is prepended to history so this pass recovers it, on top of
   * whichever mode (online/closing) the current phase selects.
   */
  analystStatus?: string | null
  /** The immediately preceding turn's raw user input — required for the failure-window augmentation above. */
  previousUserInput?: string
  traceCtx?: TraceCtx
  /** TurnStore for the analyst's staged writes. Defaults to the prod Supabase store.
   *  Pass an InterviewStore to enable setAnalystStatus on the error path. */
  store?: TurnStore | InterviewStore
  onTokenUsage?: OnTokenUsage
  /**
   * PROJ-44 Remediation (M-3 Fokus-Lock): this turn's pre-computed focus lock —
   * see interviewOrchestrator.ts's computeFocusLock, run by the caller against
   * the pre-Analyst tracker + the previous turn's persisted oDrought state.
   * Steers the Online sub-pass's next_focus/suggested_question toward this
   * step (buildAnalystSystemPrompt) and seeds the O-Drought streak the Online
   * sub-pass updates before persisting it on the returned briefing.
   */
  focusLock: ODroughtState
  /**
   * PROJ-44 Remediation Runde 2 (Fix 3, ballast #2 — interviewAnalyst→
   * interviewOrchestrator edge): the pure O-Drought update function, injected
   * by the caller (runInterviewTurn.ts, which already imports it from
   * interviewOrchestrator.ts) rather than statically imported here. Keeps the
   * LLM layer (this module) from depending on the deterministic orchestration
   * layer — same call, same timing (before this pass's produce_briefing is
   * staged), only the import edge moves to the caller.
   */
  updateODrought: (lock: ODroughtState, beforeTracker: StepEntry[], afterTracker: StepEntry[]) => ODroughtState
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
  clarification_cards: z.array(ClarificationCardSchema).max(8).optional().describe('Only generate when phase=closing and mandatory slots are empty'),
  step_advance_ready: z.boolean().optional().describe(
    'PROJ-42 Advance-Signal: true iff the CURRENTLY ACTIVE process step has been ' +
    'sufficiently explored for now (driver/context/tazite detail gathered, not ' +
    'necessarily every optional slot filled) — signals the orchestrator that this ' +
    'step no longer needs dedicated depth and Explore can move on (to the next ' +
    'topic, or to Closing if none remain). Do NOT set true merely because a turn ' +
    'passed — only when the active step itself is judged sufficiently covered.'
  ),
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

/**
 * @param focusStepId PROJ-44 Remediation Runde 2 (Fix 3, ballast #3): the
 * focus-locked step id, passed as its own parameter rather than a field on the
 * shared InterviewContext (Talker + Analyst both use InterviewContext, but
 * only the Analyst reads this) — an analyst-only concern kept off the
 * cross-cutting type.
 */
export function buildAnalystSystemPrompt(ctx: InterviewContext, mode: 'online' | 'default' = 'default', focusStepId?: string | null): string {
  const activeStep = ctx.stepTracker.find(s => s.status === 'exploring' || s.status === 'walkthrough')
  const activeStepLine = activeStep
    ? `Aktiv im Walkthrough: "${activeStep.title}" (${activeStep.id ?? 'no-id'}, Status: ${activeStep.status})`
    : 'Aktiv im Walkthrough: keiner — bereit für neue Step-Registration oder Backfill'

  // PROJ-44 Remediation (M-3 Fokus-Lock): only present when the orchestrator locked a
  // step for this turn (computeFocusLock) — absent for the first turns / when nothing
  // is lockable, so this line never widens the STUFE-0-4 prefix's byte-identity (WP5).
  const focusStep = focusStepId ? ctx.stepTracker.find(s => s.id === focusStepId) : undefined
  const focusLockLine = focusStep
    ? `\nFOKUS-LOCK (gesperrter aktiver Schritt): "${focusStep.title}" (${focusStep.id}). Richte next_focus und suggested_question PRIMÄR auf diesen Schritt, solange er qualitativ noch nicht ausreichend vertieft ist (O2–O6: Entscheidungslogik, tazite Cues, Ausnahmen, Inputs, Outputs, Hilfsmittel, Abhängigkeiten). Wechsle den Fokus NICHT eigenständig — das System sperrt/entsperrt automatisch, sobald dieser Schritt ausgeschöpft ist. Beiläufig genannte Werte anderer Schritte trotzdem opportunistisch erfassen (record_slot bleibt unabhängig vom Fokus).`
    : ''

  const stepIdList = ctx.stepTracker.length > 0
    ? ctx.stepTracker.map(s => `  ${s.id ?? '?'}: "${s.title}"`).join('\n')
    : '  (noch keine Schritte registriert)'

  const modePrefix = mode === 'online' ? ONLINE_MODE_PREFIX : ''

  return `${modePrefix}Du bist Interview-Analyst für ein laufendes Mitarbeiter-Interview. Deine Aufgabe: strukturierte Wissens-Extraktion nach jedem Mitarbeiter-Turn.

Nutze step_id in record_slot statt step_title — die aktuellen Schritt-IDs stehen im Abschnitt "Aktueller Kontext" am Ende dieses Prompts.

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
  → register_step SOFORT, vor allen anderen Tool-Calls
  → produce_briefing.next_focus = dieser neue Schritt
  → Kein Backfill-Briefing für andere Schritte in diesem Turn
EIGENSTÄNDIGKEITS-TEST: Hat ein als Sub-Aktivität geframtes Vorgehen eine eigene Frequenz ODER eigene Dauer ODER einen eigenen Output/Auslöser der sich vom Eltern-Schritt unterscheidet → eigenständiger register_step, auch wenn die Persona es als Teil eines anderen Prozesses framt. Beispiel: 'Im Rahmen des Monatsabschlusses prüfe ich täglich Rechnungen' → Rechnungsprüfung hat eigene Frequenz (täglich vs. monatlich) → separater Step. Anti-Fragmentation bleibt: Sub-Aktivitäten ohne eigene Frequenz/Dauer/Output bleiben Sub-Prozesse.

STUFE 2 — SLOT-EXTRAKTION (immer, jede Phase):
Hat der Mitarbeiter in diesem Turn einen Slot-Wert EXPLIZIT genannt (Zahl, System, Ja/Nein)?
  → record_slot SOFORT, unabhängig von Phase und aktivem Schritt.
  → NIEMALS warten. Jeder genannte Wert wird in dem Turn erfasst, in dem er genannt wird.
  → Gilt in jeder Phase — explore, closing, clarification.
  → Spannen ("80 bis 100") → als estimate mit qualifier erfassen (siehe record_slot-Regeln unten).

STUFE 3 — WALKTHROUGH-DATEN (ergänzend zu Stufe 2):
Ein Schritt ist aktiv im Walkthrough UND kein neuer Schritt in Stufe 1?
  → update_walkthrough_data für Prozessschritte, Reibungspunkte, Systeme.
  → produce_briefing.next_focus = aktiver Schritt-Titel.

STUFE 4 — ADVANCE-SIGNAL (PROJ-42, jeden Turn mit aktivem Schritt prüfen):
Ist der AKTUELL AKTIVE Schritt (walkthrough oder exploring) für jetzt ausreichend erhoben —
Ablauf, Treiber, taziter Kontext vorhanden, auch wenn nicht jeder optionale Slot gefüllt ist?
  → produce_briefing.step_advance_ready = true setzen.
Noch spürbar unerforscht (kaum Ablauf/Kontext bekannt)? → step_advance_ready weglassen oder false.
Dies ist der PRIMÄRE Treiber für den Phasenübergang Explore → Closing — nicht Turn-Anzahl.
Setze es NICHT nur weil ein Turn vergangen ist — nur wenn der Schritt selbst ausreichend abgedeckt wirkt.

STUFE 5 — CLARIFICATION CARDS (ab Phase=closing): Für verbleibende Slot-Lücken

**register_step** — ANTI-FRAGMENTATION PFLICHT VOR JEDEM AUFRUF: Lies den Schritt-Tracker. Gibt es einen Schritt mit demselben Hauptbegriff oder Prozessgegenstand? Wenn ja → record_slot mit dem EXAKTEN bestehenden Titel.
Faustregel: Ein Mitarbeiter mit 2–3 Hauptaufgaben hat 2–5 Steps im Tracker. Mehr als 6 Steps = Fragmentation.
NAMING CONVENTION PFLICHT: Nutze Format "Hauptprozess: Tätigkeitsbeschreibung".
Richtig:  "Rechnungsbearbeitung: Eingang und Prüfung", "Monatsabschluss: Abstimmung offener Posten"
Falsch:   "Rechnungsprüfung", "Rechnungsprüfung und Kontierung" (kein Parent-Kontext → Fragmentation)

**record_slot**: VORHER PRÜFEN: Ist der Slot im Step-Tracker bereits gefüllt (Wert ≠ null)? Wenn ja → NICHT aufrufen. Das System erkennt Duplikate und gibt "STOPP" zurück — vermeide redundante Calls.
Nicht-Befund (PROJ-28/BL-E2.1) — NUR für potenzial-Slots: Wenn der Mitarbeiter in diesem Turn aktiv befragt wurde aber KEINEN belegbaren Wert geliefert hat, setze nicht_befund_typ statt value:
- 'unbekannt' → Mitarbeiter weiß es nicht ("Das kann ich nicht schätzen", "Weiß ich leider nicht")
- 'verweigert' → Mitarbeiter lehnt Auskunft ab ("Das sage ich nicht", "Möchte ich nicht nennen")
- 'nicht_zutreffend' → Feld explizit nicht anwendbar ("Fehlerquote gibt es bei uns nicht", "Passiert nicht")
evidence_span PFLICHT auch bei nicht_befund_typ (wörtlicher Ausschnitt der Mitarbeiter-Aussage als Beleg).
NICHT setzen wenn der Slot noch gar nicht adressiert wurde — nur wenn aktiv gefragt und keine Antwort kam.
Für jeden explizit genannten Wert:
- Spannen ("80 bis 100", "zwei bis drei Tage") → SOFORT erfassen mit confidence=estimate und qualifier="Spanne: <original>". Mittelwert als value: "80 bis 100" → 90. Zeitspannen in Minuten: "2–3 Tage à 8h" → 1200. NICHT warten bis der Talker nachhakt.
- frequency_per_month: Häufigkeitsangaben (umrechnen auf Monat); Spannen sofort als estimate erfassen.
- duration_minutes: Zeit pro Durchführung (NICHT wöchentliche/monatliche Gesamtaufwände); Spannen sofort als estimate erfassen.
- rule_based: Aussagen zur Regelbasierung ("immer gleich", "variiert", "nach Schema")
- data_sources: Genannte Systeme, Tools, Datenbanken — NUR via record_slot setzen. NIEMALS via update_walkthrough_data. friction_tools ist ein separates Feld und befüllt data_sources NICHT.
- evidence_span (PFLICHT bei Online-Extraction aus aktuellem Turn): kurzer WÖRTLICHER Ausschnitt (5–60 Zeichen) aus dem aktuellen Mitarbeiter-Statement, z.B. 100 · 5 Minuten · SAP FI. KEIN Paraphrasieren — exakter Substring, OHNE umschließende Anführungszeichen. Das System verifiziert die wörtliche Übereinstimmung und erweitert zum vollständigen Satz.
- evidence_quote (NUR Fallback bei Catch-up aus historischem Turn): vollständiges Zitat + source_turn PFLICHT.
- source_turn PFLICHT: Bei jedem record_slot-Call IMMER source_turn setzen (1-indexed Turn-Nummer).
  - Online-Extraction (aktueller Turn): source_turn = Anzahl bisheriger User-Turns + 1
  - Catch-up-Extraction aus historischem Kontext: source_turn = Turn-Nr. der User-Message aus der die Evidence stammt
  Beispiel: Wenn Evidence aus Turn 3 stammt und du jetzt Turn 7 analysierst → source_turn=3
Nach register_step mit deduplicated=true: ALLE nachfolgenden record_slot-Calls MÜSSEN
den zurückgegebenen matched_title als step_title verwenden.

**update_walkthrough_data**: Wenn Mitarbeiter Prozessschritte (Signalwörter: "zuerst", "dann", "danach"), Reibungspunkte oder Systeme beschreibt.

**link_bottleneck**: Wenn Pain Point klar an einem registrierten Schritt verortet werden kann.

**produce_briefing**: Als LETZTEN Tool-Call aufrufen — exakt EINMAL pro Turn, NIEMALS mehrfach.
produce_briefing NUR aufrufen wenn in diesem Turn eine substantielle State-Änderung stattfand: neuer Step registriert ODER Step-Status gewechselt ODER mindestens ein neuer Slot befüllt ODER step_advance_ready wechselt auf true. Wenn der Turn keine neue extrahierbare Information enthielt (reine Rückfrage, Smalltalk, Wiederholung, Persona weicht aus) → produce_briefing NICHT aufrufen; das vorherige next_focus/suggested_question bleibt gültig (der No-New-Extraction-Zähler wird unabhängig davon deterministisch im Code weitergeführt).
Wenn du produce_briefing bereits einmal aufgerufen hast: Tool-Sequenz sofort beenden — kein weiterer produce_briefing-Call unter keinen Umständen.

## Clarification Cards (ab Phase=closing)
PFLICHT: Sobald Phase closing erreicht ist, durchsuche ALLE registrierten
Schritte im step_tracker systematisch auf null-Pflicht-Slots. Cards landen in next_briefing
und werden vom Orchestrator erst beim Abschluss der Closing-Sequenz in die Clarification-Phase
aktiviert — mid-interview generierte Cards sind also sicher und werden bei späteren Turns aktualisiert.
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
- ${activeStepLine}${focusLockLine}

Schritt-IDs (nutze step_id in record_slot statt step_title):
${stepIdList}
`
}

// ─── Clarification Cards Generation ──────────────────────────────────────────

function shouldGenerateClarificationCards(ctx: InterviewContext): boolean {
  // Tracker must have at least one step — empty trackers can't have missing slots.
  if (ctx.stepTracker.length === 0) return false
  return computeEmptyMandatorySlots(ctx.stepTracker).length > 0
}

function computeEmptyMandatorySlots(tracker: StepEntry[]): { step: StepEntry; slot: string }[] {
  const empty: { step: StepEntry; slot: string }[] = []
  for (const step of tracker) {
    for (const slot of POTENZIAL_SLOT_NAMES) {
      // Explicit filled check: gap (sv=null) OR nicht_befund (sv.value=null + marker set) are distinct (PROJ-28/BL-E2.1)
      const sv = step.potenzial[slot]
      const filled = sv != null && (sv.value != null || (sv.nicht_befund_typ ?? null) != null)
      if (!filled) {
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
  /**
   * PROJ-44 Remediation Runde 2 (Fix 2/H-2): whether the tool's own execute()
   * returned `success:true` — read straight off the AI SDK's per-step
   * `toolResults[].output`, matched by toolCallId. Every knowledge tool in
   * interviewTools.ts follows the same `{success:boolean, ...}` shape, so this
   * is a uniform signal across register_step/record_slot/record_governance/
   * record_dependency/update_walkthrough_data/link_bottleneck — a rejected
   * evidence_span, a step-not-found lookup, or a blocked priority conflict all
   * surface as `success:false` and therefore `applied:false` here.
   */
  applied: boolean
}

export interface AnalystRunResult {
  briefing: AnalystBriefing
  toolCalls: AnalystToolCallRecord[]
  /**
   * Fresh step_tracker read from the session snapshot after commit — replaces
   * the separate DB reload (`store.loadStepTracker`) the pre-PROJ-44 background()
   * closures used (ADR-021 D2 design decision #3).
   */
  stepTracker: StepEntry[]
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
 * Pure (PROJ-34): the caller stages the result through the session; this no
 * longer writes to the DB itself.
 */
function computeMergedSteps(
  tracker: StepEntry[],
): { merged: StepEntry[]; changed: boolean } {
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

  console.log(`[analyst] merged ${tracker.length} → ${merged.length} steps`)
  return { merged, changed: true }
}

// ─── Catchup System Prompt (used by the Backfill sub-pass) ───────────────────

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

// ─── Internal sub-passes (share ONE session — ADR-021 D2/D3) ─────────────────

interface OnlinePassOptions {
  context: InterviewContext
  history: TurnMessage[]
  currentUserInput: string
  previousBriefing?: AnalystBriefing | null
  session: TurnSession
  traceCtx?: TraceCtx
  onTokenUsage?: OnTokenUsage
  /** PROJ-44 Remediation (M-3): this turn's focus lock, forwarded from AnalystRunOptions. */
  focusLock: ODroughtState
  /** PROJ-44 Remediation (M-3): the tracker as loaded at turn start (pre-Analyst) — the baseline updateODrought diffs against. */
  preTurnTracker: StepEntry[]
  /** PROJ-44 Remediation Runde 2 (Fix 3): injected O-Drought updater, forwarded from AnalystRunOptions — see its doc comment. */
  updateODrought: (lock: ODroughtState, beforeTracker: StepEntry[], afterTracker: StepEntry[]) => ODroughtState
}

/**
 * PROJ-44 Remediation Runde 2 (Fix 2): builds AnalystToolCallRecord[] from a
 * generateText pass's steps, matching each tool call to its own result by
 * toolCallId to derive `applied` — every knowledge tool in interviewTools.ts
 * returns `{success: boolean, ...}`, so `output.success === true` is a uniform
 * "did this call actually change anything" signal across all of them.
 */
function buildToolCallRecords(
  steps: { toolCalls?: unknown[]; toolResults?: unknown[] }[],
): AnalystToolCallRecord[] {
  return steps.flatMap((step) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolCalls = (step.toolCalls ?? []) as any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolResults = (step.toolResults ?? []) as any[]
    return toolCalls.map((tc) => {
      const result = toolResults.find((tr) => tr.toolCallId === tc.toolCallId)
      const output = result?.output as { success?: boolean } | undefined
      return {
        toolName: tc.toolName as string,
        args: (tc.input ?? tc.args ?? {}) as Record<string, unknown>,
        applied: output?.success === true,
      }
    })
  })
}

/**
 * Online sub-pass — extracts knowledge ONLY from the current user statement,
 * registers new steps, and produces this turn's briefing (register + Briefing
 * + Cards). Used standalone (mode='online') and as the second half of the
 * Closing mode (against the tracker the Backfill sub-pass just filled).
 */
async function runOnlinePass(opts: OnlinePassOptions): Promise<{ briefing: AnalystBriefing; toolCalls: AnalystToolCallRecord[] }> {
  const modelString = process.env.INTERVIEW_ANALYST_MODEL ?? process.env.INTERVIEW_MODEL ?? 'google/gemini-3.5-flash'
  const model = resolveModel(modelString)
  const { interviewId } = opts.context
  const { session } = opts

  const systemPrompt = buildAnalystSystemPrompt(opts.context, 'online', opts.focusLock.stepId)
  const messages = opts.history.map((t) => ({ role: t.role, content: t.content }))

  let capturedBriefing: AnalystBriefing = { next_focus: '', suggested_question: '' }

  const knowledgeTools = buildTools(session, opts.currentUserInput, { source: 'analyst_online' })

  // PROJ-42: staging moved out of this tool's execute (see post-generateText
  // block below) — the deterministic noNewExtractionStreak needs the FULL set
  // of tool calls made this pass, which isn't known until generateText returns.
  let modelCalledBriefing = false
  const produceBriefingTool = tool({
    description: 'Generates the briefing for the next Talker turn. Call LAST, after all knowledge tools. Called exactly once.',
    inputSchema: AnalystBriefingSchema,
    execute: async (briefing) => {
      modelCalledBriefing = true
      capturedBriefing = briefing as AnalystBriefing

      // Only include clarification_cards if conditions are met (guard against unnecessary cards)
      const shouldHaveCards = shouldGenerateClarificationCards(opts.context)
      if (!shouldHaveCards) {
        capturedBriefing = { ...capturedBriefing, clarification_cards: undefined }
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

  capturedToolCalls = buildToolCallRecords(genResult.steps)
  {
    const details = genResult.usage.inputTokenDetails as Record<string, unknown> | undefined
    opts.onTokenUsage?.({
      component: 'analyst_online',
      model: modelString,
      inputTokens: genResult.usage.inputTokens ?? 0,
      cacheReadTokens: (details?.cacheReadTokens as number | undefined),
      outputTokens: genResult.usage.outputTokens ?? 0,
    })
  }

  // PROJ-42: deterministic (code-computed, not LLM-guessed) noNewExtractionStreak,
  // always staged exactly once here regardless of whether the model called
  // produce_briefing this pass — see computeNextBriefing for the bridging logic.
  capturedBriefing = computeNextBriefing(capturedBriefing, modelCalledBriefing, capturedToolCalls, opts.previousBriefing)
  // PROJ-44 Remediation (M-1/M-3): deterministic O-Drought streak update — did the
  // locked step gain a new O2–O6 field this pass? session.snapshot() here reflects
  // everything staged so far this pass (merge + backfill sub-pass + this online sub-pass).
  capturedBriefing = { ...capturedBriefing, oDrought: opts.updateODrought(opts.focusLock, opts.preTurnTracker, session.snapshot().stepTracker) }
  // PROJ-34: stage the interviews write (next_briefing + analyst_status='done').
  // onlyIfNotDone preserves the PROJ-27/BL-E1.5 .neq('analyst_status','done') guard.
  session.stage({ kind: 'produce_briefing', briefing: capturedBriefing })

  return { briefing: capturedBriefing, toolCalls: capturedToolCalls }
}

interface BackfillPassOptions {
  context: InterviewContext
  history: TurnMessage[]
  session: TurnSession
  traceCtx?: TraceCtx
  onTokenUsage?: OnTokenUsage
}

/**
 * Backfill sub-pass — scans the FULL conversation history for missed slot
 * values (only record_slot, no register/briefing). Runs first in Closing mode,
 * once per closing episode (triggered by ctx.phase==='closing' at turn start —
 * ADR-021 D2). Supplementary: a failure here is swallowed by the caller
 * (runAnalyst) rather than failing the whole pass — the Online sub-pass is
 * what matters for the phase/completion decision.
 */
async function runBackfillPass(opts: BackfillPassOptions): Promise<{ toolCalls: AnalystToolCallRecord[] }> {
  const { interviewId } = opts.context
  const modelString =
    process.env.INTERVIEW_ANALYST_MODEL ?? process.env.INTERVIEW_MODEL ?? 'google/gemini-3.5-flash'
  const model = resolveModel(modelString)
  const isGoogleModel = modelString.startsWith('google/')
  const { session } = opts

  const systemPrompt = buildCatchupSystemPrompt(opts.context, opts.history)
  const messages = opts.history.map((t) => ({ role: t.role, content: t.content }))

  // Backfill only gets record_slot — no produce_briefing, no structural tools.
  // The Online sub-pass's next_briefing is what matters: backfill fills missed
  // slots but does not regenerate the conversation briefing.
  const userTurns = opts.history.filter(t => t.role === 'user').map(t => t.content)
  const catchupTools = buildTools(session, undefined, {
    source: 'analyst_catchup',
    allowedTools: ['record_slot'],
    userTurns,
  })

  let capturedToolCalls: AnalystToolCallRecord[] = []

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

  capturedToolCalls = buildToolCallRecords(genResult.steps)
  {
    const details = genResult.usage.inputTokenDetails as Record<string, unknown> | undefined
    opts.onTokenUsage?.({
      component: 'analyst_catchup',
      model: modelString,
      inputTokens: genResult.usage.inputTokens ?? 0,
      cacheReadTokens: (details?.cacheReadTokens as number | undefined),
      outputTokens: genResult.usage.outputTokens ?? 0,
    })
  }

  return { toolCalls: capturedToolCalls }
}

// ─── Public API — single Deep-Module entry point (ADR-021 D2) ────────────────

/**
 * The Analyst's single entry point. Runs synchronously, once per turn, before
 * the phase decision and the Talker (runInterviewTurn.ts). Mode is selected
 * from `opts.context.phase` — the phase loaded at turn start, not the (not yet
 * computed) phase decision:
 *
 *   - phase !== 'closing' → ONLINE mode: one pass, current statement only,
 *     register + Briefing + Cards.
 *   - phase === 'closing' → CLOSING mode: one call, two internal sub-passes —
 *     Backfill (full history, record_slot only, priority analyst_catchup=4)
 *     then Online (current statement, register + Briefing + Cards against the
 *     backfilled tracker, priority analyst_online=3). The Closing-entry turn
 *     itself still runs in ONLINE mode (ctx.phase is still 'explore' at its
 *     turn start) — Closing mode fires on the ONE turn per closing episode
 *     whose start-phase is already 'closing' (the turn that answers the
 *     catch-all probe).
 *
 * `analystStatus==='failed'` additionally prepends the previous (missed) turn's
 * raw user input to history — recovering the turn a prior terminal failure
 * couldn't process — on top of whichever mode above applies.
 *
 * On terminal failure: sets `analyst_status='failed'` and rethrows. The caller
 * (runInterviewTurn.ts) retries a bounded number of times, then degrades this
 * turn to the previous briefing/tracker (ADR-021 D4) — the NEXT turn's
 * analystStatus='failed' triggers the recovery augmentation above.
 */
export async function runAnalyst(opts: AnalystRunOptions): Promise<AnalystRunResult> {
  const { interviewId, workspaceId } = opts.context
  const store = opts.store ?? (await import('./turnStore/supabaseTurnStore')).createSupabaseTurnStore()
  const session: TurnSession = await store.openTurn(interviewId, workspaceId)

  // PROJ-44 Remediation (M-3): the tracker exactly as loaded at turn start, before
  // this pass's merge/backfill/online sub-passes touch anything — the baseline
  // updateODrought diffs against to decide whether the locked step progressed.
  const preTurnTrackerForDrought = opts.context.stepTracker

  const history: TurnMessage[] = opts.analystStatus === 'failed' && opts.previousUserInput
    ? [{ role: 'user', content: opts.previousUserInput }, ...opts.history]
    : opts.history

  // Merge fragmented steps once, before either sub-pass builds its LLM context.
  try {
    const { merged, changed } = computeMergedSteps(session.snapshot().stepTracker)
    if (changed) session.stage({ kind: 'register_step', tracker: merged })
  } catch (err) {
    console.error('[analyst] computeMergedSteps failed (non-fatal):', err)
  }

  const mergedContext: InterviewContext = { ...opts.context, stepTracker: session.snapshot().stepTracker }

  const allToolCalls: AnalystToolCallRecord[] = []
  let briefing: AnalystBriefing

  try {
    if (mergedContext.phase === 'closing') {
      // (a) Backfill sub-pass — supplementary, its own failure doesn't fail the pass.
      try {
        const backfill = await runBackfillPass({
          context: mergedContext,
          history,
          session,
          traceCtx: opts.traceCtx,
          onTokenUsage: opts.onTokenUsage,
        })
        allToolCalls.push(...backfill.toolCalls)
      } catch (err) {
        console.error('[analyst:backfill] failed (non-fatal, supplementary):', err)
      }

      // (b) Online sub-pass — against the now-backfilled tracker.
      const onlineContext: InterviewContext = { ...mergedContext, stepTracker: session.snapshot().stepTracker }
      const online = await runOnlinePass({
        context: onlineContext,
        history,
        currentUserInput: opts.currentUserInput,
        previousBriefing: opts.previousBriefing,
        session,
        traceCtx: opts.traceCtx,
        onTokenUsage: opts.onTokenUsage,
        focusLock: opts.focusLock,
        preTurnTracker: preTurnTrackerForDrought,
        updateODrought: opts.updateODrought,
      })
      allToolCalls.push(...online.toolCalls)
      briefing = online.briefing
    } else {
      const online = await runOnlinePass({
        context: mergedContext,
        history,
        currentUserInput: opts.currentUserInput,
        previousBriefing: opts.previousBriefing,
        session,
        traceCtx: opts.traceCtx,
        focusLock: opts.focusLock,
        preTurnTracker: preTurnTrackerForDrought,
        updateODrought: opts.updateODrought,
        onTokenUsage: opts.onTokenUsage,
      })
      allToolCalls.push(...online.toolCalls)
      briefing = online.briefing
    }
  } catch (err) {
    // Online-sub-pass (or standalone online-mode) failure: critical — sets
    // analyst_status='failed' so the next turn's failure-window recovers it.
    console.error('[analyst] run failed:', err)
    if (opts.store && 'setAnalystStatus' in opts.store) {
      await (opts.store as InterviewStore).setAnalystStatus(interviewId, 'failed')
    } else {
      await getSupabaseAdmin().from('interviews').update({ analyst_status: 'failed' }).eq('id', interviewId)
    }
    throw err
  }

  // Deterministic data_sources/hilfsmittel backfill, once at pass end.
  try {
    const backfill = computeDataSourcesBackfill(session.snapshot())
    if (backfill) session.stage({ kind: 'backfill_data_sources', tracker: backfill.tracker, emits: backfill.emits })
  } catch (err) {
    console.error('[analyst] data_sources backfill failed:', err)
  }

  // Commit the whole pass (merge + backfill sub-pass + online sub-pass + data_sources backfill) once, at pass end.
  await session.commit()

  return { briefing, toolCalls: allToolCalls, stepTracker: session.snapshot().stepTracker }
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
 *
 * Pure (PROJ-34): reads the live session snapshot, returns the post-backfill
 * tracker + the per-step trail payloads. The caller stages a
 * `backfill_data_sources` intent (trail emission happens in stage). Returns null
 * when nothing changed.
 */
function computeDataSourcesBackfill(
  snapshot: TurnSnapshot,
): { tracker: StepEntry[]; emits: Array<{ stepTitle: string; value: string[] }> } | null {
  const tracker = snapshot.stepTracker
  if (tracker.length === 0) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractions = (snapshot.extractionsLog as any[] | null) ?? []
  const globalToolMentions: string[] = extractions
    .filter((e) => e?.type === 'tool')
    .map((e) => {
      const c = e?.content as Record<string, unknown> | undefined
      return typeof c?.name === 'string' ? (c.name as string) : ''
    })
    .filter((n) => n.length > 0)

  let mutated = false
  const emits: Array<{ stepTitle: string; value: string[] }> = []
  const updated = tracker.map((step) => {
    // hilfsmittel replaces data_sources (PROJ-25)
    const hilfsmittelFilled = step.slots.hilfsmittel?.value != null || step.slots.hilfsmittel?.nicht_befund_typ != null
    if (hilfsmittelFilled) return step

    const fromFriction = Array.isArray(step.friction_tools) ? step.friction_tools : []
    const candidates = fromFriction.length > 0 ? fromFriction : globalToolMentions
    const deduped = Array.from(new Set(candidates.map((s) => s.trim()).filter(Boolean)))
    if (deduped.length === 0) return step

    mutated = true
    emits.push({ stepTitle: step.title, value: deduped })
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

  if (!mutated) return null
  return { tracker: updated, emits }
}

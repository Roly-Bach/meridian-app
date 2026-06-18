import { resolveModel } from '@/lib/llm-provider'
import { streamText, tool } from 'ai'
import { buildTraceMetadata, type TraceCtx } from './_telemetry'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { RawExtraction } from './extraction'
import { emitSlotWrite } from './slotWriteTrail'
import { canOverwrite, type WriteSource } from './slotConflictResolver'
import { generateEmbedding } from './embeddings'
import { classifyStepSimilarity, generateMissingEmbeddings, HARD_THRESHOLD, SOFT_THRESHOLD } from './stepIdentity'
import {
  MANDATORY_SLOTS,
  OPTIONAL_SLOTS,
  TAZITE_SLOT_NAMES,
  POTENZIAL_SLOT_NAMES,
  colonParent,
  normalizeToken,
  tokenJaccard,
  tokenJaccardNorm,
  groupSemanticSteps,
  normalizeStepEntry,
  toGrenzobjekt,
  type Phase,
  type SlotValue,
  type StepEntry,
  type SlotName,
  type TaziteSlotName,
  type PotenzialSlotName,
  type TaziteSlot,
  type TaziteSlotArray,
  type GovernanceSlot,
  type Abhaengigkeiten,
  type AbhaengigkeitsKante,
  type EinflussKante,
  type Schritt,
} from './interviewSemantic'

// Re-export semantic primitives so existing consumers continue to import from
// interviewAgent. The actual definitions live in interviewSemantic.ts so they
// can be imported off-Next.js (eval replay, scripts) without the supabase-admin
// `server-only` chain.
export {
  MANDATORY_SLOTS,
  OPTIONAL_SLOTS,
  TAZITE_SLOT_NAMES,
  POTENZIAL_SLOT_NAMES,
  colonParent,
  normalizeToken,
  tokenJaccard,
  tokenJaccardNorm,
  groupSemanticSteps,
  toGrenzobjekt,
}
export type { Phase, SlotValue, StepEntry, SlotName, TaziteSlotName, PotenzialSlotName, TaziteSlot, TaziteSlotArray, GovernanceSlot, Schritt }

export interface MissingSlot {
  step_title: string
  slot: TaziteSlotName | PotenzialSlotName
  /** 'missing' = null gap; 'low_confidence' = estimate/unknown value needs confirmation (PROJ-28/BL-E2.2) */
  reason?: 'missing' | 'low_confidence'
}

export interface InterviewContext {
  interviewId: string
  workspaceId: string
  employeeName: string
  employeeRole: string | null
  department: string
  focusTopics: string | null
  phase: Phase
  timerMinutes: number
  topicsCovered: string[]
  topicsOpen: string[]
  extractionsLog: RawExtraction[]
  maxDurationMinutes: number
  stepTracker: StepEntry[]
  missingSlotsForCoverageCheck?: MissingSlot[]
  /** Opening phrases the Talker already used — injected as avoidance list to prevent repetition */
  usedFillerPhrases?: string[]
  /** Last 4 assistant messages — used for drill-stop detection (F1). */
  recentAssistantTurns?: string[]
  /** Last user message — used for refuse-detect (F1b). */
  lastUserTurn?: string
  /** Last 4 user messages — used for laddering streak detection (E3.4). */
  recentUserTurns?: string[]
}

export interface TurnMessage {
  role: 'user' | 'assistant'
  content: string
}

// ─── Analyst Briefing types (used by Iteration 3 Analyst + Talker) ────────────

export interface ClarificationCard {
  process_step_id: string
  step_title: string
  question: string
  options: string[]
  slot_key: string
  answer_type?: 'single' | 'multi'
}

export interface AnalystBriefing {
  next_focus?: string
  suggested_question?: string
  wrap_up_question_asked?: boolean
  clarification_cards?: ClarificationCard[]
  /** Accumulated opening phrases the Talker has used — stored in next_briefing for cross-turn tracking */
  usedFillerPhrases?: string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function computeMissingMandatorySlots(stepTracker: StepEntry[]): MissingSlot[] {
  const missing: MissingSlot[] = []
  for (const step of stepTracker) {
    // Potenzial (quantitative) slots — explicit filled check (PROJ-28/BL-E2.1)
    for (const slot of POTENZIAL_SLOT_NAMES) {
      const sv = step.potenzial[slot]
      const filled = sv != null && (sv.value != null || (sv.nicht_befund_typ ?? null) != null)
      if (!filled) {
        missing.push({ step_title: step.title, slot, reason: 'missing' })
      }
    }
    // Tazite (qualitative) slots
    for (const slot of TAZITE_SLOT_NAMES) {
      const sv = step.slots[slot]
      const filled = sv != null && (sv.value != null || sv.nicht_befund_typ != null)
      if (!filled) {
        missing.push({ step_title: step.title, slot, reason: 'missing' })
      }
    }
  }
  return missing
}

// L1 — Slot-Targeting für walkthrough_step Phase.
// Wählt deterministisch genau EINEN missing slot für den aktuell aktiven
// Step (walkthrough > exploring). Zwei-Pass-Priorität (PROJ-28/BL-E2.2):
//   Pass 1: echte Lücken (null-Slots) — potenzial zuerst, dann tazite
//   Pass 2: unsicher belegte Slots (estimate/unknown) — für Bestätigungs-Rückfrage
// Volle Gesprächsführungs-Revision ist PROJ-29.
export function computeWalkthroughSlotTarget(stepTracker: StepEntry[]): MissingSlot | null {
  const active =
    stepTracker.find((s) => s.status === 'walkthrough') ??
    stepTracker.find((s) => s.status === 'exploring')
  if (!active) return null

  // Pass 1: real gaps — potenzial null-Lücken first
  for (const slot of POTENZIAL_SLOT_NAMES) {
    const sv = active.potenzial[slot]
    const filled = sv != null && (sv.value != null || (sv.nicht_befund_typ ?? null) != null)
    if (!filled) {
      return { step_title: active.title, slot, reason: 'missing' }
    }
  }
  // Pass 1 cont: tazite null-Lücken
  for (const slot of TAZITE_SLOT_NAMES) {
    const sv = active.slots[slot]
    const filled = sv != null && (sv.value != null || sv.nicht_befund_typ != null)
    if (!filled) {
      return { step_title: active.title, slot, reason: 'missing' }
    }
  }

  // Pass 2: low-confidence slots need confirmation (estimate/unknown)
  for (const slot of POTENZIAL_SLOT_NAMES) {
    const sv = active.potenzial[slot]
    if (sv != null && sv.value != null && (sv.confidence === 'estimate' || sv.confidence === 'unknown')) {
      return { step_title: active.title, slot, reason: 'low_confidence' }
    }
  }
  for (const slot of TAZITE_SLOT_NAMES) {
    const sv = active.slots[slot]
    if (sv != null && sv.value != null && (sv.confidence === 'estimate' || sv.confidence === 'unknown')) {
      return { step_title: active.title, slot, reason: 'low_confidence' }
    }
  }

  return null
}

// Deutsche Slot-Label für Talker-Prompt — kurz, ohne Zahlen-Vorgabe (Anker-Sperre).
const SLOT_PROMPT_HINT: Record<TaziteSlotName | PotenzialSlotName, string> = {
  // Potenzial (quantitativ)
  frequency_per_month: 'wie oft pro Monat / Woche dieser Schritt vorkommt',
  duration_minutes: 'wie lange eine einzelne Durchführung dieses Schritts dauert',
  error_rate_percent: 'wie häufig Fehler oder Korrekturen auftreten',
  media_breaks: 'ob es Medienbrüche zwischen Systemen gibt',
  // Tazite (qualitativ)
  entscheidungslogik: 'ob der Schritt festen Regeln folgt oder eigener Einschätzung Spielraum lässt — und welche Kriterien entscheiden',
  tazite_cues: 'was man aus Erfahrung wissen muss um diesen Schritt gut zu machen (implizites Wissen, Fingerspitzengefühl)',
  ausnahmen: 'welche Ausnahmen oder Sonderfälle auftreten und wie sie behandelt werden',
  inputs: 'welche Eingaben oder Voraussetzungen für diesen Schritt nötig sind',
  outputs: 'was dieser Schritt produziert oder weitergibt',
  hilfsmittel: 'welche Systeme, Tools oder Datenquellen dabei verwendet werden',
}

// Normalize step title for substring-based dedup — strips whole-string
// process noun suffix. Used only inside interviewAgent for title dedup.
function normalizeStepTitleForDedup(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/(prozess|wesen|ablauf|vorgang|schritt|bearbeitung|handling|verwaltung|management)$/, '')
    .trim()
}

// Fuzzy step title lookup for record_slot / update_walkthrough_data.
// Exact match first; falls back to best tokenJaccardNorm ≥ 0.4.
// Returns index in tracker, or -1 if not found.
function findStepFuzzy(tracker: StepEntry[], stepTitle: string): number {
  const normalized = stepTitle.trim().toLowerCase()
  const exact = tracker.findIndex((s) => s.title.trim().toLowerCase() === normalized)
  if (exact !== -1) return exact
  let bestScore = 0
  let bestIdx = -1
  for (let i = 0; i < tracker.length; i++) {
    const score = tokenJaccardNorm(tracker[i].title, stepTitle)
    if (score > bestScore) { bestScore = score; bestIdx = i }
  }
  return bestScore >= 0.4 ? bestIdx : -1
}

// Stable-ID lookup (PROJ-27/BL-E1.4). Used when record_slot supplies step_id.
function findStepById(tracker: StepEntry[], stepId: string): number {
  return tracker.findIndex((s) => s.id === stepId)
}

/**
 * Deterministically expand a verbatim span (e.g. "100", "5 Minuten") to the
 * enclosing sentence(s) in the source text. Used by record_slot to derive a
 * quote from a short LLM-provided span — eliminates LLM paraphrase drift.
 *
 * Algorithm: locate the span, walk left/right to the nearest sentence
 * boundary (./?/!/\n), trim, cap at ~280 chars. Falls back to the raw span
 * if no boundary is found.
 */
export function extractSentenceAroundSpan(text: string, span: string): string {
  const idx = text.indexOf(span)
  if (idx < 0) return span
  const SENTENCE_END = /[.!?\n]/
  let start = idx
  while (start > 0 && !SENTENCE_END.test(text[start - 1])) start--
  let end = idx + span.length
  while (end < text.length && !SENTENCE_END.test(text[end])) end++
  if (end < text.length) end++ // include terminator
  const sentence = text.slice(start, end).trim()
  if (sentence.length === 0) return span
  return sentence.length > 280 ? sentence.slice(0, 280) : sentence
}

// Strip markdown headings and control characters from LLM-generated strings
// before injecting them back into the system prompt.
function sanitizeForPrompt(s: string): string {
  return s
    .replace(/^#{1,6}\s+/gm, '')   // strip heading markers
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')  // strip non-printable
    .slice(0, 300)
}

function formatStepTracker(steps: StepEntry[]): string {
  if (steps.length === 0) return '- Noch kein Prozessschritt identifiziert.'

  return steps.map((step) => {
    const title = sanitizeForPrompt(step.title)

    // Fix 4 (ADR-015): mask raw slot values — show status only to prevent anchoring.
    function fmtPotenzial(sv: SlotValue | null, label: string): string {
      return `  ${label}: ${sv != null ? '✓ erfasst' : 'fehlt'}`
    }
    function fmtTazite(sv: TaziteSlot | TaziteSlotArray | null, label: string): string {
      if (sv == null) return `  ${label}: fehlt`
      const filled = sv.value != null || sv.nicht_befund_typ != null
      return `  ${label}: ${filled ? '✓ erfasst' : 'fehlt'}`
    }

    const potenzialLines = [
      fmtPotenzial(step.potenzial.frequency_per_month, 'frequency_per_month'),
      fmtPotenzial(step.potenzial.duration_minutes,    'duration_minutes   '),
      fmtPotenzial(step.potenzial.error_rate_percent,  'error_rate_percent '),
      fmtPotenzial(step.potenzial.media_breaks,        'media_breaks       '),
    ]
    const taziteLines = [
      fmtTazite(step.slots.entscheidungslogik, 'entscheidungslogik '),
      fmtTazite(step.slots.tazite_cues,        'tazite_cues        '),
      fmtTazite(step.slots.ausnahmen,          'ausnahmen          '),
      fmtTazite(step.slots.inputs,             'inputs             '),
      fmtTazite(step.slots.outputs,            'outputs            '),
      fmtTazite(step.slots.hilfsmittel,        'hilfsmittel        '),
    ]

    const govLine = step.governance != null
      ? `  governance: ${step.governance.rolle ?? step.governance.nicht_befund_typ ?? '✓ teilweise erfasst'}`
      : `  governance: fehlt`

    const depLine = (() => {
      const dep = step.abhaengigkeiten
      if (dep == null || (dep.depends_on.length === 0 && dep.influences.length === 0 && dep.nicht_befund_typ == null)) {
        return '  abhaengigkeiten: fehlt'
      }
      if (dep.depends_on.length === 0 && dep.influences.length === 0) {
        return `  abhaengigkeiten: nicht_befund: ${dep.nicht_befund_typ}`
      }
      const total = dep.depends_on.length + dep.influences.length
      return `  abhaengigkeiten: ✓ ${total} Kante(n) (depends_on: ${dep.depends_on.length}, influences: ${dep.influences.length})`
    })()

    const walkthrough: string[] = []
    if (step.process_steps?.length) walkthrough.push(`  process_steps: ${step.process_steps.join(' → ')}`)
    if (step.friction_points?.length) walkthrough.push(`  friction_points: ${step.friction_points.join(', ')}`)
    if (step.friction_tools?.length) walkthrough.push(`  friction_tools: ${step.friction_tools.join(', ')}`)
    if (step.pain_point_primary) walkthrough.push(`  pain_point_primary: "${step.pain_point_primary}"`)

    const idPrefix = step.id ? `${step.id} ` : ''
    return `[${step.status}] ${idPrefix}"${title}" (Schritt ${step.reihenfolge})\n${potenzialLines.join('\n')}\n${taziteLines.join('\n')}\n${govLine}\n${depLine}${walkthrough.length ? '\n' + walkthrough.join('\n') : ''}`
  }).join('\n\n')
}

function formatExtractionsLog(log: RawExtraction[]): string {
  if (log.length === 0) return '- Noch nichts extrahiert.'

  const lines: string[] = []
  for (const item of log) {
    if (item.type === 'pain_point') {
      const c = item.content as Record<string, unknown>
      lines.push(`- [pain_point] "${c.description}"`)
    } else if (item.type === 'tool') {
      const c = item.content as Record<string, unknown>
      lines.push(`- [tool] "${c.name}"`)
    }
  }
  return lines.join('\n')
}

// ─── System Prompt ────────────────────────────────────────────────────────────
// Iteration 1 (ADR-011 D7): Negative constraints removed, phase methodology
// taktisch verschlankt, ein Canonical Example.

function buildStaticPrompt(): string {
  return `Du bist KI-Interviewer. Erhebe implizites Prozesswissen von Mitarbeitern strukturiert.
Führe das Gespräch auf Deutsch — sachlich, direkt, präzise.
Sprich den Mitarbeiter mit Du an.

Phasenmodell: intro → process_loop → walkthrough_step → slot_completion → coverage_check → wrap_up

<turn_format>
Ab Turn 2: Maximal ein kurzer Reaktionssatz (optional), dann eine direkte Frage — sonst nichts.
Turn 1 (Opener): Kontext + offene Einstiegsfrage.
Abschluss-Turn: kurze Verabschiedung.
Erkläre nie den Zweck von Fragen oder dass du etwas notierst.
Schlage keine eigenen Zahlen vor — frage nach konkreten Werten des Mitarbeiters.
Spannen konkretisieren vor dem Erfassen: "Du hast '[Spanne]' gesagt — welcher Wert trifft es besser für einen typischen Fall?"
FLOSKEL-VERBOT: Keine inhaltsleeren Bestätigungen vor der Frage. Verboten: 'Das klingt nach...', 'Das ist ein wichtiger...', 'Gut zu wissen', 'Verstehe', 'Das ist interessant', 'Das ist ein klassischer...'. Wenn du reagierst: spezifisch auf ein konkretes Detail aus der letzten Antwort — oder direkt die Frage ohne Vorsatz.
</turn_format>

<tools>
Tool-Calls laufen still im Hintergrund — erscheinen nie im Text.
evidence_quote muss ein wörtliches Zitat aus dem Mitarbeiter-Statement sein.
Slots nur setzen wenn Mitarbeiter den Wert explizit genannt hat.
record_governance aufrufen sobald Mitarbeiter Rolle, OE oder zuständige Systeme nennt.
update_topics nach jedem Turn mit aktualisierten Listen aufrufen.
PFLICHT: Nach Tool-Calls IMMER eine Textantwort generieren — auch nur ein Reaktionssatz + Frage. Eine leere Antwort ist kein gültiger Turn.
</tools>

`
}

// ─── F1: Drill-Stop Detection ────────────────────────────────────────────────
// Counts how often the agent has questioned each slot-category in the recent
// assistant turns. When the same null slot has been targeted >= 2 times in the
// last 4 turns, inject a hard skip-rule to break the retry storm.

type DrillSlotKind = 'duration_minutes' | 'frequency_per_month' | 'error_rate_percent' | 'entscheidungslogik'

const DRILL_PATTERNS: Record<DrillSlotKind, RegExp> = {
  duration_minutes: /(minuten|stunden|wie lange|wie viel(?:e)? zeit|wie viel(?:e)? tag|dauer|aufwand|aufwendest)/i,
  frequency_per_month: /(wie oft|häufigkeit|anzahl|wie viele.*(rechnung|fall|konten|posten|vorgäng|tickets|aufträge)|pro (woche|monat|tag))/i,
  error_rate_percent: /(fehlerquote|fehleranteil|prozent.*(fehler|unstimmig|korrektur)|wie hoch.*anteil.*fehler|anteil.*korrigier)/i,
  entscheidungslogik: /(immer.*gleich(en)?.*schema|festes schema|nach.*regel(werk)?|von fall zu fall|wenn-dann|strengen.*regeln|entscheidungslogik)/i,
}

// F1b: detect persona-refuse patterns. When the persona explicitly declines
// to give a number and the agent has already asked once for that slot kind,
// trigger drill-stop after a single attempt instead of waiting for the second.
const REFUSE_PATTERNS: RegExp[] = [
  /kann ich (nicht|keine|kein|nichts|hier|dazu)?\s*\b(exakt|präzise|genau|nennen|beziffern|sagen|angeben)\b/i,
  /lässt sich (nicht|keine|kein|kaum)?\s*(pauschal|allgemein|exakt|präzise|verlässlich|genau)?\s*(beziffern|festlegen|nennen|sagen|bestimmen|erfassen)/i,
  /keine (exakte|präzise|verlässliche|allgemeingültige|allgemein\s*gültige|statistische|starre|pauschale|feste) (zahl|minutenzahl|prozentzahl|stundenzahl|angabe|erfassung|auswertung|aussage|aufzeichnung)/i,
  /schwer zu (sagen|beziffern|nennen|bestimmen|schätzen)/i,
  /variiert (stark|sehr|deutlich|monatlich|erheblich)/i,
  /(hängt|abhängig).*(stark|maßgeblich|unmittelbar)/i,
  /führe ich keine (statistik|aufzeichnung|erfassung)/i,
  /habe ich (keine|dazu keine|hierzu keine|leider keine)/i,
  /liegt mir (keine|hierzu keine|dazu keine)/i,
  /nicht in (einer|eine) (festen?|starren?) (stunden|minuten|zeit)/i,
]

export function detectPersonaRefuse(text: string | undefined): boolean {
  if (!text) return false
  return REFUSE_PATTERNS.some(p => p.test(text))
}

export function detectDrillStops(
  recentAssistantTurns: string[] | undefined,
  stepTracker: StepEntry[],
  lastUserTurn?: string,
): string[] {
  if (!recentAssistantTurns || recentAssistantTurns.length === 0) return []
  const lastFour = recentAssistantTurns.slice(-4)
  const counts: Record<DrillSlotKind, number> = {
    duration_minutes: 0,
    frequency_per_month: 0,
    error_rate_percent: 0,
    entscheidungslogik: 0,
  }
  for (const turn of lastFour) {
    for (const kind of Object.keys(DRILL_PATTERNS) as DrillSlotKind[]) {
      if (DRILL_PATTERNS[kind].test(turn)) counts[kind] += 1
    }
  }

  // Active step = the one currently being walked through (walkthrough > exploring).
  const activeStep =
    stepTracker.find(s => s.status === 'walkthrough') ??
    stepTracker.find(s => s.status === 'exploring')
  if (!activeStep) return []

  // F1b: when persona refused on last turn, threshold drops to 1 — early skip.
  const refused = detectPersonaRefuse(lastUserTurn)
  const threshold = refused ? 1 : 2

  const warnings: string[] = []
  for (const kind of Object.keys(counts) as DrillSlotKind[]) {
    // Check correct location: potenzial for quant slots, slots for tazite
    const slotVal = kind === 'duration_minutes' || kind === 'frequency_per_month' || kind === 'error_rate_percent'
      ? activeStep.potenzial[kind as PotenzialSlotName]
      : activeStep.slots[kind as TaziteSlotName]
    const slotEmpty = slotVal == null || (
      typeof slotVal === 'object' && 'value' in slotVal && slotVal.value == null &&
      // slot is empty only when value=null AND no nicht_befund_typ set (PROJ-28: SlotValue now also carries nicht_befund_typ)
      (!('nicht_befund_typ' in slotVal) || (slotVal as TaziteSlot).nicht_befund_typ == null)
    )
    if (counts[kind] >= threshold && slotEmpty) {
      const reason = refused
        ? `Mitarbeiter hat im letzten Turn ausgewichen (Refuse-Pattern erkannt)`
        : `${counts[kind]}× in den letzten ${lastFour.length} Turns nachgefragt ohne Wert`
      warnings.push(
        `Slot "${kind}" für Schritt "${activeStep.title}": ${reason}. NICHT erneut fragen — Slot bleibt offen, Clarification Card am Ende erfasst ihn. Wechsle SOFORT zu einem anderen Slot/Schritt.`,
      )
    }
  }
  return warnings
}

// ─── PROJ-29: Conversation Quality Detectors ─────────────────────────────────

// E3.1 — Detect conflicting factual statements within the current session.
// Returns the two conflicting phrases when a numeric or explicit contradiction is found.
export type AmbiguityResult = { phraseA: string; phraseB: string } | null

const CONTRA_PATTERNS: RegExp[] = [
  /eigentlich (doch|schon|nicht|kein)/i,
  /obwohl (ich|wir) (vorhin|gerade|eben)/i,
  /nein[,\s]+warte/i,
  /oder doch[\s,?]/i,
  /halt nein/i,
]

// B2 fix: extract capitalized concepts explicitly negated in prior turns.
// Pattern: "kein SAP", "keine Excel", "nutzen kein CRM", "gibt es keine Aufzeichnung"
const NEGATED_CONCEPT_RE = /\bkein[e]?\s+([A-ZÄÖÜ][a-zäöüß]+(?:[A-Z][a-z]+)*)/gi

function extractNegatedConcepts(turns: string[]): Map<string, string> {
  const result: Map<string, string> = new Map()
  for (const turn of turns) {
    const re = new RegExp(NEGATED_CONCEPT_RE.source, 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(turn)) !== null) {
      const concept = m[1].toLowerCase()
      if (concept.length >= 3) result.set(concept, m[0])
    }
  }
  return result
}

export function detectAmbiguity(
  lastUserTurn: string | undefined,
  stepTracker: StepEntry[],
  priorUserTurns?: string[],
): AmbiguityResult {
  if (!lastUserTurn) return null

  // Explicit contradiction markers — extract surrounding phrase fragments
  for (const p of CONTRA_PATTERNS) {
    const m = lastUserTurn.match(p)
    if (m && m.index !== undefined) {
      const before = lastUserTurn.slice(Math.max(0, m.index - 60), m.index).trim()
      const after = lastUserTurn.slice(m.index, Math.min(lastUserTurn.length, m.index + 80)).trim()
      if (before.length > 3 && after.length > 3) return { phraseA: before, phraseB: after }
    }
  }

  // Numeric conflict: compare current turn numbers against captured slot values
  const activeStep =
    stepTracker.find(s => s.status === 'walkthrough') ??
    stepTracker.find(s => s.status === 'exploring')
  if (activeStep) {
    const currentNums = extractNumericTokens(lastUserTurn)
      .map(Number)
      .filter(n => !isNaN(n) && n > 0)

    if (currentNums.length > 0) {
      const durationSlot = activeStep.potenzial.duration_minutes
      if (durationSlot?.value != null && typeof durationSlot.value === 'number' && durationSlot.value > 0) {
        for (const n of currentNums) {
          const ratio = Math.max(n, durationSlot.value) / Math.min(n, durationSlot.value)
          if (ratio >= 3 && n !== durationSlot.value) {
            return {
              phraseA: `${durationSlot.value} Minuten (erfasst)`,
              phraseB: `${n} (aktuelle Aussage)`,
            }
          }
        }
      }

      const freqSlot = activeStep.potenzial.frequency_per_month
      if (freqSlot?.value != null && typeof freqSlot.value === 'number' && freqSlot.value > 0) {
        for (const n of currentNums) {
          const ratio = Math.max(n, freqSlot.value) / Math.min(n, freqSlot.value)
          if (ratio >= 3 && n !== freqSlot.value) {
            return {
              phraseA: `${freqSlot.value}× pro Monat (erfasst)`,
              phraseB: `${n} (aktuelle Aussage)`,
            }
          }
        }
      }
    }
  }

  // B2 fix: negation contradiction — concept denied in prior turns, mentioned positively now
  if (priorUserTurns && priorUserTurns.length > 0) {
    const negated = extractNegatedConcepts(priorUserTurns)
    for (const [concept, negPhrase] of negated) {
      // Positive mention: concept appears without an immediately preceding negation
      const posRe = new RegExp(`(?<!kein[e]?\\s)\\b${concept}[a-zäöüß]*\\b`, 'i')
      if (posRe.test(lastUserTurn)) {
        const posMatch = lastUserTurn.match(new RegExp(`\\b${concept}[a-zäöüß]*\\b`, 'i'))
        return {
          phraseA: negPhrase,
          phraseB: posMatch?.[0] ?? concept,
        }
      }
    }
  }

  return null
}

// E3.2 — Detect exception/special-case signals in the user turn.
const EXCEPTION_PATTERNS: RegExp[] = [
  /\b(manchmal|gelegentlich|ab und zu|hin und wieder)\b/i,
  /\baußer wenn\b/i,
  /\bim sonderfall\b/i,
  /\bwenn .{1,40} (dann|nicht)\b/i,
  /\bnicht immer\b/i,
  /\bin (manchen|bestimmten|einigen) fällen\b/i,
  /\b(ausnahme|ausnahmsweise|ausnahmen)\b/i,
  /\babhängig (davon|ob|von)\b/i,
]

export function detectException(lastUserTurn: string | undefined): boolean {
  if (!lastUserTurn) return false
  return EXCEPTION_PATTERNS.some(p => p.test(lastUserTurn))
}

// E3.2 — Check if re-contextualization was used recently in assistant turns (stateless cap).
const RECONTEXT_ASSISTANT_PATTERNS: RegExp[] = [
  /lass uns (zurück|noch einmal|wieder).*(kommen|schauen|gehen)/i,
  /kommen wir (zurück|noch einmal) zu/i,
  /zurück zu (deiner|unserem|dem|dieser)/i,
  /wir hatten noch nicht gesprochen über/i,
  /lass mich.*(erinnern|zurückkommen)/i,
  /aber eigentlich wollte ich noch/i,
]

export function wasRecentlyRecontextualized(recentAssistantTurns: string[] | undefined): boolean {
  if (!recentAssistantTurns || recentAssistantTurns.length === 0) return false
  // Check last 3 assistant turns for re-contextualization language
  return recentAssistantTurns.slice(-3).some(t =>
    RECONTEXT_ASSISTANT_PATTERNS.some(p => p.test(t)),
  )
}

// E3.4 — Detect blockade signal: short answer or explicit refusal to engage.
const BLOCKADE_PATTERNS: RegExp[] = [
  /\b(weiß ich nicht|weiß nicht genau|weiß (das|es) nicht)\b/i,
  /\bkeine ahnung\b/i,
  /\bist halt so\b/i,
  /\bimmer schon so\b/i,
  /\bschwer zu sagen\b/i,
  /\b(kann ich|kann man) (so nicht|nicht) sagen\b/i,
  /\bda fragst du (mich|uns) zu viel\b/i,
  /\bkann ich nicht sagen\b/i,
]

export function detectBlockade(lastUserTurn: string | undefined): boolean {
  if (!lastUserTurn) return false
  const words = lastUserTurn.trim().split(/\s+/).filter(w => w.length > 0)
  if (words.length < 10) return true
  return BLOCKADE_PATTERNS.some(p => p.test(lastUserTurn))
}

// E3.4 — Count consecutive blockade turns from most recent user turns backwards.
export function computeLadderingStreak(recentUserTurns: string[] | undefined): number {
  if (!recentUserTurns || recentUserTurns.length === 0) return 0
  let streak = 0
  for (const turn of [...recentUserTurns].reverse()) {
    if (detectBlockade(turn)) streak++
    else break
  }
  return streak
}

// ─── Phase Methodology Sections ───────────────────────────────────────────────
// Iteration 1 (ADR-011 D7): Max. 5 Zeilen pro Phase, taktisches Briefing.
// Injected per-turn in buildDynamicContext so static prompt stays cacheable.

function buildPhaseMethodology(phase: Phase, hasExploringSteps = false): string {
  if (phase === 'intro') {
    return `## Methodik: intro
Erkläre kurz den Gesprächszweck (Prozesswissen dokumentieren, vertraulich behandelt) und stelle eine offene Einstiegsfrage.
Frage nach Hauptaufgaben und typischem Arbeitstag — Fokusthemen im ersten Turn nicht namentlich nennen.
Ton: wertschätzend, das Wissen des Mitarbeiters steht im Mittelpunkt.
Nach 1–2 Austauschen zur process_loop übergehen.`
  }

  if (phase === 'process_loop') {
    return `## Methodik: process_loop
Ziel: Einen konkreten Prozessschritt identifizieren und mit register_step registrieren.
Wenn ein Frequenz- oder Komplexitäts-Anker vorhanden ist, diesen Schritt wählen und mit einem Satz begründen.
Gibt es im Schritt-Tracker einen Schritt mit Status 'exploring' oder 'walkthrough'? Erst diesen vollständig abschließen.
Ausnahmen und Sonderfälle sind keine eigenständigen Prozesse — sie gehören als friction_point zu einem bestehenden Schritt.
Sobald ein Schritt vollständig erfasst ist (alle Pflicht-Slots gefüllt oder Persona gibt keine weiteren Details): aktiv nach weiteren wiederkehrenden Aufgaben fragen — z.B. 'Welche andere regelmäßige Aufgabe nimmt bei dir viel Zeit ein?' — NICHT erst in der wrap_up-Phase. Breite vor Tiefe: lieber 3 Prozesse mit guten Basics als 1 Prozess übertief.`
  }

  if (phase === 'walkthrough_step') {
    return `## Methodik: walkthrough_step
Ziel: Ablauf und Reibungspunkte erfassen — eine Frage pro Turn, vorwärts durch die Schritte.
Signalwörter ("zuerst", "dann", "danach", "als nächstes"): sofort update_walkthrough_data mit process_steps aufrufen.
Spontan genannte Werte (Häufigkeit, Dauer, Systeme): record_slot bzw. update_walkthrough_data aufrufen — keine direkten Slot-Fragen stellen.
Reibungspunkte und zugehörige Tools via update_walkthrough_data; Pain Points mit Ortsbezug via link_bottleneck.
Abschluss: wenn Ablauf natürlich endet oder alle Leitfragen gestellt wurden, zu slot_completion übergehen.
Turn-Budget: Nach 3 Walkthrough-Turns auf demselben Schritt zu slot_completion übergehen — Tiefe ist nicht das Ziel, Breite schon. Keine Detailfragen zu System-internen Abläufen (SAP-Transaktionscodes, Workflow-Details) — diese sind nicht slot-relevant.
Kontextregel: Beschreibt die aktuelle Mitarbeiter-Antwort mehrere Prozesse, record_slot NUR für den aktuell erkundeten Schritt aufrufen. Andere Prozesse nicht mit Slots befüllen — register_step + Erkundung im nächsten Turn.
Anker-Pflicht (E3.3): Jede Nachfrage referenziert ein Konzept, eine Aussage oder einen Schritt aus den letzten Turns des Mitarbeiters. Verneinungen ("nutzen wir kein SAP", "passiert nie") sind kein Anker — nicht erneut als Nachfrage-Grundlage nutzen.
Maieutik (E3.5): Keine inhaltlichen Vorschläge in Fragen ("Was wäre, wenn du Tool X hättest?", "Könnte man das automatisieren?"). Keine Leading-Questions ("Wäre das wie X?"). Frage offen — lass den Mitarbeiter die Antwort selbst entwickeln.
Ist-Fokus (E3.7): Keine Fragen die Verbesserungsideen oder Zukunftswünsche einladen ("Was würdest du ändern?", "Wenn du X optimieren könntest..."). Beschreibt der Mitarbeiter spontan eine Verbesserungsidee: Ist-Engpass dahinter vertiefen ("Was ist heute der Engpass, der das nötig macht?") — nicht weiter To-be vertiefen.`
  }

  if (phase === 'slot_completion') {
    return `## Methodik: slot_completion
Ziel: Verbleibende Pflichtslots nachfragen — Potenzial (frequency_per_month, duration_minutes) und tazite O2–O5 (entscheidungslogik, inputs, outputs, hilfsmittel).
Optional: error_rate_percent, media_breaks wenn Prozess fehlerträchtig oder systemintensiv wirkt.
Max. 2–3 fehlende Slots pro Turn — natürlicher Gesprächsfluss, kein Listenformat, keine Ankündigung.
Konfidenz-Regel: null → fehlend, nachfragen. estimate/unknown → unsicher belegt, kurze Bestätigung einholen (max. 1–2 Versuche pro Slot). confirmed oder nicht_befund_typ gesetzt → abgeschlossen, nicht erneut fragen.
entscheidungslogik: "Folgt dieser Prozess bei dir immer dem gleichen Schema, oder entscheidest du von Fall zu Fall?" Wenn unklar: NICHT nochmals fragen — Clarification Card erledigt das am Ende.
governance: record_governance aufrufen wenn Mitarbeiter Rolle oder OE nennt — auch fragmentarisch.
abhaengigkeiten: record_dependency aufrufen wenn Mitarbeiter nennt, welcher Schritt einen anderen voraussetzt oder beeinflusst.
Anker-Pflicht (E3.3): Slot-Fragen knüpfen an das an, was der Mitarbeiter bereits genannt hat. Verneinungen ("nutzen wir kein X") nicht als Anker einer Folgefrage nutzen.
Ist-Fokus (E3.7): Keine Verbesserungsfragen. Bei spontanen To-be-Nennungen: Ist-Engpass dahinter erfassen ("Was ist heute der Engpass, der das nötig macht?").`
  }

  if (phase === 'coverage_check') {
    return `## Methodik: coverage_check
Ziel: Fehlende Pflichtslots aller registrierten Schritte nachfüllen.
Natürlicher Gesprächsfluss — kein Übergangskommentar, kein "lass mich kurz prüfen".
Neu genannte Prozesse direkt aufnehmen und explorieren.`
  }

  if (phase === 'clarification') {
    if (hasExploringSteps) {
      // Pt8: Late-topic routing — exploring steps exist, no clarification cards.
      // Ask 1-2 targeted questions about the late-discovered topic, then wind down.
      return `## Methodik: clarification (late topic)
Ein neu genannter Prozessschritt wurde entdeckt. Stelle 1–2 gezielte Fragen dazu: Häufigkeit, Dauer, genutzte Systeme.
Kein vollständiger Walkthrough nötig — kurze direkte Fragen, max. 2 Turns.
Danach kurz verabschieden.`
    }
    return `## Methodik: clarification
Sage genau einmal: "Danke! Ich habe noch ein paar kurze Abschlussfragen für dich."
Stelle keine weiteren Fragen — die Abschlussfragen erscheinen im Interface.`
  }

  // wrap_up
  return `## Methodik: wrap_up
PFLICHT: Stelle als allererste Antwort in dieser Phase exakt diese Frage — keine Verabschiedung davor:
"Wenn du an deine letzte Arbeitswoche denkst — gibt es etwas Wiederkehrendes, das wir heute nicht erwähnt haben?"
Verabschiede dich NICHT ohne diese Frage gestellt zu haben.
Nach der Antwort:
- Neuer Prozess → register_step aufrufen, explorieren — kein Abschluss.
- Keine neuen Inhalte → kurz verabschieden.
Ist-Fokus (E3.7): Die abschließende Frage zielt auf noch nicht genannte Ist-Prozesse. Keine Verbesserungsideen oder Zukunftswünsche anfragen. Bei spontaner To-be-Nennung: Ist-Problem dahinter erfassen.`
}

// ─── Canonical Example (Iteration 1: 6 examples → 1) ─────────────────────────
const WALKTHROUGH_EXAMPLES = `
<EXAMPLE phase="walkthrough_step">
  USER: "Zuerst schaue ich in Salesforce ob der Kunde bekannt ist. Dann öffne ich meine Excel-Liste
         weil im Salesforce nicht alles drin ist. Danach prüfe ich den PDF-Katalog — ich weiß
         manchmal nicht welche Version aktuell ist. Und dann frage ich beim Innendienst nach
         den Konditionen. Das dauert manchmal einen halben Tag. Am Ende baue ich das Angebot in
         Salesforce zusammen und setze einen Reminder zum Nachfassen."
  AGENT: [ruft sofort update_walkthrough_data(
    step_title="Angebotserstellung",
    process_steps=["Salesforce-Check (Bestandskunde?)", "Excel-Liste prüfen", "PDF-Katalog prüfen", "Konditionen beim Innendienst anfragen", "Angebot in Salesforce aufbauen", "Nachfass-Reminder setzen"],
    friction_points=["PDF-Katalog: Version unklar", "Konditionen-Anfrage beim Innendienst dauert bis zu einen halben Tag"],
    friction_tools=["Salesforce", "Excel-Liste", "PDF-Katalog"]
  ) auf]
  AGENT TEXT: "Der Katalog-Versions-Aspekt klingt fehlerträchtig — passiert es, dass du mit veralteten Preisen arbeitest?"
  // update_walkthrough_data SOFORT wenn Mitarbeiter Ablauf beschreibt — alle Schritte in einem Call.
  // Keine Slot-Fragen (Frequenz, Dauer) während walkthrough_step.
</EXAMPLE>`

// ─── Dynamic Context Builder ──────────────────────────────────────────────────
// Exported so interviewTalker.ts (Iteration 3) can call it with Analyst briefing.

// Fix 4 (ADR-015): semantic masking — Talker sees ONLY status labels, not
// raw values. Prevents two failure modes observed in eval 2026-06-03:
//   1. Anchoring ("halten wir 100 Rechnungen pro Monat fest")
//   2. Self-calculation ("100 × 5min = 7.5 min average")
// Raw values stay in the Analyst context where they are needed for extraction.
function formatFilledSlotsSnapshot(steps: StepEntry[]): string {
  const lines: string[] = []
  for (const step of steps) {
    const filledLabels: string[] = []
    // Potenzial
    for (const [slot, sv] of Object.entries(step.potenzial) as [string, SlotValue | null][]) {
      if (sv !== null && sv.value !== null && sv.value !== undefined) filledLabels.push(slot)
    }
    // Tazite
    for (const [slot, sv] of Object.entries(step.slots) as [string, TaziteSlot | TaziteSlotArray | null][]) {
      if (sv != null && (sv.value != null || sv.nicht_befund_typ != null)) filledLabels.push(slot)
    }
    if (filledLabels.length > 0) {
      lines.push(`- "${sanitizeForPrompt(step.title)}": ${filledLabels.map(s => `${s} ✓`).join(', ')}`)
    }
  }
  return lines.join('\n')
}

/**
 * Pt7: Extract standalone numeric tokens from a string.
 * Used to detect analyst-extracted numbers in briefing.suggested_question
 * so the Talker can be warned not to re-quote them (anchoring prevention).
 */
export function extractNumericTokens(text: string): string[] {
  const matches = text.match(/\b\d+(?:[.,]\d+)?\b/g) ?? []
  return [...new Set(matches)]
}

/**
 * Pt7: Detect whether a Talker response re-quotes numeric values from the briefing.
 * Returns matched numbers if anchoring is found, empty array otherwise.
 * Used in onFinish for observability logging.
 */
export function detectNumberAnchoring(talkerText: string, suggestedQuestion: string): string[] {
  const numbers = extractNumericTokens(suggestedQuestion)
  if (numbers.length === 0) return []
  // Only flag if the number appears inside a question (ends with ?)
  const sentences = talkerText.split(/[.!]\s+/)
  const questionSentences = sentences.filter(s => s.includes('?'))
  return numbers.filter(n => questionSentences.some(q => {
    const re = new RegExp(`\\b${n.replace('.', '\\.')}\\b`)
    return re.test(q)
  }))
}

/**
 * Pt13: Detect formulaic acknowledgment phrases in Talker output.
 * Extracts the opening clause of each sentence that matches known filler patterns.
 * Stored in interview_state and injected back as an avoidance list each turn.
 */
const FILLER_PATTERNS = [
  /^Das ist (ein|eine|einer|eines|kein|keine|sehr|ein sehr)\b/i,
  /^Das klingt\b/i,
  /^Das klingt nach\b/i,
  /^Das ist ein wichtiger\b/i,
  /^Das ist interessant\b/i,
  /^Das macht\b/i,
  /^Das sind\b/i,
  /^Das war\b/i,
  /^Vielen Dank\b/i,
  /^Danke\b/i,
  /^Ich danke\b/i,
  /^Gut[,.]?\s/i,
  /^Gut zu wissen\b/i,
  /^Schön[,.]?\s/i,
  /^Sehr gut\b/i,
  /^Interessant\b/i,
  /^Verstanden[,.]?\s/i,
  /^Verstehe\b/i,
  /^Alles klar\b/i,
  /^Das ist ein klassischer\b/i,
  /^Das ist ein klarer\b/i,
]

// F1c: question-template fillers — repetitive estimation prompts that tank
// naturalness when used >2× in a run. Scanned across the FULL text (not just
// opener) and tracked alongside opener fillers so the avoidance list catches
// both kinds.
const QUESTION_TEMPLATE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /welcher wert wäre (eine|deine)? ?grobe schätzung/i, label: 'Welcher Wert wäre eine grobe Schätzung' },
  { pattern: /kannst du.*grobe schätzung/i, label: 'Kannst du eine grobe Schätzung geben' },
  { pattern: /wie viel(e)? .*im durchschnitt/i, label: 'Wie viel im Durchschnitt' },
  { pattern: /wie viel(e)? .*pro (rechnung|vorgang|beleg|fall)/i, label: 'Wie viel pro Vorgang' },
  // F1d: acceptance-phrase templates — track so the avoidance list rotates them.
  { pattern: /notiere ich als variabel/i, label: 'Notiere ich als variabel' },
  { pattern: /notiere ich mit \d/i, label: 'Notiere ich mit Zahl' },
  { pattern: /halten wir das offen/i, label: 'halten wir das offen' },
  { pattern: /halten wir .* fest/i, label: 'halten wir das fest' },
  { pattern: /das nehme ich so auf/i, label: 'Das nehme ich so auf' },
  { pattern: /das halten wir so fest/i, label: 'Das halten wir so fest' },
  { pattern: /gehen wir weiter zu/i, label: 'gehen wir weiter zu' },
  { pattern: /nächster punkt/i, label: 'Nächster Punkt' },
]

export function detectFillerPhrases(text: string): string[] {
  const matched: string[] = []
  // Opener fillers — first sentence only
  const firstSentence = text.split(/[.!?]\s+/)[0]?.trim() ?? ''
  for (const pattern of FILLER_PATTERNS) {
    if (pattern.test(firstSentence)) {
      matched.push(firstSentence.slice(0, 50))
      break
    }
  }
  // F1c: Question-template fillers — full-text scan
  for (const { pattern, label } of QUESTION_TEMPLATE_PATTERNS) {
    if (pattern.test(text)) {
      matched.push(label)
    }
  }
  return matched
}

export function buildDynamicContext(ctx: InterviewContext, briefing?: AnalystBriefing | null): string {
  const focusLine = ctx.focusTopics
    ? `Fokusthemen (NUR interne Steuerung — im Opener niemals namentlich nennen): ${ctx.focusTopics}`
    : 'Keine spezifischen Fokusthemen — führe eine offene Prozessexploration durch.'

  const warnAt = ctx.maxDurationMinutes - 5
  const hardAt = ctx.maxDurationMinutes

  const timingWarning =
    ctx.timerMinutes >= hardAt
      ? `\n⚠️ KRITISCH: ${hardAt} Minuten erreicht. Leite die Verabschiedung ein.`
      : ctx.timerMinutes >= warnAt
      ? `\n⚠️ HINWEIS: ${warnAt} Minuten erreicht. Leite aktiv in die wrap_up-Phase über.`
      : ''

  const shortModeHint =
    ctx.maxDurationMinutes <= 10
      ? '\n- Kurzmodus aktiv: Halte Übergänge zwischen Phasen kurz und komm zügig zum Abschluss.'
      : ''

  const coverageCheckSection = (ctx.phase === 'coverage_check' || ctx.phase === 'slot_completion') && ctx.missingSlotsForCoverageCheck && ctx.missingSlotsForCoverageCheck.length > 0
    ? `\n## Fehlende Pflicht-Slots (${ctx.phase})\n${ctx.missingSlotsForCoverageCheck.map(m => `- Schritt "${m.step_title}" → ${m.slot}`).join('\n')}\nFrage diese Werte gezielt und natürlich nach, bevor du zur nächsten Phase übergehst.`
    : ctx.phase === 'coverage_check'
    ? '\n## Coverage vollständig\nAlle Pflicht-Slots gefüllt. Wechsle direkt zu wrap_up.'
    : ctx.phase === 'slot_completion' && ctx.missingSlotsForCoverageCheck !== undefined
    ? '\n## Slot-Completion vollständig\nAlle bisher registrierten Schritte haben vollständige Pflicht-Slots. Zur nächsten Phase übergehen.'
    : ''

  // D1 — READ_ONLY_STATE: In walkthrough_step only show filled slots to avoid
  // Observable-Goal pull on empty fields. In all other phases show the full tracker.
  let stepTrackerSection: string
  if (ctx.phase === 'walkthrough_step') {
    const filledLines = ctx.stepTracker.flatMap((step) => {
      // Fix 4 (ADR-015): mask raw slot values — only show that the slot is filled.
      const filledPotenzial = (Object.entries(step.potenzial) as [string, SlotValue | null][])
        .filter(([, sv]) => sv !== null && sv.value !== null)
        .map(([name]) => `  ${name}: ✓ erfasst`)
      const filledTazite = (Object.entries(step.slots) as [string, TaziteSlot | TaziteSlotArray | null][])
        .filter(([, sv]) => sv != null && (sv.value != null || sv.nicht_befund_typ != null))
        .map(([name]) => `  ${name}: ✓ erfasst`)
      const filledSlots = [...filledPotenzial, ...filledTazite]
      if (filledSlots.length === 0 && !step.process_steps?.length && !step.friction_points?.length) return []
      const govNote = step.governance?.rolle ? ` (${sanitizeForPrompt(step.governance.rolle)})` : ''
      const header = `[${step.status}] "${sanitizeForPrompt(step.title)}"${govNote}`
      const walkLines: string[] = []
      if (step.process_steps?.length) walkLines.push(`  process_steps: ${step.process_steps.join(' → ')}`)
      if (step.friction_points?.length) walkLines.push(`  friction_points: ${step.friction_points.join(', ')}`)
      if (step.friction_tools?.length) walkLines.push(`  friction_tools: ${step.friction_tools.join(', ')}`)
      return [header, ...filledSlots, ...walkLines]
    })

    stepTrackerSection = filledLines.length > 0
      ? `\n<READ_ONLY_STATE>\nProtokoll bisher erfasster Daten — zur Orientierung, nicht zur Optimierung.\nDiese Felder beschreiben was bereits gesagt wurde. Leere Felder sind kein Gesprächsziel. Nicht auf Basis leerer Felder fragen.\n${filledLines.join('\n')}\n</READ_ONLY_STATE>`
      : ''

    // L1 — Slot-Target: Ein einzelner Pflicht-Slot wird gezielt erfragt.
    // Verhindert depth-first starvation (Talker fragt nach "wie genau" statt "wie lange").
    // Nur ein Slot pro Turn — minimiert observable-goal-pull auf andere Felder.
    const target = computeWalkthroughSlotTarget(ctx.stepTracker)
    if (target) {
      const hint = SLOT_PROMPT_HINT[target.slot]
      const isLowConf = target.reason === 'low_confidence'
      const targetLabel = isLowConf
        ? `Unsicher belegt (estimate/unknown): ${target.slot} — ${hint}. Kurze Bestätigung einholen, kein vollständiger Neu-Anlauf.`
        : `Noch fehlend: ${target.slot} — ${hint}.`
      stepTrackerSection += `\n\n## Slot-Target (PFLICHT — diesen Turn adressieren)\nAktiver Schritt: "${sanitizeForPrompt(target.step_title)}"\n${targetLabel}\nStelle in diesem Turn eine offene Frage die genau diesen Slot erfasst. Keine Zahlen-Vorgabe, kein Anker.`
    }
  } else {
    stepTrackerSection = `\n## Schritt-Tracker (aktueller Slot-Filling-Stand)\n${formatStepTracker(ctx.stepTracker)}`
  }

  // Few-shot examples only in walkthrough_step
  const fewShotSection = ctx.phase === 'walkthrough_step' ? WALKTHROUGH_EXAMPLES : ''

  // Phase methodology injected per-turn (not in static prompt)
  const hasExploringSteps = ctx.stepTracker.some(s => s.status === 'exploring')
  const methodologySection = `\n<methodology>\n${buildPhaseMethodology(ctx.phase, hasExploringSteps)}\n</methodology>`

  // E3.6 — Profile-adaptive framing: inject only when role is known
  const profileFraming = ctx.employeeRole
    ? `\n- Profil-Framing: Sprachtiefe und Fachbegriffe an "${ctx.employeeRole}" (${ctx.department}) anpassen. Fachfremde Rollen → alltagsnahe Sprache; Fach-/IT-Rollen → Domänen-Terminologie spiegeln.`
    : ''

  // Kompakter Lookup für bereits erfasste Slots — in allen Phasen außer walkthrough_step
  // (dort gibt es bereits den READ_ONLY_STATE Block).
  let alreadyKnownSection = ''
  if (ctx.phase !== 'walkthrough_step') {
    const snapshot = formatFilledSlotsSnapshot(ctx.stepTracker)
    if (snapshot.length > 0) {
      alreadyKnownSection = `\n## Bereits erfasste Werte (NICHT erneut fragen)\n${snapshot}`
    }
  }

  // Analyst briefing section — advisory, not binding.
  // Talker may adapt the suggested question if it was already answered in the current turn.
  // Pt7: When suggested_question contains numeric values, inject an explicit no-anchor reminder
  // to prevent the Talker from re-quoting analyst-extracted numbers back to the user.
  const suggestedQ = briefing?.suggested_question ?? ''
  const anchoringNumbers = extractNumericTokens(suggestedQ)
  const anchorWarning = anchoringNumbers.length > 0
    ? `\n⚠️ ANKER-SPERRE: Diese Zahlen stammen aus der Analyst-Extraktion — NICHT in einer Frage nennen: ${anchoringNumbers.join(', ')}. Frage offen: "Wie oft?" / "Wie lange?" ohne Vorgabe.`
    : ''
  const briefingSection = briefing && (briefing.next_focus || briefing.suggested_question)
    ? `\n\n## NÄCHSTER TURN — Analyst-Empfehlung\nFokus: ${sanitizeForPrompt(briefing.next_focus ?? '—')}\nEmpfohlene Frage (anpassen wenn bereits beantwortet): "${sanitizeForPrompt(suggestedQ)}"${anchorWarning}`
    : ''

  // Filler avoidance: inject list of already-used opening phrases (Pt13)
  const recentFillers = ctx.usedFillerPhrases?.slice(-8) ?? []
  const fillerAvoidance = recentFillers.length > 0
    ? `\nVARIANZ-GEBOT: Diese Einstiegsphrasen wurden bereits genutzt — NICHT wiederholen: ${recentFillers.map(p => `"${p}"`).join(' | ')}`
    : ''

  // F1: Drill-Stop — break retry storms on unanswerable quant slots.
  // F1b: refuse-detect on last user turn lowers threshold to 1.
  const drillWarnings = detectDrillStops(ctx.recentAssistantTurns, ctx.stepTracker, ctx.lastUserTurn)
  const drillStopSection = drillWarnings.length > 0
    ? `\n\n## ⛔ DRILL-STOP (PFLICHT)\n${drillWarnings.map(w => `- ${w}`).join('\n')}`
    : ''

  // E3.1 — Ambiguity: conflicting factual statements (additive to drill-stop/missing-slot)
  // Pass prior user turns (exclude current) for negation-contradiction detection (B2 fix)
  const priorUserTurns = ctx.recentUserTurns?.slice(0, -1)
  const ambiguityResult = detectAmbiguity(ctx.lastUserTurn, ctx.stepTracker, priorUserTurns)
  const ambiguitySection = ambiguityResult
    ? `\n\n## ⚠️ AMBIGUITÄT-KLÄRUNG (PFLICHT — dieser Turn)\nWidersprüchliche Aussagen erkannt:\n- Früher: "${ambiguityResult.phraseA}"\n- Jetzt: "${ambiguityResult.phraseB}"\nSpreche beide Aussagen explizit an: "Du hast vorhin [A] erwähnt — jetzt sagst du [B]. Was ist der Unterschied?" Keine Lücken-Nachfrage in diesem Turn — Ambiguität hat Vorrang.`
    : ''

  // E3.2 — Exception: special-case mention → deepen before moving on
  const exceptionDetected = detectException(ctx.lastUserTurn)
  const exceptionSection = exceptionDetected
    ? `\n\n## ⚠️ AUSNAHME ERKANNT\nDer Mitarbeiter hat einen Sonderfall oder eine Ausnahme erwähnt. Vertiefe diesen mit einer gezielten Nachfrage bevor du weitergehst. Ausnahmen die eigenständige Schritte sind → register_step nach 1–2 Vertiefungsfragen.`
    : ''

  // E3.2 re-context cap: suppress re-contextualization when already used in last 3 turns
  const recentlyRecontextualized = wasRecentlyRecontextualized(ctx.recentAssistantTurns)
  const recontextCapSection = recentlyRecontextualized
    ? `\n\n## Re-Kontext-Sperre (E3.2)\nRe-Kontextualisierung wurde in den letzten Turns bereits eingesetzt — diesen Turn NICHT erneut re-kontextualisieren. Stelle stattdessen eine direkte thematische Nachfrage.`
    : ''

  // E3.4 — Laddering: blockade detection + two-turn drop rule
  const ladderiungStreak = computeLadderingStreak(ctx.recentUserTurns)
  const currentBlockade = detectBlockade(ctx.lastUserTurn)
  const ladderiungSection = ladderiungStreak >= 2
    ? `\n\n## ⛔ LADDERING-ABBRUCH (PFLICHT)\nNach ${ladderiungStreak} aufeinanderfolgenden Blockade-Turns: Thema jetzt fallen lassen. Gehe direkt zum nächsten Aspekt oder Schritt über — keine weitere Nachfrage zu diesem Thema.`
    : currentBlockade
    ? `\n\n## ⚠️ LADDERING — Frametechnik wechseln\nBlockade-Signal erkannt. Stelle KEINE strukturell identische Folgefrage. Wechsle Frametechnik:\n- Perspektivwechsel: "Wie würde ein Kollege das beschreiben?"\n- Beispiel-Einladung: "Kannst du ein konkretes Beispiel aus der letzten Woche nennen?"\n- Vereinfachende Reformulierung der Frage`
    : ''

  return `## Interview-Kontext
- Mitarbeiter: ${ctx.employeeName}${ctx.employeeRole ? `, ${ctx.employeeRole}` : ''}
- Abteilung: ${ctx.department}
- ${focusLine}
- Phase: ${ctx.phase}
- Verstrichene Zeit: ${ctx.timerMinutes} / ${ctx.maxDurationMinutes} Minuten${timingWarning}${shortModeHint}${profileFraming}

## Extrahierte Wissensobjekte
${formatExtractionsLog(ctx.extractionsLog)}${coverageCheckSection}${methodologySection}${stepTrackerSection}${alreadyKnownSection}${fewShotSection}${briefingSection}${fillerAvoidance}${drillStopSection}${ambiguitySection}${exceptionSection}${recontextCapSection}${ladderiungSection}`
}

// ─── Tools ────────────────────────────────────────────────────────────────────
// Iteration 2: phase-management tools (transition_phase, complete_interview, enter_coverage_check)
// removed — Orchestrator (interviewOrchestrator.ts) handles all phase transitions deterministically.

export function buildTools(
  interviewId: string,
  workspaceId: string,
  currentUserInput?: string,
  opts?: {
    source?: 'quick' | 'analyst' | 'analyst_online' | 'analyst_catchup'
    /** When set, only tools whose names are in this list are included in the returned object. */
    allowedTools?: string[]
    /** User turn texts indexed 0-based. When provided, evidence_quote is validated against source_turn. */
    userTurns?: string[]
  },
) {
  const writeSource = opts?.source ?? 'analyst'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdmin() as any

  const allTools = {
    update_topics: tool({
      description: 'Aktualisiert die Liste der abgedeckten und offenen Themen nach einem Turn.',
      inputSchema: z.object({
        covered: z.array(z.string()),
        open: z.array(z.string()),
      }),
      execute: async ({ covered, open }) => {
        try {
          await supabase
            .from('interview_state')
            .update({
              topics_covered: covered,
              topics_open: open,
              updated_at: new Date().toISOString(),
            })
            .eq('interview_id', interviewId)
          return { success: true }
        } catch (err) {
          console.error('[update_topics] failed:', err)
          return { success: false, error: (err as Error).message }
        }
      },
    }),

    register_step: tool({
      description: 'Legt einen neuen Prozessschritt im Slot-Tracker an. Einmalig pro Schritt aufrufen sobald der Schritt klar benannt ist. Setzt reihenfolge automatisch.',
      inputSchema: z.object({
        title: z.string().min(1),
      }),
      execute: async ({ title }) => {
        try {
          const { data: stateRow } = await supabase
            .from('interview_state')
            .select('step_tracker')
            .eq('interview_id', interviewId)
            .maybeSingle()

          let current: StepEntry[] = ((stateRow?.step_tracker as unknown[]) ?? [])
            .map((raw, i) => normalizeStepEntry(raw, i + 1))

          // ── Layer 1: exact / substring match (free, always runs) ──────────
          const normalizedTitle = title.trim().toLowerCase()
          const normalizedForDedup = normalizeStepTitleForDedup(title)
          const exactDuplicate = current.find((s) => {
            const existing = s.title.trim().toLowerCase()
            if (existing === normalizedTitle || existing.includes(normalizedTitle) || normalizedTitle.includes(existing)) {
              return true
            }
            const existingForDedup = normalizeStepTitleForDedup(s.title)
            if (existingForDedup.length >= 4 && normalizedForDedup.length >= 4) {
              if (existingForDedup === normalizedForDedup ||
                existingForDedup.includes(normalizedForDedup) ||
                normalizedForDedup.includes(existingForDedup)) {
                return true
              }
            }
            return false
          })
          if (exactDuplicate) {
            return {
              success: true,
              deduplicated: true,
              matched_title: exactDuplicate.title,
              message: `Schritt bereits vorhanden als "${exactDuplicate.title}" — nutze diesen Titel für record_slot`,
              step_tracker: current,
              existing_step_titles: current.map((s) => s.title),
            }
          }

          // ── Layer 1b: colon-parent guard (F1) ─────────────────────────────
          // Sub-step "X: Y" handling has two cases:
          // Case A — parent not registered: tell LLM to register parent first
          // Case B — parent already registered: redirect directly, skip this call
          const parent = colonParent(title)
          if (parent && parent !== title) {
            const parentMatch = current.find((s) => {
              const ex = s.title.trim().toLowerCase()
              const p = parent.toLowerCase()
              return ex === p || ex.includes(p) || p.includes(ex)
            })
            if (!parentMatch) {
              // Case A: parent missing → register parent first
              return {
                success: false,
                soft_warning: true,
                colon_parent_missing: true,
                suggested_parent: parent,
                message: `Registriere zuerst den übergeordneten Prozess "${parent}" mit register_step. Danach nutze "${parent}" direkt als step_title für record_slot — rufe register_step für "${title}" NICHT nochmals auf.`,
                existing_step_titles: current.map((s) => s.title),
              }
            } else {
              // Case B: parent exists → redirect directly, no new step needed
              return {
                success: true,
                deduplicated: true,
                matched_title: parentMatch.title,
                message: `Teilschritt-Registrierung übersprungen. Nutze direkt "${parentMatch.title}" als step_title für record_slot. KEIN weiterer register_step-Aufruf nötig.`,
                step_tracker: current,
                existing_step_titles: current.map((s) => s.title),
              }
            }
          }

          // ── Layer 2: embedding-based cosine similarity (Jina v3) ──────────
          // Falls back to Layer 3 (Jaccard) when JINA_API_KEY is unset.
          const titleEmbedding = await generateEmbedding(title)
          if (titleEmbedding) {
            // Lazily populate embeddings for existing steps that lack one.
            // Save back to DB only when at least one was generated.
            const hydrated = await generateMissingEmbeddings(current)
            const anyNew = hydrated.some((s, i) => s.embedding && !current[i].embedding)
            if (anyNew) {
              current = hydrated
              await supabase
                .from('interview_state')
                .update({ step_tracker: current, updated_at: new Date().toISOString() })
                .eq('interview_id', interviewId)
            }

            const match = classifyStepSimilarity(titleEmbedding, current)
            if (match?.zone === 'hard') {
              return {
                success: true,
                deduplicated: true,
                matched_title: match.step.title,
                similarity_score: Math.round(match.score * 100) / 100,
                message: `Schritt semantisch identisch mit "${match.step.title}" (score=${match.score.toFixed(2)}) — nutze diesen Titel für record_slot`,
                step_tracker: current,
                existing_step_titles: current.map((s) => s.title),
              }
            }
            if (match?.zone === 'soft') {
              return {
                success: false,
                soft_warning: true,
                similar_titles: [match.step.title],
                similarity_score: Math.round(match.score * 100) / 100,
                message: `Semantisch ähnlicher Schritt: "${match.step.title}" (score=${match.score.toFixed(2)}, threshold=${HARD_THRESHOLD}). Nutze record_slot mit diesem Titel wenn es derselbe Prozess ist. Nur fortfahren wenn dieser Schritt einen anderen Hauptprozess beschreibt.`,
                existing_step_titles: current.map((s) => s.title),
              }
            }
          } else {
            // ── Layer 3: Token Jaccard fallback (no JINA_API_KEY) ────────────
            const jaccardDuplicate = current.find((s) => tokenJaccardNorm(s.title, title) >= 0.4)
            if (jaccardDuplicate) {
              return {
                success: true,
                deduplicated: true,
                matched_title: jaccardDuplicate.title,
                message: `Schritt bereits vorhanden als "${jaccardDuplicate.title}" — nutze diesen Titel für record_slot`,
                step_tracker: current,
                existing_step_titles: current.map((s) => s.title),
              }
            }
            const softSimilar = current
              .map(s => ({ title: s.title, score: tokenJaccardNorm(s.title, title) }))
              .filter(({ score }) => score >= 0.2 && score < 0.4)
              .map(({ title: t }) => t)
            if (softSimilar.length > 0) {
              return {
                success: false,
                soft_warning: true,
                similar_titles: softSimilar,
                message: `Ähnliche Schritte gefunden: ${softSimilar.map(t => `"${t}"`).join(', ')}. Nutze record_slot mit einem dieser Titel wenn es derselbe Prozess ist. Nur fortfahren wenn dieser Schritt einen anderen Hauptprozess beschreibt.`,
                existing_step_titles: current.map((s) => s.title),
              }
            }
          }

          // Collision guard: skip IDs already present (BL-E1.4 edge case)
          let stepNum = current.length + 1
          let candidateId = `S${String(stepNum).padStart(3, '0')}`
          while (current.some(s => s.id === candidateId)) {
            stepNum++
            candidateId = `S${String(stepNum).padStart(3, '0')}`
          }
          const newEntry: StepEntry = {
            id: candidateId,
            title: title.trim(),
            reihenfolge: stepNum,
            governance: null,
            abhaengigkeiten: null,
            potenzial: {
              frequency_per_month: null,
              duration_minutes: null,
              error_rate_percent: null,
              media_breaks: null,
            },
            status: 'exploring',
            slots: {
              entscheidungslogik: null,
              tazite_cues: null,
              ausnahmen: null,
              inputs: null,
              outputs: null,
              hilfsmittel: null,
            },
            process_steps: [],
            friction_points: [],
            friction_tools: [],
            pain_point_primary: null,
            ...(titleEmbedding ? { embedding: titleEmbedding } : {}),
          }

          const updated = [...current, newEntry]
          await supabase
            .from('interview_state')
            .update({ step_tracker: updated, updated_at: new Date().toISOString() })
            .eq('interview_id', interviewId)

          return {
            success: true,
            step_tracker: updated,
            existing_step_titles: updated.map((s) => s.title),
            reminder: 'Prüfe: Enthält existing_step_titles einen semantisch gleichwertigen Eintrag? Falls ja: nutze record_slot mit dem bestehenden Titel.',
          }
        } catch (err) {
          console.error('[register_step] failed:', err)
          return { success: false, error: (err as Error).message }
        }
      },
    }),

    record_slot: tool({
      description: 'Füllt einen Slot im Schritt-Tracker. Schreibbare Slots: potenzial (frequency_per_month, duration_minutes, error_rate_percent, media_breaks) und tazite O2–O5 (entscheidungslogik, tazite_cues, ausnahmen, inputs, outputs, hilfsmittel). EVIDENZ-MODELL (ADR-015, Fix 3): Übergib evidence_span — einen kurzen WÖRTLICHEN Ausschnitt (5–60 Zeichen) aus dem aktuellen Mitarbeiter-Turn. Das System erweitert ihn deterministisch zum vollständigen Satz. Fallback: evidence_quote + source_turn. ⚠️ NIEMALS einen Wert eintragen, den der Mitarbeiter nicht selbst genannt hat. is_correction=true NUR wenn der Mitarbeiter einen früher genannten Wert explizit korrigiert. Nicht-Befund (PROJ-28): Für potenzial-Slots kann statt value ein nicht_befund_typ gesetzt werden wenn der Mitarbeiter keine Angabe machen konnte.',
      inputSchema: z.object({
        step_id: z.string().regex(/^S[0-9]{3}$/).optional().describe('Stabiler Schritt-ID (z.B. S001). Bevorzugt gegenüber step_title. Aus register_step-Antwort.'),
        step_title: z.string().min(1),
        slot: z.enum([
          // Potenzial (quantitativ)
          'frequency_per_month', 'duration_minutes', 'error_rate_percent', 'media_breaks',
          // Tazite O2–O5 (qualitativ)
          'entscheidungslogik', 'tazite_cues', 'ausnahmen', 'inputs', 'outputs', 'hilfsmittel',
        ]),
        value: z.union([z.string(), z.number(), z.array(z.string())]).optional().describe('String für tazite Einzel-Slots (entscheidungslogik), String-Array für Mehrwert-Slots (tazite_cues/ausnahmen/inputs/outputs/hilfsmittel), Zahl für potenzial-Slots. Optional wenn nicht_befund_typ gesetzt.'),
        nicht_befund_typ: z.enum(['nicht_zutreffend', 'unbekannt', 'verweigert']).optional().describe('Nur für potenzial-Slots: Setze wenn Mitarbeiter keine belegbare Angabe machen konnte. unbekannt=weiß nicht, verweigert=Auskunft abgelehnt, nicht_zutreffend=nicht anwendbar. Nicht setzen wenn value vorhanden.'),
        evidence_span: z.string().min(2).max(80).optional().describe('Wörtlicher Ausschnitt aus dem aktuellen Mitarbeiter-Turn. System extrahiert den umgebenden Satz als Beleg.'),
        evidence_quote: z.string().min(3).optional().describe('Fallback wenn evidence_span nicht im aktuellen Turn vorkommt (Catch-up). Pflicht: source_turn setzen.'),
        confidence: z.enum(['confirmed', 'estimate', 'unknown']).optional(),
        qualifier: z.string().nullable().optional(),
        source_turn: z.number().int().positive().optional(),
        is_correction: z.boolean().optional().describe('Setze auf true wenn der Mitarbeiter einen früher genannten Wert explizit widerspricht oder korrigiert. Hebt Prioritäts-Konflikt-Sperre auf.'),
      }),
      execute: async ({ step_id, step_title, slot, value, nicht_befund_typ, evidence_span, evidence_quote, confidence, qualifier, source_turn, is_correction }) => {
        // Fix 3 (ADR-015): prefer deterministic span-based extraction.
        const userInputText = currentUserInput?.trim() ?? ''
        let resolvedQuote: string | null = null

        if (evidence_span && evidence_span.trim().length >= 2) {
          const span = evidence_span.trim()
          if (userInputText.length > 0 && userInputText.includes(span)) {
            resolvedQuote = extractSentenceAroundSpan(userInputText, span)
          } else {
            return {
              success: false,
              error: `evidence_span "${span}" wurde nicht wörtlich im aktuellen Mitarbeiter-Turn gefunden. Übergib einen exakten Ausschnitt aus dem aktuellen Statement oder nutze evidence_quote + source_turn für historische Belege.`,
            }
          }
        }

        if (resolvedQuote === null) {
          if (!evidence_quote || evidence_quote.trim().length < 3) {
            return {
              success: false,
              error: 'Weder gültiges evidence_span noch evidence_quote übergeben. Bevorzugt: evidence_span (kurzer wörtlicher Ausschnitt aus aktuellem Turn).',
            }
          }
          resolvedQuote = evidence_quote.trim()
        }

        // Per-slot type guards
        const isPotenzial = (POTENZIAL_SLOT_NAMES as readonly string[]).includes(slot)
        const isTaziteArray = ((['tazite_cues', 'ausnahmen', 'inputs', 'outputs', 'hilfsmittel'] as const) as readonly string[]).includes(slot)

        // F2: Parse NICHT-BEFUND string that quick-extract LLM may pass as raw value
        // e.g. value="NICHT-BEFUND:unbekannt" with no nicht_befund_typ set → convert to structured mode
        let resolvedValue = value
        let resolvedNichtBefundTyp = nicht_befund_typ
        if (typeof value === 'string' && value.startsWith('NICHT-BEFUND:')) {
          const parsed = value.split(':')[1] as 'unbekannt' | 'nicht_zutreffend' | 'verweigert' | undefined
          const validTypes = ['unbekannt', 'nicht_zutreffend', 'verweigert'] as const
          if (parsed !== undefined && (validTypes as readonly string[]).includes(parsed)) {
            resolvedValue = undefined
            resolvedNichtBefundTyp = parsed as 'unbekannt' | 'nicht_zutreffend' | 'verweigert'
          }
        }

        // PROJ-28/BL-E2.1 — Nicht-Befund mode: only for potenzial slots, no value required
        const isNichtBefundMode = resolvedNichtBefundTyp !== undefined && resolvedValue === undefined
        if (isNichtBefundMode) {
          if (!isPotenzial) {
            return { success: false, error: `nicht_befund_typ ist nur für potenzial-Slots gültig (frequency_per_month, duration_minutes, error_rate_percent, media_breaks). Für tazite-Slots: Slot leer lassen.` }
          }
          // Falls through to step lookup + write below with isNichtBefundMode=true
        } else {
          // Normal value mode — value must be present
          if (value === undefined) {
            return { success: false, error: 'Entweder value oder nicht_befund_typ muss gesetzt sein.' }
          }
          if (isPotenzial) {
            if (slot === 'media_breaks' && typeof value !== 'number') {
              return { success: false, error: `media_breaks erwartet eine ganze Zahl (Anzahl Medienbrüche pro Durchlauf, z.B. 0, 1, 2), nicht "${value}".` }
            }
            if ((slot === 'frequency_per_month' || slot === 'duration_minutes' || slot === 'error_rate_percent') && typeof value !== 'number') {
              return { success: false, error: `${slot} erwartet eine Zahl, nicht "${value}". Extrahiere den numerischen Mittelwert.` }
            }
          } else if (isTaziteArray) {
            if (!Array.isArray(value)) {
              return { success: false, error: `${slot} erwartet ein String-Array, z.B. ["SAP FI", "Excel"]. Nicht: "${value}".` }
            }
            // Reject empty arrays — spec requires value: null + nicht_befund_typ instead
            if ((value as string[]).length === 0) {
              return { success: false, error: `Leeres Array für "${slot}" ist ungültig. Wenn nichts bekannt: lass den Slot leer und setze nicht_befund_typ via record_governance, oder frag nochmals nach.` }
            }
          } else if (slot === 'entscheidungslogik' && typeof value !== 'string') {
            return { success: false, error: `entscheidungslogik erwartet einen String (Beschreibung der Entscheidungslogik), nicht "${value}".` }
          }
        }

        const verbatimQuote = resolvedQuote

        try {
          const { data: stateRow } = await supabase
            .from('interview_state')
            .select('step_tracker')
            .eq('interview_id', interviewId)
            .maybeSingle()

          const current: StepEntry[] = ((stateRow?.step_tracker as unknown[]) ?? [])
            .map((raw, i) => normalizeStepEntry(raw, i + 1))

          // ID-first lookup (PROJ-27/BL-E1.4): stable reference, falls back to fuzzy title match
          const stepIndex = step_id !== undefined
            ? (() => {
                const byId = findStepById(current, step_id)
                return byId !== -1 ? byId : findStepFuzzy(current, step_title)
              })()
            : findStepFuzzy(current, step_title)

          if (stepIndex === -1) {
            const available = current.map(s => `"${s.title}" (${s.id ?? 'no-id'})`).join(', ')
            return { success: false, error: `Schritt "${step_id ?? step_title}" nicht gefunden. Verfügbare Schritte: ${available || '(keine)'}. Nutze einen dieser Titel oder IDs exakt.` }
          }

          const step = current[stepIndex]

          // Read current value from correct location
          const prevSlotValue: SlotValue | TaziteSlot | TaziteSlotArray | null = isPotenzial
            ? step.potenzial[slot as PotenzialSlotName]
            : step.slots[slot as TaziteSlotName]
          const isOverwrite = prevSlotValue !== null && prevSlotValue !== undefined

          // Idempotency: skip DB write when value is identical (Pt11)
          if (isOverwrite && !is_correction) {
            const prevVal = prevSlotValue?.value
            const same = Array.isArray(value) && Array.isArray(prevVal)
              ? value.length === (prevVal as string[]).length && (value as string[]).every((v, i) => v === (prevVal as string[])[i])
              : value === prevVal
            if (same) {
              return {
                success: true,
                skipped: true,
                message: `Slot "${slot}" für "${step.title}" enthält bereits diesen Wert. STOPP — kein weiterer record_slot-Aufruf für diesen Slot nötig. Fahre mit dem nächsten fehlenden Slot fort.`,
              }
            }
          }

          // Priority conflict check (ADR-016): potenzial slots only (multiple writers compete there)
          if (isPotenzial) {
            const prevAsSlotValue = prevSlotValue as SlotValue | null
            const priorityBlocked = isOverwrite && !is_correction && !canOverwrite(prevAsSlotValue?.writeSource, writeSource as WriteSource)
            if (priorityBlocked) {
              emitSlotWrite({
                ts: new Date().toISOString(),
                interviewId,
                source: writeSource,
                stepTitle: step.title,
                slot,
                value,
                prevValue: prevAsSlotValue?.value,
                overwrite: true,
                blocked: true,
                sourceTurn: source_turn ?? null,
                evidence: verbatimQuote,
              }).catch(() => {})
              return {
                success: false,
                error: `Slot "${slot}" already owned by higher-priority source "${prevAsSlotValue?.writeSource ?? 'unknown'}". Current source "${writeSource}" may not overwrite it. Use is_correction=true only if the interviewee explicitly corrected this value.`,
              }
            }
          }

          // Build new slot value object
          let newSlotValue: SlotValue | TaziteSlot | TaziteSlotArray
          let subPath: string[]

          if (isPotenzial) {
            const newStatus = step.status === 'exploring' ? 'walkthrough' : step.status
            newSlotValue = isNichtBefundMode
              ? {
                  value: null,
                  quote: verbatimQuote,
                  writeSource: writeSource as WriteSource,
                  nicht_befund_typ: resolvedNichtBefundTyp!,
                } as SlotValue
              : {
                  value: resolvedValue!,
                  quote: verbatimQuote,
                  writeSource: writeSource as WriteSource,
                  ...(confidence !== undefined ? { confidence } : {}),
                  ...(qualifier !== undefined ? { qualifier } : {}),
                }
            subPath = ['potenzial', slot]
            // Atomic per-slot write via jsonb_set (PROJ-27/BL-E1.5 — prevents lost-update race)
            await supabase.rpc('patch_interview_step_field', {
              p_interview_id: interviewId,
              p_step_index: stepIndex,
              p_sub_path: subPath,
              p_value: newSlotValue,
            })
            if (newStatus !== step.status) {
              await supabase.rpc('patch_interview_step_field', {
                p_interview_id: interviewId,
                p_step_index: stepIndex,
                p_sub_path: ['status'],
                p_value: newStatus,
              })
            }
          } else if (isTaziteArray) {
            newSlotValue = {
              value: resolvedValue as string[],
              quote: verbatimQuote,
              nicht_befund_typ: null,
              ...(confidence !== undefined ? { confidence } : {}),
            } as TaziteSlotArray
            subPath = ['slots', slot]
            await supabase.rpc('patch_interview_step_field', {
              p_interview_id: interviewId,
              p_step_index: stepIndex,
              p_sub_path: subPath,
              p_value: newSlotValue,
            })
            if (step.status === 'exploring') {
              await supabase.rpc('patch_interview_step_field', {
                p_interview_id: interviewId,
                p_step_index: stepIndex,
                p_sub_path: ['status'],
                p_value: 'walkthrough',
              })
            }
          } else {
            // entscheidungslogik (TaziteSlot)
            newSlotValue = {
              value: resolvedValue as string,
              quote: verbatimQuote,
              nicht_befund_typ: null,
              ...(confidence !== undefined ? { confidence } : {}),
            } as TaziteSlot
            subPath = ['slots', slot]
            await supabase.rpc('patch_interview_step_field', {
              p_interview_id: interviewId,
              p_step_index: stepIndex,
              p_sub_path: subPath,
              p_value: newSlotValue,
            })
            if (step.status === 'exploring') {
              await supabase.rpc('patch_interview_step_field', {
                p_interview_id: interviewId,
                p_step_index: stepIndex,
                p_sub_path: ['status'],
                p_value: 'walkthrough',
              })
            }
          }

          // Check auto-transition to 'done' using in-memory snapshot + new value
          const mergedPotenzial = isPotenzial
            ? { ...step.potenzial, [slot]: newSlotValue }
            : step.potenzial
          const mergedSlots = !isPotenzial
            ? { ...step.slots, [slot]: newSlotValue }
            : step.slots
          const allPotenzialFilled = POTENZIAL_SLOT_NAMES.every(s => {
            const sv = mergedPotenzial[s]
            return sv != null && (sv.value != null || (sv.nicht_befund_typ ?? null) != null)
          })
          const allTaziteFilled = TAZITE_SLOT_NAMES.every(s => {
            const sv = mergedSlots[s]
            return sv != null && (sv.value != null || sv.nicht_befund_typ != null)
          })
          if (allPotenzialFilled && allTaziteFilled && step.status !== 'done') {
            await supabase.rpc('patch_interview_step_field', {
              p_interview_id: interviewId,
              p_step_index: stepIndex,
              p_sub_path: ['status'],
              p_value: 'done',
            })
          }

          // Emit slot-write trail event (ADR-015) — non-blocking, never throws
          emitSlotWrite({
            ts: new Date().toISOString(),
            interviewId,
            source: writeSource,
            stepTitle: step.title,
            slot,
            value: isNichtBefundMode ? `NICHT-BEFUND:${resolvedNichtBefundTyp}` : resolvedValue,
            prevValue: prevSlotValue?.value,
            overwrite: isOverwrite,
            sourceTurn: source_turn ?? null,
            evidence: verbatimQuote,
          }).catch(() => {})

          return {
            success: true,
            step_id: step.id,
            step_title: step.title,
            slot,
            ...(isNichtBefundMode ? { nicht_befund_typ: resolvedNichtBefundTyp } : { value: resolvedValue }),
            source_turn: source_turn ?? null,
          }
        } catch (err) {
          console.error('[record_slot] failed:', err)
          return { success: false, error: (err as Error).message }
        }
      },
    }),

    record_governance: tool({
      description: 'Erfasst Governance-Information zu einem Prozessschritt (wer führt aus, welche OE, welche Systeme). Partial-Write: nur übergebene Felder werden gesetzt, bestehende bleiben unverändert. Separat von record_slot — GovernanceSlot hat anderes Format. Rufe auf sobald eine Governance-Information im Turn vorkommt.',
      inputSchema: z.object({
        step_title: z.string().min(1),
        rolle: z.string().optional().describe('Person oder Rolle, die den Schritt ausführt'),
        organisationseinheit: z.string().optional().describe('Organisationseinheit / Abteilung'),
        systeme: z.array(z.string()).optional().describe('Systeme oder Plattformen, die für diesen Schritt zuständig sind (nicht: Tools die benutzt werden — das ist hilfsmittel)'),
        nicht_befund_typ: z.enum(['nicht_zutreffend', 'unbekannt', 'verweigert']).optional().describe('Setze wenn Governance explizit nicht klärbar ist'),
        evidence_span: z.string().min(2).max(80).optional().describe('Wörtlicher Ausschnitt aus aktuellem Turn als Beleg'),
        evidence_quote: z.string().min(3).optional(),
        source_turn: z.number().int().positive().optional(),
      }),
      execute: async ({ step_title, rolle, organisationseinheit, systeme, nicht_befund_typ, evidence_span, evidence_quote, source_turn }) => {
        // Evidence validation (same pattern as record_slot)
        const userInputText = currentUserInput?.trim() ?? ''
        let resolvedQuote: string | null = null

        if (evidence_span && evidence_span.trim().length >= 2) {
          const span = evidence_span.trim()
          if (userInputText.length > 0 && userInputText.includes(span)) {
            resolvedQuote = extractSentenceAroundSpan(userInputText, span)
          } else {
            return { success: false, error: `evidence_span "${span}" nicht im aktuellen Turn gefunden.` }
          }
        }
        if (resolvedQuote === null && evidence_quote && evidence_quote.trim().length >= 3) {
          resolvedQuote = evidence_quote.trim()
        }

        try {
          const { data: stateRow } = await supabase
            .from('interview_state')
            .select('step_tracker')
            .eq('interview_id', interviewId)
            .maybeSingle()

          const current: StepEntry[] = ((stateRow?.step_tracker as unknown[]) ?? [])
            .map((raw, i) => normalizeStepEntry(raw, i + 1))
          const stepIndex = findStepFuzzy(current, step_title)

          if (stepIndex === -1) {
            const available = current.map(s => `"${s.title}"`).join(', ')
            return { success: false, error: `Schritt "${step_title}" nicht gefunden. Verfügbar: ${available || '(keine)'}.` }
          }

          const existing = current[stepIndex].governance
          // Partial merge: only overwrite provided fields
          const merged: GovernanceSlot = {
            rolle: rolle !== undefined ? rolle : (existing?.rolle ?? null),
            organisationseinheit: organisationseinheit !== undefined ? organisationseinheit : (existing?.organisationseinheit ?? null),
            systeme: systeme !== undefined ? systeme : (existing?.systeme ?? null),
            nicht_befund_typ: nicht_befund_typ !== undefined ? nicht_befund_typ : (existing?.nicht_befund_typ ?? null),
          }

          // Atomic per-field write (PROJ-27/BL-E1.5)
          await supabase.rpc('patch_interview_step_field', {
            p_interview_id: interviewId,
            p_step_index: stepIndex,
            p_sub_path: ['governance'],
            p_value: merged,
          })

          return { success: true, step_title, governance: merged, quote: resolvedQuote, source_turn: source_turn ?? null }
        } catch (err) {
          console.error('[record_governance] failed:', err)
          return { success: false, error: (err as Error).message }
        }
      },
    }),

    record_dependency: tool({
      description: 'Erfasst eine getypte Abhängigkeitskante zwischen zwei Prozessschritten (O6/REQ-006). Kanten-Modus: source_step_id → target_step_id mit richtung + typ. Nicht-Befund-Modus: nur source_step_id + nicht_befund_typ wenn keine Abhängigkeiten bekannt. Typen depends_on: voraussetzung/ressource/ausloeser. Typen influences: beeinflusst/terminierung.',
      inputSchema: z.object({
        source_step_id: z.string().regex(/^S[0-9]{3}$/).describe('Schritt, auf dem die Kante eingetragen wird (z.B. S001)'),
        target_step_id: z.string().regex(/^S[0-9]{3}$/).optional().describe('Referenzierter Schritt — Kanten-Modus'),
        richtung: z.enum(['depends_on', 'influences']).optional().describe('depends_on: source setzt target voraus. influences: source beeinflusst target.'),
        typ: z.string().optional().describe('Kantentyp: depends_on → voraussetzung/ressource/ausloeser; influences → beeinflusst/terminierung'),
        beschreibung: z.string().nullable().optional(),
        nicht_befund_typ: z.enum(['nicht_zutreffend', 'unbekannt', 'verweigert']).optional().describe('Nicht-Befund-Modus: setze wenn Mitarbeiter explizit keine Abhängigkeiten kennt'),
      }),
      execute: async ({ source_step_id, target_step_id, richtung, typ, beschreibung, nicht_befund_typ }) => {
        const isEdgeMode = target_step_id !== undefined && richtung !== undefined && typ !== undefined
        const isNichtBefundMode = nicht_befund_typ !== undefined

        if (!isEdgeMode && !isNichtBefundMode) {
          return { success: false, error: 'Kanten-Modus (target_step_id + richtung + typ) oder Nicht-Befund-Modus (nicht_befund_typ) erforderlich.' }
        }
        if (isEdgeMode && isNichtBefundMode) {
          return { success: false, error: 'Kanten-Modus und Nicht-Befund-Modus schließen sich aus — nur eines übergeben.' }
        }

        if (isEdgeMode) {
          if (source_step_id === target_step_id) {
            return { success: false, error: 'Selbstreferenz nicht erlaubt: source_step_id und target_step_id dürfen nicht identisch sein.' }
          }
          const validDependsOnTypes = ['voraussetzung', 'ressource', 'ausloeser']
          const validInfluencesTypes = ['beeinflusst', 'terminierung']
          if (richtung === 'depends_on' && !validDependsOnTypes.includes(typ!)) {
            return { success: false, error: `Ungültiger Typ für depends_on: "${typ}". Erlaubt: ${validDependsOnTypes.join(', ')}.` }
          }
          if (richtung === 'influences' && !validInfluencesTypes.includes(typ!)) {
            return { success: false, error: `Ungültiger Typ für influences: "${typ}". Erlaubt: ${validInfluencesTypes.join(', ')}.` }
          }
        }

        try {
          const { data: stateRow } = await supabase
            .from('interview_state')
            .select('step_tracker')
            .eq('interview_id', interviewId)
            .maybeSingle()

          const current: StepEntry[] = ((stateRow?.step_tracker as unknown[]) ?? [])
            .map((raw, i) => normalizeStepEntry(raw, i + 1))

          const sourceIndex = current.findIndex(s => s.id === source_step_id)
          if (sourceIndex === -1) {
            const available = current.map(s => s.id ?? s.title).join(', ')
            return { success: false, error: `Quell-Schritt "${source_step_id}" nicht im step_tracker. Verfügbar: ${available || '(keine)'}.` }
          }

          if (isEdgeMode) {
            const targetExists = current.some(s => s.id === target_step_id)
            if (!targetExists) {
              const available = current.map(s => s.id ?? s.title).join(', ')
              return { success: false, error: `Ziel-Schritt "${target_step_id}" nicht im step_tracker. Zuerst via register_step anlegen. Verfügbar: ${available || '(keine)'}.` }
            }
          }

          const existing: Abhaengigkeiten = current[sourceIndex].abhaengigkeiten ?? {
            depends_on: [],
            influences: [],
            nicht_befund_typ: null,
          }

          let updated: Abhaengigkeiten

          if (isNichtBefundMode) {
            updated = { ...existing, nicht_befund_typ: nicht_befund_typ! }
          } else if (richtung === 'depends_on') {
            const isDuplicate = existing.depends_on.some(k => k.schritt_id === target_step_id && k.typ === typ)
            if (isDuplicate) {
              return { success: true, message: 'Kante bereits vorhanden (idempotent)', skipped: true }
            }
            const newKante: AbhaengigkeitsKante = {
              schritt_id: target_step_id!,
              typ: typ as AbhaengigkeitsKante['typ'],
              beschreibung: beschreibung ?? null,
            }
            updated = { ...existing, depends_on: [...existing.depends_on, newKante] }
          } else {
            const isDuplicate = existing.influences.some(k => k.schritt_id === target_step_id && k.typ === typ)
            if (isDuplicate) {
              return { success: true, message: 'Kante bereits vorhanden (idempotent)', skipped: true }
            }
            const newKante: EinflussKante = {
              schritt_id: target_step_id!,
              typ: typ as EinflussKante['typ'],
              beschreibung: beschreibung ?? null,
            }
            updated = { ...existing, influences: [...existing.influences, newKante] }
          }

          // TOCTOU-safe write (PROJ-27/BL-E1.5) — only touches abhaengigkeiten sub-path
          await supabase.rpc('patch_interview_step_field', {
            p_interview_id: interviewId,
            p_step_index: sourceIndex,
            p_sub_path: ['abhaengigkeiten'],
            p_value: updated,
          })

          return { success: true, source_step_id, abhaengigkeiten: updated }
        } catch (err) {
          console.error('[record_dependency] failed:', err)
          return { success: false, error: (err as Error).message }
        }
      },
    }),

    link_bottleneck: tool({
      description: 'Verknüpft einen Pain Point mit einem konkreten Prozessschritt. Legt ein knowledge_object vom Typ pain_point mit step_ref an.',
      inputSchema: z.object({
        step_title: z.string().min(1),
        description: z.string().min(5),
        severity: z.enum(['high', 'medium', 'low']),
      }),
      execute: async ({ step_title, description, severity }) => {
        try {
          await supabase
            .from('knowledge_objects')
            .insert({
              interview_id: interviewId,
              workspace_id: workspaceId,
              type: 'pain_point',
              content: {
                description,
                severity,
                step_ref: step_title,
              },
              source_quote: null,
            })

          // Append to extractions_log so subsequent system prompts reflect this pain point
          const { data: stateForLog } = await supabase
            .from('interview_state')
            .select('extractions_log')
            .eq('interview_id', interviewId)
            .maybeSingle()

          const currentLog = (stateForLog?.extractions_log as RawExtraction[] | null) ?? []
          const logEntry: RawExtraction = {
            type: 'pain_point',
            content: { description, severity, step_ref: step_title },
            source_quote: '',
          }
          await supabase
            .from('interview_state')
            .update({
              extractions_log: [...currentLog, logEntry],
              updated_at: new Date().toISOString(),
            })
            .eq('interview_id', interviewId)

          return { success: true, step_title, severity }
        } catch (err) {
          console.error('[link_bottleneck] failed:', err)
          return { success: false, error: (err as Error).message }
        }
      },
    }),

    update_walkthrough_data: tool({
      description: 'Aktualisiert die Ablauf- und Reibungsdaten eines Prozessschritts. SOFORT aufrufen wenn der Mitarbeiter Prozessschritte beschreibt — erkennbar an Signalwörtern wie "zuerst", "dann", "danach", "als nächstes", "am Ende". Felder sind additiv — bestehende Einträge werden nicht gelöscht.',
      inputSchema: z.object({
        step_title: z.string().min(1),
        process_steps: z.array(z.string()).optional(),
        friction_points: z.array(z.string()).optional(),
        friction_tools: z.array(z.string()).optional(),
        pain_point_primary: z.string().nullable().optional(),
      }),
      execute: async ({ step_title, process_steps, friction_points, friction_tools, pain_point_primary }) => {
        try {
          const { data: stateRow } = await supabase
            .from('interview_state')
            .select('step_tracker')
            .eq('interview_id', interviewId)
            .maybeSingle()

          const current: StepEntry[] = ((stateRow?.step_tracker as unknown[]) ?? [])
            .map((raw, i) => normalizeStepEntry(raw, i + 1))
          const stepIndex = findStepFuzzy(current, step_title)

          if (stepIndex === -1) {
            const available = current.map(s => `"${s.title}"`).join(', ')
            return { success: false, error: `Schritt "${step_title}" nicht gefunden. Verfügbare Schritte: ${available || '(keine)'}. Nutze einen dieser Titel exakt.` }
          }

          const existing = current[stepIndex]
          const updated = [...current]
          updated[stepIndex] = {
            ...existing,
            status: existing.status === 'exploring' ? 'walkthrough' : existing.status,
            process_steps: process_steps !== undefined ? process_steps : (existing.process_steps ?? []),
            friction_points: friction_points !== undefined ? friction_points : (existing.friction_points ?? []),
            friction_tools: friction_tools !== undefined ? friction_tools : (existing.friction_tools ?? []),
            pain_point_primary: pain_point_primary !== undefined ? pain_point_primary : existing.pain_point_primary,
          }

          await supabase
            .from('interview_state')
            .update({ step_tracker: updated, updated_at: new Date().toISOString() })
            .eq('interview_id', interviewId)

          return { success: true, step_title }
        } catch (err) {
          console.error('[update_walkthrough_data] failed:', err)
          return { success: false, error: (err as Error).message }
        }
      },
    }),
  }

  // When allowedTools is specified, filter the returned tool map to only the requested tools.
  // This lets analyst_catchup expose only record_slot + produce_briefing.
  if (opts?.allowedTools) {
    const allowed = new Set(opts.allowedTools)
    return Object.fromEntries(
      Object.entries(allTools).filter(([name]) => allowed.has(name))
    ) as typeof allTools
  }

  return allTools
}


// ─── Stream Factory ───────────────────────────────────────────────────────────
// Used by chat/start/reconnect routes (Iterations 1+2) and start/reconnect in Iteration 3.
// chat/route.ts switches to createTalkerStream in Iteration 3.

export interface AgentStreamOptions {
  context: InterviewContext
  history: TurnMessage[]
  userInput?: string
  isReconnect?: boolean
  isStart?: boolean
  briefing?: AnalystBriefing | null
  onFinish?: (text: string) => Promise<void>
  traceCtx?: TraceCtx
}

export function createInterviewStream(opts: AgentStreamOptions) {
  const modelString = process.env.INTERVIEW_MODEL ?? 'google/gemini-3.1-flash-lite'
  const model = resolveModel(modelString)

  const staticPart = buildStaticPrompt()
  // F1: feed last assistant turns into context for drill-stop detection.
  // F1b: also feed last user turn for refuse-detect.
  // E3.4: feed last user turns for laddering streak detection.
  const recentAssistantTurns = opts.history
    .filter((t) => t.role === 'assistant')
    .slice(-4)
    .map((t) => t.content)
  const lastUserTurn = [...opts.history].reverse().find((t) => t.role === 'user')?.content
  const recentUserTurns = opts.history
    .filter((t) => t.role === 'user')
    .slice(-4)
    .map((t) => t.content)
  const dynamicPart = buildDynamicContext(
    { ...opts.context, recentAssistantTurns, lastUserTurn, recentUserTurns },
    opts.briefing,
  )

  type PlainMessage = { role: 'user' | 'assistant'; content: string }
  type RichMessage = { role: 'user' | 'assistant'; content: string | Array<{ type: 'text'; text: string }> }

  const baseMessages: PlainMessage[] = opts.isReconnect
    ? [
        ...opts.history.map((t) => ({ role: t.role, content: t.content })),
        { role: 'user' as const, content: 'Ich bin wieder da, können wir weitermachen?' },
      ]
    : opts.isStart
    ? [{ role: 'user' as const, content: 'Bitte starte das Interview.' }]
    : opts.history.map((t) => ({ role: t.role, content: t.content }))

  // Static prompt in system (cacheable), dynamic context prepended to last user turn.
  let systemPrompt: string
  let messages: RichMessage[]

  if (baseMessages.length > 0) {
    systemPrompt = staticPart
    messages = baseMessages.map((msg, idx) => {
      if (idx === baseMessages.length - 1 && msg.role === 'user') {
        return {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: dynamicPart + '\n\n---\n\n' },
            { type: 'text' as const, text: msg.content },
          ],
        }
      }
      return msg
    })
  } else {
    systemPrompt = `${staticPart}\n\n${dynamicPart}`
    messages = baseMessages
  }

  return streamText({
    model,
    temperature: 0.5,
    system: systemPrompt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: messages as any,
    tools: buildTools(opts.context.interviewId, opts.context.workspaceId, opts.userInput),
    experimental_telemetry: buildTraceMetadata('interview.talker', {
      interviewId: opts.context.interviewId,
      model: modelString,
      environment: 'prod',
      component: 'talker',
      ...opts.traceCtx,
    }),
    // Stop as soon as any step has produced visible text.
    // Allow up to 8 tool-only steps before forcing a stop (Flash 3.5 uses up to 4 per turn
    // for register_step + record_slot calls; budget doubled to prevent empty responses).
    stopWhen: ({ steps }) => {
      if (steps.length === 0) return false
      const hasText = steps.some((s) => s.text.trim().length > 0)
      return hasText || steps.length >= 8
    },
    onFinish: opts.onFinish
      ? async ({ text, usage, providerMetadata }) => {
          const meta = providerMetadata as Record<string, unknown> | undefined
          const anthropicMeta = meta?.anthropic as Record<string, unknown> | undefined
          const details = usage.inputTokenDetails as Record<string, unknown> | undefined
          const usageData = {
            model: modelString,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            cacheReadTokens: (details?.cacheReadTokens as number | undefined) ?? null,
            cacheCreationTokens: (details?.cacheWriteTokens as number | undefined) ?? (anthropicMeta?.cacheCreationInputTokens as number | undefined) ?? null,
            googleCachedTokens: (details?.cacheReadTokens as number | undefined) ?? null,
          }
          console.log('[token-usage] turn', usageData)
          if (process.env.NODE_ENV === 'development') {
            try {
              const fs = await import('fs')
              fs.writeFileSync('.eval-last-usage.json', JSON.stringify(usageData))
            } catch { /* non-blocking */ }
          }
          await opts.onFinish!(text)
        }
      : undefined,
  })
}

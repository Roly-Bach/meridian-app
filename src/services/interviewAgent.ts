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
  colonParent,
  normalizeToken,
  tokenJaccard,
  tokenJaccardNorm,
  groupSemanticSteps,
  type Phase,
  type SlotValue,
  type StepEntry,
  type SlotName,
} from './interviewSemantic'

// Re-export semantic primitives so existing consumers continue to import from
// interviewAgent. The actual definitions live in interviewSemantic.ts so they
// can be imported off-Next.js (eval replay, scripts) without the supabase-admin
// `server-only` chain.
export {
  MANDATORY_SLOTS,
  OPTIONAL_SLOTS,
  colonParent,
  normalizeToken,
  tokenJaccard,
  tokenJaccardNorm,
  groupSemanticSteps,
}
export type { Phase, SlotValue, StepEntry, SlotName }

export interface MissingSlot {
  step_title: string
  slot: SlotName
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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function computeMissingMandatorySlots(stepTracker: StepEntry[]): MissingSlot[] {
  const missing: MissingSlot[] = []
  for (const step of stepTracker) {
    for (const slot of MANDATORY_SLOTS) {
      if (step.slots[slot] === null) {
        missing.push({ step_title: step.title, slot })
      }
    }
  }
  return missing
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
    const role = step.role ? sanitizeForPrompt(step.role) : null

    // Fix 4 (ADR-015): mask raw slot values in the Talker-facing tracker.
    // Status only — "✓ erfasst" or "fehlt". Prevents anchoring + self-calc.
    function fmtSlot(sv: SlotValue | null, label: string): string {
      if (!sv) return `  ${label}: fehlt`
      return `  ${label}: ✓ erfasst`
    }

    const slotLines = [
      fmtSlot(step.slots.frequency_per_month, 'frequency_per_month'),
      fmtSlot(step.slots.duration_minutes,    'duration_minutes   '),
      `  rule_based:          ${step.slots.rule_based != null && step.slots.rule_based.value !== undefined ? '✓ erfasst' : 'fehlt'}`,
      fmtSlot(step.slots.data_sources,        'data_sources       '),
      `  error_rate_percent:  ${step.slots.error_rate_percent ? '✓ erfasst' : 'fehlt'}`,
      `  media_breaks:        ${step.slots.media_breaks ? '✓ erfasst' : 'fehlt'}`,
    ]

    const walkthrough: string[] = []
    if (step.process_steps?.length) walkthrough.push(`  process_steps: ${step.process_steps.join(' → ')}`)
    if (step.friction_points?.length) walkthrough.push(`  friction_points: ${step.friction_points.join(', ')}`)
    if (step.friction_tools?.length) walkthrough.push(`  friction_tools: ${step.friction_tools.join(', ')}`)
    if (step.pain_point_primary) walkthrough.push(`  pain_point_primary: "${step.pain_point_primary}"`)

    return `[${step.status}] "${title}"${role ? ` (${role})` : ''}\n${slotLines.join('\n')}${walkthrough.length ? '\n' + walkthrough.join('\n') : ''}`
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
</turn_format>

<tools>
Tool-Calls laufen still im Hintergrund — erscheinen nie im Text.
evidence_quote muss ein wörtliches Zitat aus dem Mitarbeiter-Statement sein.
Slots nur setzen wenn Mitarbeiter den Wert explizit genannt hat.
update_topics nach jedem Turn mit aktualisierten Listen aufrufen.
PFLICHT: Nach Tool-Calls IMMER eine Textantwort generieren — auch nur ein Reaktionssatz + Frage. Eine leere Antwort ist kein gültiger Turn.
</tools>

`
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
Ausnahmen und Sonderfälle sind keine eigenständigen Prozesse — sie gehören als friction_point zu einem bestehenden Schritt.`
  }

  if (phase === 'walkthrough_step') {
    return `## Methodik: walkthrough_step
Ziel: Ablauf und Reibungspunkte erfassen — eine Frage pro Turn, vorwärts durch die Schritte.
Signalwörter ("zuerst", "dann", "danach", "als nächstes"): sofort update_walkthrough_data mit process_steps aufrufen.
Spontan genannte Werte (Häufigkeit, Dauer, Systeme): record_slot bzw. update_walkthrough_data aufrufen — keine direkten Slot-Fragen stellen.
Reibungspunkte und zugehörige Tools via update_walkthrough_data; Pain Points mit Ortsbezug via link_bottleneck.
Abschluss: wenn Ablauf natürlich endet oder alle Leitfragen gestellt wurden, zu slot_completion übergehen.
Turn-Budget: Nach 3 Walkthrough-Turns auf demselben Schritt zu slot_completion übergehen — Tiefe ist nicht das Ziel, Breite schon. Keine Detailfragen zu System-internen Abläufen (SAP-Transaktionscodes, Workflow-Details) — diese sind nicht slot-relevant.
Kontextregel: Beschreibt die aktuelle Mitarbeiter-Antwort mehrere Prozesse, record_slot NUR für den aktuell erkundeten Schritt aufrufen. Andere Prozesse nicht mit Slots befüllen — register_step + Erkundung im nächsten Turn.`
  }

  if (phase === 'slot_completion') {
    return `## Methodik: slot_completion
Ziel: Verbleibende Pflichtslots nachfragen (frequency_per_month, duration_minutes, rule_based, data_sources).
Optional: media_breaks fragen wenn Prozess papier- oder systemintensiv erscheint ("Druckst du etwas aus?" / "Gibt es Schritte wo du zwischen Systemen wechselst?").
Max. 2–3 fehlende Slots pro Turn — natürlicher Gesprächsfluss, kein Listenformat, keine Ankündigung.
Spannen: NICHT mehr nachfragen wenn Slot bereits mit confidence=estimate erfasst ist. Nur bei echtem null.
data_sources-Fallback wenn keine Antwort: leeres Array setzen.
rule_based: Wenn nach walkthrough noch null → einmal direkt fragen: "Folgt dieser Prozess bei dir immer dem gleichen Schema, oder entscheidest du von Fall zu Fall?" Wenn Mitarbeiter ausweicht oder unklar antwortet: NICHT nochmals fragen — Clarification Card erledigt das am Ende.`
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
- Keine neuen Inhalte → kurz verabschieden.`
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
    for (const [slot, sv] of Object.entries(step.slots) as [string, SlotValue | null][]) {
      if (sv !== null && sv.value !== undefined && sv.value !== null) {
        filledLabels.push(slot)
      }
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
      const filledSlots = (Object.entries(step.slots) as [string, SlotValue | null][])
        .filter(([, sv]) => sv !== null)
        .map(([name]) => `  ${name}: ✓ erfasst`)
      if (filledSlots.length === 0 && !step.process_steps?.length && !step.friction_points?.length) return []
      const header = `[${step.status}] "${sanitizeForPrompt(step.title)}"${step.role ? ` (${sanitizeForPrompt(step.role)})` : ''}`
      const walkLines: string[] = []
      if (step.process_steps?.length) walkLines.push(`  process_steps: ${step.process_steps.join(' → ')}`)
      if (step.friction_points?.length) walkLines.push(`  friction_points: ${step.friction_points.join(', ')}`)
      if (step.friction_tools?.length) walkLines.push(`  friction_tools: ${step.friction_tools.join(', ')}`)
      return [header, ...filledSlots, ...walkLines]
    })

    stepTrackerSection = filledLines.length > 0
      ? `\n<READ_ONLY_STATE>\nProtokoll bisher erfasster Daten — zur Orientierung, nicht zur Optimierung.\nDiese Felder beschreiben was bereits gesagt wurde. Leere Felder sind kein Gesprächsziel. Nicht auf Basis leerer Felder fragen.\n${filledLines.join('\n')}\n</READ_ONLY_STATE>`
      : ''
  } else {
    stepTrackerSection = `\n## Schritt-Tracker (aktueller Slot-Filling-Stand)\n${formatStepTracker(ctx.stepTracker)}`
  }

  // Few-shot examples only in walkthrough_step
  const fewShotSection = ctx.phase === 'walkthrough_step' ? WALKTHROUGH_EXAMPLES : ''

  // Phase methodology injected per-turn (not in static prompt)
  const hasExploringSteps = ctx.stepTracker.some(s => s.status === 'exploring')
  const methodologySection = `\n<methodology>\n${buildPhaseMethodology(ctx.phase, hasExploringSteps)}\n</methodology>`

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

  return `## Interview-Kontext
- Mitarbeiter: ${ctx.employeeName}${ctx.employeeRole ? `, ${ctx.employeeRole}` : ''}
- Abteilung: ${ctx.department}
- ${focusLine}
- Phase: ${ctx.phase}
- Verstrichene Zeit: ${ctx.timerMinutes} / ${ctx.maxDurationMinutes} Minuten${timingWarning}${shortModeHint}

## Extrahierte Wissensobjekte
${formatExtractionsLog(ctx.extractionsLog)}${coverageCheckSection}${methodologySection}${stepTrackerSection}${alreadyKnownSection}${fewShotSection}${briefingSection}`
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
      description: 'Legt einen neuen Prozessschritt im Slot-Tracker an. Einmalig pro Schritt aufrufen sobald der Schritt klar benannt ist.',
      inputSchema: z.object({
        title: z.string().min(1),
        role: z.string().optional(),
      }),
      execute: async ({ title, role }) => {
        try {
          const { data: stateRow } = await supabase
            .from('interview_state')
            .select('step_tracker')
            .eq('interview_id', interviewId)
            .maybeSingle()

          let current: StepEntry[] = (stateRow?.step_tracker as StepEntry[] | null) ?? []

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

          // ── Layer 1b: colon-parent guard ───────────────────────────────────
          // Prevents sub-step fragmentation: "Rechnungsprüfung: Archivierung"
          // when no parent "Rechnungsprüfung" exists yet. Forces the LLM to
          // register the top-level process first, preserving semantic breadth.
          const parent = colonParent(title)
          if (parent && parent !== title) {
            const parentAlreadyRegistered = current.some((s) => {
              const ex = s.title.trim().toLowerCase()
              const p = parent.toLowerCase()
              return ex === p || ex.includes(p) || p.includes(ex)
            })
            if (!parentAlreadyRegistered) {
              return {
                success: false,
                soft_warning: true,
                colon_parent_missing: true,
                suggested_parent: parent,
                message: `Registriere zuerst den übergeordneten Prozess "${parent}" mit register_step, bevor du den Teilschritt "${title}" anlegst. Der übergeordnete Prozess ist die korrekte Einheit für die Wissenserhebung.`,
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

          const newEntry: StepEntry = {
            title: title.trim(),
            role: role ?? null,
            status: 'exploring',
            ...(titleEmbedding ? { embedding: titleEmbedding } : {}),
            slots: {
              frequency_per_month: null,
              duration_minutes: null,
              rule_based: null,
              data_sources: null,
              error_rate_percent: null,
              media_breaks: null,
            },
            process_steps: [],
            friction_points: [],
            friction_tools: [],
            pain_point_primary: null,
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
      description: 'Füllt einen Slot im Schritt-Tracker. EVIDENZ-MODELL (ADR-015, Fix 3): Übergib evidence_span — einen kurzen WÖRTLICHEN Ausschnitt (5–60 Zeichen) aus dem aktuellen Mitarbeiter-Turn, z.B. "100", "5 Minuten", "SAP FI und Excel". Das System erweitert ihn deterministisch zum vollständigen Satz und speichert ihn als Beleg. Wenn evidence_span nicht im aktuellen Turn vorkommt (Catch-up aus historischem Kontext), nutze evidence_quote stattdessen + source_turn. ⚠️ NIEMALS einen Wert eintragen, den der Mitarbeiter nicht selbst genannt hat. confidence=confirmed/estimate/unknown wie gehabt. is_correction=true NUR wenn der Mitarbeiter einen früher genannten Wert explizit korrigiert (z.B. "eigentlich sind es 15, nicht 10") — hebt Prioritäts-Sperre auf.',
      inputSchema: z.object({
        step_title: z.string().min(1),
        slot: z.enum(['frequency_per_month', 'duration_minutes', 'rule_based', 'data_sources', 'error_rate_percent', 'media_breaks']),
        value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
        evidence_span: z.string().min(2).max(80).optional().describe('Wörtlicher Ausschnitt aus dem aktuellen Mitarbeiter-Turn. System extrahiert den umgebenden Satz als Beleg.'),
        evidence_quote: z.string().min(3).optional().describe('Fallback wenn evidence_span nicht im aktuellen Turn vorkommt (Catch-up). Pflicht: source_turn setzen.'),
        confidence: z.enum(['confirmed', 'estimate', 'unknown']).optional(),
        qualifier: z.string().nullable().optional(),
        source_turn: z.number().int().positive().optional(),
        is_correction: z.boolean().optional().describe('Setze auf true wenn der Mitarbeiter einen früher genannten Wert explizit widerspricht oder korrigiert. Hebt Prioritäts-Konflikt-Sperre auf.'),
      }),
      execute: async ({ step_title, slot, value, evidence_span, evidence_quote, confidence, qualifier, source_turn, is_correction }) => {
        // Fix 3 (ADR-015): prefer deterministic span-based extraction.
        const userInputText = currentUserInput?.trim() ?? ''
        let resolvedQuote: string | null = null

        if (evidence_span && evidence_span.trim().length >= 2) {
          const span = evidence_span.trim()
          if (userInputText.length > 0 && userInputText.includes(span)) {
            // Expand span to the enclosing sentence(s) deterministically.
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

        // Per-slot type guards — return error so LLM corrects the call
        if (slot === 'rule_based' && typeof value !== 'boolean') {
          return { success: false, error: `rule_based erwartet true oder false (boolean), nicht "${value}". Nutze true wenn der Schritt feste Regeln/Richtlinien hat, false wenn nicht.` }
        }
        if (slot === 'media_breaks' && typeof value !== 'number') {
          return { success: false, error: `media_breaks erwartet eine ganze Zahl (Anzahl Medienbrüche pro Durchlauf, z.B. 0, 1, 2), nicht "${value}".` }
        }
        if ((slot === 'frequency_per_month' || slot === 'duration_minutes' || slot === 'error_rate_percent') && typeof value !== 'number') {
          return { success: false, error: `${slot} erwartet eine Zahl, nicht "${value}". Extrahiere den numerischen Mittelwert.` }
        }
        if (slot === 'data_sources' && !Array.isArray(value)) {
          return { success: false, error: `data_sources erwartet ein String-Array, z.B. ["SAP", "Excel"]. Nicht: "${value}".` }
        }

        const verbatimQuote = resolvedQuote

        try {
          const { data: stateRow } = await supabase
            .from('interview_state')
            .select('step_tracker')
            .eq('interview_id', interviewId)
            .maybeSingle()

          const current: StepEntry[] = (stateRow?.step_tracker as StepEntry[] | null) ?? []
          const stepIndex = findStepFuzzy(current, step_title)

          if (stepIndex === -1) {
            const available = current.map(s => `"${s.title}"`).join(', ')
            return { success: false, error: `Schritt "${step_title}" nicht gefunden. Verfügbare Schritte: ${available || '(keine)'}. Nutze einen dieser Titel exakt.` }
          }

          const prevSlotValue = current[stepIndex].slots[slot]
          const isOverwrite = prevSlotValue !== null && prevSlotValue !== undefined

          // Idempotency: skip DB write when value is identical to existing (Pt11).
          // Prevents analyst churn (same slot written 5× with same value).
          // is_correction bypasses this check — user explicitly correcting a value.
          if (isOverwrite && !is_correction) {
            const prevVal = prevSlotValue?.value
            const same = Array.isArray(value) && Array.isArray(prevVal)
              ? value.length === prevVal.length && value.every((v, i) => v === (prevVal as string[])[i])
              : value === prevVal
            if (same) {
              return {
                success: true,
                skipped: true,
                message: `Slot "${slot}" für "${step_title}" enthält bereits diesen Wert. STOPP — kein weiterer record_slot-Aufruf für diesen Slot nötig. Fahre mit dem nächsten fehlenden Slot fort.`,
              }
            }
          }

          // Priority conflict check (ADR-016): block lower-priority writers.
          // is_correction=true bypasses the check when the user explicitly corrects a prior value.
          const priorityBlocked = isOverwrite && !is_correction && !canOverwrite(prevSlotValue?.writeSource, writeSource as WriteSource)
          if (priorityBlocked) {
            emitSlotWrite({
              ts: new Date().toISOString(),
              interviewId,
              source: writeSource,
              stepTitle: current[stepIndex].title,
              slot,
              value,
              prevValue: prevSlotValue?.value,
              overwrite: true,
              blocked: true,
              sourceTurn: source_turn ?? null,
              evidence: verbatimQuote,
            }).catch(() => {})
            return {
              success: false,
              error: `Slot "${slot}" already owned by higher-priority source "${prevSlotValue?.writeSource ?? 'unknown'}". Current source "${writeSource}" may not overwrite it. Use is_correction=true only if the interviewee explicitly corrected this value.`,
            }
          }

          const updated = [...current]
          updated[stepIndex] = {
            ...updated[stepIndex],
            status: updated[stepIndex].status === 'exploring' ? 'walkthrough' : updated[stepIndex].status,
            slots: {
              ...updated[stepIndex].slots,
              [slot]: {
                value,
                quote: verbatimQuote,
                writeSource: writeSource as WriteSource,
                ...(confidence !== undefined ? { confidence } : {}),
                ...(qualifier !== undefined ? { qualifier } : {}),
              },
            },
          }

          // Auto-transition to 'done' when all mandatory slots are filled
          const allMandatoryFilled = MANDATORY_SLOTS.every(
            (s) => updated[stepIndex].slots[s] !== null
          )
          if (allMandatoryFilled) {
            updated[stepIndex] = { ...updated[stepIndex], status: 'done' }
          }

          await supabase
            .from('interview_state')
            .update({ step_tracker: updated, updated_at: new Date().toISOString() })
            .eq('interview_id', interviewId)

          // Emit slot-write trail event (ADR-015) — non-blocking, never throws
          emitSlotWrite({
            ts: new Date().toISOString(),
            interviewId,
            source: writeSource,
            stepTitle: updated[stepIndex].title,
            slot,
            value,
            prevValue: prevSlotValue?.value,
            overwrite: isOverwrite,
            sourceTurn: source_turn ?? null,
            evidence: verbatimQuote,
          }).catch(() => {})

          return { success: true, step_title, slot, value, step_complete: allMandatoryFilled, source_turn: source_turn ?? null }
        } catch (err) {
          console.error('[record_slot] failed:', err)
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

          const current: StepEntry[] = (stateRow?.step_tracker as StepEntry[] | null) ?? []
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
  const dynamicPart = buildDynamicContext(opts.context, opts.briefing)

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

import { resolveModel } from '@/lib/llm-provider'
import { streamText, tool } from 'ai'
import { buildTraceMetadata, type TraceCtx } from './_telemetry'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { RawExtraction } from './extraction'

// ─── Types ───────────────────────────────────────────────────────────────────

export type Phase = 'intro' | 'process_loop' | 'walkthrough_step' | 'slot_completion' | 'coverage_check' | 'wrap_up' | 'clarification'

export const MANDATORY_SLOTS = ['frequency_per_month', 'duration_minutes', 'rule_based', 'data_sources'] as const
export const OPTIONAL_SLOTS = ['error_rate_percent', 'media_breaks'] as const
export type SlotName = typeof MANDATORY_SLOTS[number] | typeof OPTIONAL_SLOTS[number]

export interface SlotValue {
  value: string | number | boolean | string[]
  quote: string
  confidence?: 'confirmed' | 'estimate' | 'unknown'
  qualifier?: string | null
}

export interface StepEntry {
  title: string
  role?: string | null
  status: 'exploring' | 'walkthrough' | 'done'
  slots: {
    frequency_per_month: SlotValue | null
    duration_minutes: SlotValue | null
    rule_based: SlotValue | null
    data_sources: SlotValue | null
    error_rate_percent: SlotValue | null
    media_breaks: SlotValue | null
  }
  process_steps?: string[]
  friction_points?: string[]
  friction_tools?: string[]
  pain_point_primary?: string | null
}

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

    function fmtSlot(sv: SlotValue | null, label: string): string {
      if (!sv) return `  ${label}: fehlt`
      const conf = sv.confidence ? ` [${sv.confidence}]` : ''
      const qual = sv.qualifier ? ` ("${sv.qualifier}")` : ''
      return `  ${label}: ${sv.value} ✓${conf}${qual}`
    }

    const slotLines = [
      fmtSlot(step.slots.frequency_per_month, 'frequency_per_month'),
      fmtSlot(step.slots.duration_minutes,    'duration_minutes   '),
      `  rule_based:          ${step.slots.rule_based != null && step.slots.rule_based.value !== undefined ? `${step.slots.rule_based.value} ✓` : 'fehlt'}`,
      fmtSlot(step.slots.data_sources,        'data_sources       '),
      `  error_rate_percent:  ${step.slots.error_rate_percent ? `${step.slots.error_rate_percent.value} ✓` : 'fehlt'}`,
      `  media_breaks:        ${step.slots.media_breaks ? `${step.slots.media_breaks.value} ✓` : 'fehlt'}`,
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
    } else if (item.type === 'role') {
      const c = item.content as Record<string, unknown>
      lines.push(`- [role] "${c.title}"`)
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
</tools>

`
}

// ─── Phase Methodology Sections ───────────────────────────────────────────────
// Iteration 1 (ADR-011 D7): Max. 5 Zeilen pro Phase, taktisches Briefing.
// Injected per-turn in buildDynamicContext so static prompt stays cacheable.

function buildPhaseMethodology(phase: Phase): string {
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
Abschluss: wenn Ablauf natürlich endet oder alle Leitfragen gestellt wurden, zu slot_completion übergehen.`
  }

  if (phase === 'slot_completion') {
    return `## Methodik: slot_completion
Ziel: Verbleibende Pflichtslots nachfragen (frequency_per_month, duration_minutes, rule_based, data_sources).
Optional: media_breaks fragen wenn Prozess papier- oder systemintensiv erscheint ("Druckst du etwas aus?" / "Gibt es Schritte wo du zwischen Systemen wechselst?").
Max. 2–3 fehlende Slots pro Turn — natürlicher Gesprächsfluss, kein Listenformat, keine Ankündigung.
Spannen vor dem Erfassen konkretisieren. Konfidenz setzen: confirmed / estimate / unknown.
data_sources-Fallback wenn keine Antwort: leeres Array setzen.`
  }

  if (phase === 'coverage_check') {
    return `## Methodik: coverage_check
Ziel: Fehlende Pflichtslots aller registrierten Schritte nachfüllen.
Natürlicher Gesprächsfluss — kein Übergangskommentar, kein "lass mich kurz prüfen".
Neu genannte Prozesse direkt aufnehmen und explorieren.`
  }

  if (phase === 'clarification') {
    return `## Methodik: clarification
Sage genau einmal: "Danke! Ich habe noch ein paar kurze Abschlussfragen für dich."
Stelle keine weiteren Fragen — die Abschlussfragen erscheinen im Interface.`
  }

  // wrap_up
  return `## Methodik: wrap_up
PFLICHT — stelle genau diese Abschlussfrage, bevor du dich verabschiedest:
"Wenn du an deine letzte Arbeitswoche denkst — gibt es etwas Wiederkehrendes, das wir heute nicht erwähnt haben?"
Verabschiede dich NIEMALS ohne diese Frage gestellt und beantwortet zu haben.
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
      const filledSlots = (Object.entries(step.slots) as [string, SlotValue | null][])
        .filter(([, sv]) => sv !== null)
        .map(([name, sv]) => `  ${name}: ${sv!.value} ✓`)
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
  const methodologySection = `\n<methodology>\n${buildPhaseMethodology(ctx.phase)}\n</methodology>`

  // Analyst briefing section (Iteration 3 — injected when Analyst has produced a briefing)
  const briefingSection = briefing && (briefing.next_focus || briefing.suggested_question)
    ? `\n\n## Briefing (Analyst)\n- Fokus: ${sanitizeForPrompt(briefing.next_focus ?? '—')}\n- Vorgeschlagene Frage: ${sanitizeForPrompt(briefing.suggested_question ?? '—')}`
    : ''

  return `## Interview-Kontext
- Mitarbeiter: ${ctx.employeeName}${ctx.employeeRole ? `, ${ctx.employeeRole}` : ''}
- Abteilung: ${ctx.department}
- ${focusLine}
- Phase: ${ctx.phase}
- Verstrichene Zeit: ${ctx.timerMinutes} / ${ctx.maxDurationMinutes} Minuten${timingWarning}${shortModeHint}

## Extrahierte Wissensobjekte
${formatExtractionsLog(ctx.extractionsLog)}${coverageCheckSection}${methodologySection}${stepTrackerSection}${fewShotSection}${briefingSection}`
}

// ─── Tools ────────────────────────────────────────────────────────────────────
// Iteration 2: phase-management tools (transition_phase, complete_interview, enter_coverage_check)
// removed — Orchestrator (interviewOrchestrator.ts) handles all phase transitions deterministically.

export function buildTools(interviewId: string, workspaceId: string, currentUserInput?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdmin() as any

  return {
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

          const current: StepEntry[] = (stateRow?.step_tracker as StepEntry[] | null) ?? []

          // Deduplicate: exact case-insensitive OR substring match
          const normalizedTitle = title.trim().toLowerCase()
          const duplicate = current.find((s) => {
            const existing = s.title.trim().toLowerCase()
            return existing === normalizedTitle || existing.includes(normalizedTitle) || normalizedTitle.includes(existing)
          })
          if (duplicate) {
            return {
              success: true,
              deduplicated: true,
              matched_title: duplicate.title,
              message: `Schritt bereits vorhanden als "${duplicate.title}" — nutze diesen Titel für record_slot`,
              step_tracker: current,
              existing_step_titles: current.map((s) => s.title),
            }
          }

          const newEntry: StepEntry = {
            title: title.trim(),
            role: role ?? null,
            status: 'exploring',
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
      description: 'Füllt einen Slot im Schritt-Tracker. In `walkthrough_step`: Nur aufrufen, wenn der Mitarbeiter den Wert spontan nannte. In `slot_completion` / `coverage_check`: Aktiv nach Werten fragen und erfassen. evidence_quote MUSS wörtliches Zitat sein.',
      inputSchema: z.object({
        step_title: z.string().min(1),
        slot: z.enum(['frequency_per_month', 'duration_minutes', 'rule_based', 'data_sources', 'error_rate_percent', 'media_breaks']),
        value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
        evidence_quote: z.string().min(3, 'evidence_quote muss ein wörtliches Zitat enthalten'),
        confidence: z.enum(['confirmed', 'estimate', 'unknown']).optional(),
        qualifier: z.string().nullable().optional(),
      }),
      execute: async ({ step_title, slot, value, evidence_quote, confidence, qualifier }) => {
        if (!evidence_quote || evidence_quote.trim().length < 3) {
          return { success: false, error: 'evidence_quote fehlt oder zu kurz. Zitiere wörtlich aus der Mitarbeiter-Antwort.' }
        }
        const verbatimQuote = currentUserInput?.trim() || evidence_quote

        try {
          const { data: stateRow } = await supabase
            .from('interview_state')
            .select('step_tracker')
            .eq('interview_id', interviewId)
            .maybeSingle()

          const current: StepEntry[] = (stateRow?.step_tracker as StepEntry[] | null) ?? []
          const normalizedTitle = step_title.trim().toLowerCase()
          const stepIndex = current.findIndex((s) => s.title.trim().toLowerCase() === normalizedTitle)

          if (stepIndex === -1) {
            return { success: false, error: `Schritt "${step_title}" nicht gefunden. Zuerst register_step aufrufen.` }
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

          return { success: true, step_title, slot, value, step_complete: allMandatoryFilled }
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
          const normalizedTitle = step_title.trim().toLowerCase()
          const stepIndex = current.findIndex((s) => s.title.trim().toLowerCase() === normalizedTitle)

          if (stepIndex === -1) {
            return { success: false, error: `Schritt "${step_title}" nicht gefunden. Zuerst register_step aufrufen.` }
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
    // Allow up to 4 tool-only steps before forcing a stop.
    stopWhen: ({ steps }) => {
      if (steps.length === 0) return false
      const hasText = steps.some((s) => s.text.trim().length > 0)
      return hasText || steps.length >= 4
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

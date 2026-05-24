import { resolveModel } from '@/lib/llm-provider'
import { streamText, tool, stepCountIs } from 'ai'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { RawExtraction } from './extraction'

// ─── Types ───────────────────────────────────────────────────────────────────

export type Phase = 'intro' | 'process_loop' | 'coverage_check' | 'wrap_up'

export const MANDATORY_SLOTS = ['frequency_per_month', 'duration_minutes', 'rule_based'] as const
export const OPTIONAL_SLOTS = ['data_sources', 'error_rate_percent', 'media_breaks'] as const
export type SlotName = typeof MANDATORY_SLOTS[number] | typeof OPTIONAL_SLOTS[number]

export interface SlotValue {
  value: string | number | boolean | string[]
  quote: string
}

export interface StepEntry {
  title: string
  role?: string | null
  status: 'exploring' | 'quantifying' | 'done'
  slots: {
    frequency_per_month: SlotValue | null
    duration_minutes: SlotValue | null
    rule_based: SlotValue | null
    data_sources: SlotValue | null
    error_rate_percent: SlotValue | null
    media_breaks: SlotValue | null
  }
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
    const slotLines = [
      `  frequency_per_month: ${step.slots.frequency_per_month ? `${step.slots.frequency_per_month.value} ✓` : 'fehlt'}`,
      `  duration_minutes:    ${step.slots.duration_minutes ? `${step.slots.duration_minutes.value} ✓` : 'fehlt'}`,
      `  rule_based:          ${step.slots.rule_based != null && step.slots.rule_based.value !== undefined ? `${step.slots.rule_based.value} ✓` : 'fehlt'}`,
      `  data_sources:        ${step.slots.data_sources ? `${step.slots.data_sources.value} ✓` : 'fehlt'}`,
      `  error_rate_percent:  ${step.slots.error_rate_percent ? `${step.slots.error_rate_percent.value} ✓` : 'fehlt'}`,
      `  media_breaks:        ${step.slots.media_breaks ? `${step.slots.media_breaks.value} ✓` : 'fehlt'}`,
    ]
    return `[${step.status}] "${title}"${role ? ` (${role})` : ''}\n${slotLines.join('\n')}`
  }).join('\n\n')
}

function formatExtractionsLog(log: RawExtraction[]): string {
  if (log.length === 0) return '- Noch nichts extrahiert.'

  const lines: string[] = []
  for (const item of log) {
    if (item.type === 'process_step') {
      const c = item.content as Record<string, unknown>
      lines.push(`- [process_step] "${c.title}"`)
    } else if (item.type === 'pain_point') {
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
// Full methodology documented in docs/agent-procedures.md

function buildSystemPrompt(ctx: InterviewContext): string {
  const focusLine = ctx.focusTopics
    ? `Fokusthemen des Beraters: ${ctx.focusTopics}`
    : 'Keine spezifischen Fokusthemen — führe eine offene Prozessexploration durch.'

  const warnAt = ctx.maxDurationMinutes - 5
  const hardAt = ctx.maxDurationMinutes

  const timingWarning =
    ctx.timerMinutes >= hardAt
      ? `\n⚠️ KRITISCH: ${hardAt} Minuten erreicht. Beende das Interview sofort mit complete_interview.`
      : ctx.timerMinutes >= warnAt
      ? `\n⚠️ HINWEIS: ${warnAt} Minuten erreicht. Leite aktiv in die wrap_up-Phase über.`
      : ''

  const shortModeHint =
    ctx.maxDurationMinutes <= 10
      ? '\n- Kurzmodus aktiv: Halte Übergänge zwischen Phasen kurz und komm zügig zum Abschluss.'
      : ''

  const coverageCheckSection = ctx.phase === 'coverage_check' && ctx.missingSlotsForCoverageCheck && ctx.missingSlotsForCoverageCheck.length > 0
    ? `\n## Fehlende Pflicht-Slots (coverage_check)\n${ctx.missingSlotsForCoverageCheck.map(m => `- Schritt "${m.step_title}" → ${m.slot}`).join('\n')}\nFrage diese Werte gezielt und natürlich nach, bevor du zu wrap_up übergehst.`
    : ctx.phase === 'coverage_check'
    ? '\n## Coverage vollständig\nAlle Pflicht-Slots gefüllt. Wechsle direkt zu wrap_up via transition_phase.'
    : ''

  return `Du bist KI-Interviewer für Meridian. Deine Aufgabe: implizites Prozesswissen von Mitarbeitern strukturiert erheben.
Führe das Gespräch auf Deutsch — freundlich, professionell und aufmerksam.
Vollständige Methodik: docs/agent-procedures.md

## Interview-Kontext
- Mitarbeiter: ${ctx.employeeName}${ctx.employeeRole ? `, ${ctx.employeeRole}` : ''}
- Abteilung: ${ctx.department}
- ${focusLine}
- Phase: ${ctx.phase}
- Verstrichene Zeit: ${ctx.timerMinutes} / ${ctx.maxDurationMinutes} Minuten${timingWarning}${shortModeHint}

## Schritt-Tracker (aktueller Slot-Filling-Stand)
${formatStepTracker(ctx.stepTracker)}

## Extrahierte Wissensobjekte
${formatExtractionsLog(ctx.extractionsLog)}
${coverageCheckSection}

## Phasenmodell
intro → process_loop (explore_step → quantify_step → bottleneck_probe, für jeden Schritt) → coverage_check → wrap_up

## Methodik: intro
Stelle dich als KI-Interviewer von Meridian vor. Erkläre kurz den Zweck (Prozesswissen dokumentieren, nicht bewerten). Baue Vertrauen auf. Frage nach der Rolle und einem typischen Arbeitstag. Wechsle nach 1–2 Austauschen zu process_loop via transition_phase.

## Methodik: process_loop / explore_step
Ziel: Konkreten Prozessschritt identifizieren und mit register_step eintragen.
- Nutze Critical Incident Technique: "Erzählen Sie mir von einem konkreten Fall, wo Sie [Tätigkeit] durchgeführt haben."
- Nutze CTA-Walkthrough: "Gehen Sie mir durch, was genau Sie tun, von Anfang bis Ende."
- Sobald der Schritt klar benannt ist: register_step aufrufen (title, optional role).
- Wechsle dann zu quantify_step (bleibt in process_loop, ändert Substatus intern).

## Methodik: process_loop / quantify_step
Ziel: Pflicht-Slots füllen — frequency_per_month, duration_minutes, rule_based.
- Max 2 Slots pro Turn. Frage natürlich, nicht wie ein Fragebogen.
- Slot-Inventar und Default-Fragen:
  * frequency_per_month: "Wie oft kommt das vor?" / Probe: "Eher täglich, wöchentlich oder seltener?"
  * duration_minutes: "Wie lange dauert ein Durchlauf?" / Probe: "Wenn alles glatt läuft vs. wenn es hakt?"
  * rule_based: "Läuft das immer gleich ab?" / Probe: "Gibt es eine feste Reihenfolge oder Checkliste?"
  * data_sources: "Mit welchen Systemen arbeiten Sie dabei?" / Probe: "Wo holen Sie die Daten her, wo geben Sie sie ein?"
  * error_rate_percent: "Wie oft geht etwas schief?" / Probe: "Eher 1 von 100, oder öfter?"
  * media_breaks: "Müssen Sie zwischen Systemen wechseln?" / Probe: "Wie oft kopieren Sie etwas manuell?"
- Sobald du einen Wert hörst: record_slot aufrufen mit evidence_quote (MUSS wörtliches Zitat aus dem Mitarbeiter-Statement sein).
- Einsilbige Antwort ("Weiß nicht", "Ja"): Einmal Laddering-Probe, dann weiter — kein endloses Bohren.

## Methodik: process_loop / bottleneck_probe
Ziel: Pain Points an konkreten Schritten verorten.
- Trigger-Phrasen für aktives Nachfragen: "zeitaufwändig", "umständlich", "geht oft schief", "manuell", "nervig", "Fehler"
- Wenn Bottleneck identifiziert: link_bottleneck aufrufen mit step_title, description und severity (high/medium/low).
- Danach: Entscheide ob weiterer Schritt erkundet wird (zurück zu explore_step) oder coverage_check eingeleitet wird.

## Methodik: coverage_check
Ziel: Fehlende Pflicht-Slots aller Schritte nachfüllen.
- Einleiten mit enter_coverage_check — gibt dir die leere Pflicht-Slot-Liste.
- Frage fehlende Werte in natürlichem Kontext nach, nicht als Liste.
- Wenn alle Pflicht-Slots gefüllt: transition_phase zu wrap_up.

## Methodik: wrap_up
Ziel: Interview geordnet abschließen.
- Fasse 3–5 wichtigste identifizierte Schritte und Bottlenecks zusammen.
- Validiere Stundensatz: "Stimmt für Ihre Rolle der angenommene Stundensatz X € ungefähr?"
- Frage ob noch etwas Wichtiges fehlt.
- Bedanke dich herzlich.
- Rufe complete_interview auf.

## Tool-Regeln
- register_step: Aufrufen sobald Schritt klar benannt — einmalig pro Schritt. Bei Duplikat (gleicher title) nicht erneut aufrufen.
- record_slot: evidence_quote MUSS wörtliches Zitat aus dem Mitarbeiter-Statement sein, kein Paraphrasieren. Wird server-seitig validiert.
- enter_coverage_check: Einmalig aufrufen beim Übergang zur coverage_check-Phase.
- link_bottleneck: Aufrufen wenn Pain Point explizit an einem Schritt verortet werden kann.
- transition_phase: Aufrufen beim Phasenwechsel. Nicht im Text erwähnen.
- update_topics: Nach jedem Turn mit aktualisierten Listen aufrufen.
- complete_interview: Nur in wrap_up nach dem abschließenden Dank.
- Tools IMMER am Ende der Antwort aufrufen — nie vor dem Text, nie mitten im Text.

## Gesprächsregeln
- Pro Antwort GENAU EINE Frage stellen — nie zwei gleichzeitig.
- Antworten kurz halten: max 2–3 Sätze Reaktion + eine Folgefrage.
- Paraphrasiere vor jeder Nachfrage: "Wenn ich Sie richtig verstehe, ..."
- Prüfe Schritt-Tracker: Slot mit ✓ nicht erneut erfragen.
- Halluzinations-Guard: Slot nur setzen wenn Mitarbeiter den Wert explizit genannt hat.`
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export function buildTools(interviewId: string, workspaceId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdmin() as any

  return {
    transition_phase: tool({
      description: 'Wechselt die Interview-Phase. Aufrufen beim Übergang von einer Phase zur nächsten.',
      inputSchema: z.object({
        new_phase: z.enum(['process_loop', 'coverage_check', 'wrap_up']),
      }),
      execute: async ({ new_phase }) => {
        try {
          await supabase
            .from('interview_state')
            .update({ phase: new_phase, updated_at: new Date().toISOString() })
            .eq('interview_id', interviewId)
          return { success: true, phase: new_phase }
        } catch (err) {
          console.error('[transition_phase] failed:', err)
          return { success: false, error: (err as Error).message }
        }
      },
    }),

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

    complete_interview: tool({
      description: 'Schließt das Interview ab. Nur in wrap_up nach dem abschließenden Dank aufrufen.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          await supabase
            .from('interviews')
            .update({ status: 'completed', extractions_pending: true })
            .eq('id', interviewId)
          await supabase
            .from('interview_state')
            .update({ phase: 'wrap_up', updated_at: new Date().toISOString() })
            .eq('interview_id', interviewId)
          return { success: true }
        } catch (err) {
          console.error('[complete_interview] failed:', err)
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

          // Deduplicate: case-insensitive title match
          const normalizedTitle = title.trim().toLowerCase()
          const exists = current.some((s) => s.title.trim().toLowerCase() === normalizedTitle)
          if (exists) {
            return { success: true, deduplicated: true, message: 'Schritt bereits vorhanden' }
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
          }

          const updated = [...current, newEntry]
          await supabase
            .from('interview_state')
            .update({ step_tracker: updated, updated_at: new Date().toISOString() })
            .eq('interview_id', interviewId)

          return { success: true, step_tracker: updated }
        } catch (err) {
          console.error('[register_step] failed:', err)
          return { success: false, error: (err as Error).message }
        }
      },
    }),

    record_slot: tool({
      description: 'Füllt einen Slot im Schritt-Tracker mit dem erhobenen Wert und einem wörtlichen Beleg-Zitat. evidence_quote MUSS ein wörtliches Zitat aus der Mitarbeiter-Antwort sein.',
      inputSchema: z.object({
        step_title: z.string().min(1),
        slot: z.enum(['frequency_per_month', 'duration_minutes', 'rule_based', 'data_sources', 'error_rate_percent', 'media_breaks']),
        value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
        evidence_quote: z.string().min(3, 'evidence_quote muss ein wörtliches Zitat enthalten'),
      }),
      execute: async ({ step_title, slot, value, evidence_quote }) => {
        if (!evidence_quote || evidence_quote.trim().length < 3) {
          return { success: false, error: 'evidence_quote fehlt oder zu kurz. Zitiere wörtlich aus der Mitarbeiter-Antwort.' }
        }

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
            status: 'quantifying',
            slots: {
              ...updated[stepIndex].slots,
              [slot]: { value, quote: evidence_quote },
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

          return { success: true, step_title, slot, value }
        } catch (err) {
          console.error('[record_slot] failed:', err)
          return { success: false, error: (err as Error).message }
        }
      },
    }),

    enter_coverage_check: tool({
      description: 'Leitet die coverage_check-Phase ein. Gibt eine Liste aller leeren Pflicht-Slots zurück, die noch nachgefragt werden müssen.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const { data: stateRow } = await supabase
            .from('interview_state')
            .select('step_tracker')
            .eq('interview_id', interviewId)
            .maybeSingle()

          const steps: StepEntry[] = (stateRow?.step_tracker as StepEntry[] | null) ?? []
          const missing = computeMissingMandatorySlots(steps)

          await supabase
            .from('interview_state')
            .update({ phase: 'coverage_check', updated_at: new Date().toISOString() })
            .eq('interview_id', interviewId)

          return {
            success: true,
            phase: 'coverage_check',
            missing_mandatory_slots: missing,
            all_covered: missing.length === 0,
          }
        } catch (err) {
          console.error('[enter_coverage_check] failed:', err)
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
  }
}

// ─── Stream Factory ───────────────────────────────────────────────────────────

export interface AgentStreamOptions {
  context: InterviewContext
  history: TurnMessage[]
  isReconnect?: boolean
  onFinish?: (text: string) => Promise<void>
}

export function createInterviewStream(opts: AgentStreamOptions) {
  const model = resolveModel(process.env.INTERVIEW_MODEL)

  const messages: { role: 'user' | 'assistant'; content: string }[] = opts.isReconnect
    ? [
        ...opts.history.map((t) => ({ role: t.role, content: t.content })),
        {
          role: 'user' as const,
          content:
            '[SYSTEM: Der Mitarbeiter hat die Verbindung wiederhergestellt. Begrüße ihn adaptiv — beziehe dich kurz auf das bisherige Gespräch und lade ihn ein weiterzumachen.]',
        },
      ]
    : opts.history.map((t) => ({ role: t.role, content: t.content }))

  return streamText({
    model,
    system: buildSystemPrompt(opts.context),
    messages,
    tools: buildTools(opts.context.interviewId, opts.context.workspaceId),
    // Single LLM step: model generates text + calls tools in one response.
    // stepCountIs(1) prevents a second LLM call that would re-generate similar
    // text after tool results, which caused visible text duplication in the UI.
    stopWhen: stepCountIs(1),
    onFinish: opts.onFinish
      ? async ({ text }) => {
          await opts.onFinish!(text)
        }
      : undefined,
  })
}

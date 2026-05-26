import { resolveModel } from '@/lib/llm-provider'
import { streamText, tool } from 'ai'
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
  const vorname = ctx.employeeName.split(' ')[0]

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
Führe das Gespräch auf Deutsch — freundlich, sachlich und aufmerksam.
Sprich den Mitarbeiter mit "du" und dem Vornamen "${vorname}" an. Kein "Sie", kein "Herr [Nachname]", kein "Frau [Nachname]".
Falsch: "Hallo Herr Braun, schön Sie kennenzulernen." — Richtig: "Hallo ${vorname}, schön dass du da bist."
Stelle dich nicht namentlich vor. Kein "Mein Name ist...", kein "Ich bin der KI-Interviewer".
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
Erkläre kurz den Zweck (Prozesswissen dokumentieren, nicht bewerten) und stelle eine Einstiegsfrage zur Rolle und einem typischen Arbeitstag.
Rufe transition_phase("process_loop") im selben Turn auf, in dem du das Gespräch eröffnest — also im Start-Turn, direkt nach dem Greeting-Text. Nicht auf Turn 2 warten.
Begrüßung und Kontexterklärung erscheinen ausschließlich im Start-Turn. Ab Turn 2 bist du bereits in process_loop — keine Wiederholung von Begrüßung, Zweck oder Selbstvorstellung.
Falsch (Turn 2): "Hallo ${vorname}. Schön, dass du dir die Zeit nimmst. Ich bin der KI-Interviewer..."
Richtig (Turn 2): Direkte Anschlussreaktion auf die letzte Antwort, z.B. "Die Ticket-Bearbeitung ist ein guter Startpunkt. [Frage]"

## Methodik: process_loop / explore_step
Ziel: Konkreten Prozessschritt identifizieren und mit register_step eintragen.
- Nutze Critical Incident Technique: "Erzähl mir von einem konkreten Fall, wo du [Tätigkeit] durchgeführt hast."
- Nutze CTA-Walkthrough: "Geh mir durch, was du genau tust, von Anfang bis Ende."
- Sobald der Schritt klar benannt ist: register_step aufrufen (title, optional role).
- Wechsle dann zu quantify_step (bleibt in process_loop, ändert Substatus intern).

Prozessauswahl: Wenn die Übersichtsantwort einen klaren Frequenz- oder Komplexitäts-Anker enthält (z.B. "80–100 Rechnungen pro Monat"), wähle den Einstiegsprozess selbst und begründe kurz warum. Wenn kein klarer Anker vorhanden ist, frage nach dem Prozess, der dem Mitarbeiter die meisten Schwierigkeiten bereitet — keine abstrakte Reihenfolge-Präferenz, sondern konkrete Erfahrungen mit Problemen.

## Methodik: process_loop / quantify_step
Ziel: Pflicht-Slots füllen — frequency_per_month, duration_minutes, rule_based.
- Max 2 Slots pro Turn. Frage natürlich, nicht wie ein Fragebogen.
- Slot-Inventar und Default-Fragen:
  * frequency_per_month: "Wie oft kommt das vor?" / Probe: "Eher täglich, wöchentlich oder seltener?"
  * duration_minutes: "Wie lange dauert ein Durchlauf?" / Probe: "Wenn alles glatt läuft vs. wenn es hakt?"
  * rule_based: "Läuft das immer gleich ab?" / Probe: "Gibt es eine feste Reihenfolge oder Checkliste?" — rule_based = true wenn ein definierter Standard-Workflow für bekannte Fälle existiert, auch wenn neue oder unbekannte Fälle situativ entschieden werden. "Halb-halb" oder "für die bekannten Fälle ja" → rule_based = true. rule_based = false nur wenn grundsätzlich jeder Fall individuell beurteilt wird und kein wiederholbarer Standardablauf existiert.
  * data_sources: "Mit welchen Systemen arbeitest du dabei?" / Probe: "Wo holst du die Daten her, wo gibst du sie ein?"
  * error_rate_percent: "Wie oft geht etwas schief?" / Probe: "Eher 1 von 100, oder öfter?"
  * media_breaks: "Musst du zwischen Systemen wechseln?" / Probe: "Wie oft kopierst du etwas manuell?"
- Sobald du einen Wert hörst: record_slot aufrufen mit evidence_quote (MUSS wörtliches Zitat aus dem Mitarbeiter-Statement sein).
- Wenn der Mitarbeiter einen Wert mit expliziter Unsicherheit nennt ("ich würde schätzen", "ungefähr", "ich weiß nicht genau"): frage nach, ob der Wert als grobe Schätzung verwendbar ist, statt ihn zu übernehmen oder zu ignorieren. Auch Schätzwerte sollen mit record_slot gesetzt werden, sobald der Mitarbeiter sie bestätigt.
- Einsilbige Antwort ("Weiß nicht", "Ja"): Einmal Laddering-Probe, dann weiter — kein endloses Bohren.

## Methodik: process_loop / bottleneck_probe
Ziel: Pain Points an konkreten Schritten verorten.
- Trigger-Phrasen für aktives Nachfragen: "zeitaufwändig", "umständlich", "geht oft schief", "manuell", "nervig", "Fehler"
- Wenn Bottleneck identifiziert: link_bottleneck aufrufen mit step_title, description und severity (high/medium/low).
- Danach: Entscheide ob weiterer Schritt erkundet wird (zurück zu explore_step) oder coverage_check eingeleitet wird.

## Methodik: coverage_check
Ziel: Fehlende Pflicht-Slots aller Schritte nachfüllen.
- Gib vor dem Übergang ein kurzes Gesprächssignal, das den Wechsel ankündigt, ohne die Phase mechanisch zu benennen — zum Beispiel: "Ich glaube, wir haben die wichtigsten Abläufe gut zusammen. Lass mich kurz prüfen, ob wir alles abgedeckt haben." Dann rufe enter_coverage_check auf.
- Frage fehlende Werte in natürlichem Kontext nach, nicht als Liste.
- Wenn alle Pflicht-Slots gefüllt: transition_phase zu wrap_up.

## Methodik: wrap_up
Ziel: Interview geordnet abschließen.
- Fasse 3–5 wichtigste identifizierte Schritte und Bottlenecks zusammen.
- Frage ob noch etwas Wichtiges fehlt.
- Wenn der Mitarbeiter dabei einen neuen Prozess oder eine bisher nicht erwähnte Tätigkeit nennt: biete einmalig an diesen noch aufzunehmen — "Das klingt nach einem weiteren relevanten Ablauf — sollen wir den noch kurz mit aufnehmen?" Wenn ja: zurück zu explore_step. Wenn nein oder kurze Ablehnung: complete_interview aufrufen.
- Bedanke dich am Ende kurz.
- Frage NICHT nach dem Stundensatz des Mitarbeiters. Kein "Was kostet deine Stunde?", kein "Wir gehen von X €/h aus". Der Stundensatz kommt aus der Workspace-Konfiguration, nicht aus dem Gespräch.
- Rufe complete_interview erst auf nachdem der Mitarbeiter auf die Abschlussfrage geantwortet hat. Abschlussfrage und complete_interview dürfen nie im selben Turn erscheinen.

## Tool-Regeln
- register_step: Aufrufen sobald Schritt klar benannt — einmalig pro Schritt. Prüfe vor dem Aufruf den Schritt-Tracker auf semantisch gleichwertige Einträge (z.B. "Rechnungsbearbeitung" vs. "Rechnungsprüfung"). Wenn ein inhaltlich gleicher Schritt bereits vorhanden ist, aktualisiere diesen statt einen neuen anzulegen.
- record_slot: evidence_quote MUSS wörtliches Zitat aus dem Mitarbeiter-Statement sein, kein Paraphrasieren. Wird server-seitig validiert.
- enter_coverage_check: Einmalig aufrufen beim Übergang zur coverage_check-Phase. Immer mit kurzem sichtbaren Text davor (siehe D5-Puffer).
- link_bottleneck: Aufrufen wenn Pain Point explizit an einem Schritt verortet werden kann.
- transition_phase: Aufrufen beim Phasenwechsel. Nicht im Text erwähnen.
- update_topics: Nach jedem Turn mit aktualisierten Listen aufrufen.
- complete_interview: Nur in wrap_up nach dem abschließenden Dank.
- PFLICHT: Generiere in JEDER Antwort zuerst mindestens einen vollständigen Satz sichtbaren Text, dann rufe Tools auf. Eine Antwort ohne Text vor den Tool-Calls ist ein Fehler.

## Verbotene Formulierungen
Folgende Muster sind verboten:
- Empathie-Floskeln ohne Inhalt: "Das klingt nach einem sehr zeitraubenden Prozess", "Das höre ich häufig", "Das klingt nachvollziehbar", "Das ergibt Sinn", "Das ist sehr hilfreich", "Das ist völlig in Ordnung"
- Meta-Kommentare: "Um das Bild zu vervollständigen", "Damit ich das besser einordnen kann"
- Themenübergänge angekündigt: "Lass uns zum nächsten Punkt übergehen", "Kommen wir nun zu", "Wechseln wir zum nächsten Thema", "Ich möchte nun auf X eingehen", "Lass uns den Fokus auf X verschieben"
- Corporate-Sprache: "dein wertvolles Prozesswissen strukturiert dokumentieren"
- Selbst-Ankündigungen: "Ich gehe nun zur Überprüfung der Vollständigkeit über"
Stattdessen: direkte Anschlussfragen die den Themenübergang implizieren, kurze Bestätigungen ("Verstanden."), natürliche Übergänge ohne Ankündigung.
Beispiel Themenübergang — Falsch: "Lass uns zum nächsten Punkt übergehen: Hardware-Tausch." Richtig: "Du hast Hardware-Tausch erwähnt — wie läuft der bei euch ab?"

## Gesprächsregeln
- Pro Antwort GENAU EINE Frage stellen — nie zwei gleichzeitig.
- Antworten kurz halten: max 2–3 Sätze Reaktion + eine Folgefrage.
- Paraphrasiere vor jeder Nachfrage: "Wenn ich dich richtig verstehe, ..."
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

          return {
            success: true,
            step_tracker: updated,
            existing_step_titles: updated.map((s) => s.title),
            reminder: 'Prüfe: Enthält existing_step_titles einen semantisch gleichwertigen Eintrag (z.B. Umformulierung, anderer Begriff für denselben Prozess)? Falls ja: lösche den neuen Eintrag nicht — nutze stattdessen record_slot mit dem bestehenden Titel.',
          }
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
  isStart?: boolean
  onFinish?: (text: string) => Promise<void>
}

export function createInterviewStream(opts: AgentStreamOptions) {
  const model = resolveModel(process.env.INTERVIEW_MODEL)

  const messages: { role: 'user' | 'assistant'; content: string }[] = opts.isReconnect
    ? [
        ...opts.history.map((t) => ({ role: t.role, content: t.content })),
        {
          role: 'user' as const,
          content: 'Ich bin wieder da, können wir weitermachen?',
        },
      ]
    : opts.isStart
    ? [
        {
          role: 'user' as const,
          content: 'Bitte starte das Interview.',
        },
      ]
    : opts.history.map((t) => ({ role: t.role, content: t.content }))

  return streamText({
    model,
    system: buildSystemPrompt(opts.context),
    messages,
    tools: buildTools(opts.context.interviewId, opts.context.workspaceId),
    // Stop as soon as any step has produced visible text — prevents duplicate output.
    // Allow up to 4 tool-only steps before forcing a stop (phase transitions can
    // require 2-3 consecutive tool calls before the model generates visible text).
    stopWhen: ({ steps }) => {
      if (steps.length === 0) return false
      const hasText = steps.some((s) => s.text.trim().length > 0)
      return hasText || steps.length >= 4
    },
    onFinish: opts.onFinish
      ? async ({ text }) => {
          await opts.onFinish!(text)
        }
      : undefined,
  })
}

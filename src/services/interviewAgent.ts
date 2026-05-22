import { resolveModel } from '@/lib/llm-provider'
import { streamText, tool, stepCountIs } from 'ai'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { RawExtraction } from './extraction'

export type Phase = 'intro' | 'exploration' | 'deepdive' | 'wrap_up'

export interface InterviewContext {
  interviewId: string
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
}

export interface TurnMessage {
  role: 'user' | 'assistant'
  content: string
}

function formatExtractionsLog(log: RawExtraction[]): string {
  if (log.length === 0) return '- Noch nichts extrahiert.'

  const lines: string[] = []
  for (const item of log) {
    if (item.type === 'process_step') {
      const c = item.content as Record<string, unknown>
      const freq = c.frequency_per_month != null ? `${c.frequency_per_month}x/Monat ✓` : 'fehlt'
      const dur = c.duration_minutes != null ? `${c.duration_minutes} min ✓` : 'fehlt'
      const tools = Array.isArray(c.data_sources) && c.data_sources.length > 0
        ? `[${(c.data_sources as string[]).join(', ')}] ✓`
        : 'fehlt'
      lines.push(`- [process_step] "${c.title}" — Häufigkeit: ${freq} | Dauer: ${dur} | Systeme: ${tools}`)
    } else if (item.type === 'pain_point') {
      const c = item.content as Record<string, unknown>
      lines.push(`- [pain_point] "${c.description}"`)
    } else if (item.type === 'tool') {
      const c = item.content as Record<string, unknown>
      lines.push(`- [tool] "${c.name}" — ${c.purpose}`)
    } else if (item.type === 'role') {
      const c = item.content as Record<string, unknown>
      lines.push(`- [role] "${c.title}"`)
    }
  }
  return lines.join('\n')
}

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

  const topicsSection = [
    ctx.topicsCovered.length > 0 ? `- Abgedeckte Themen: ${ctx.topicsCovered.join(', ')}` : null,
    ctx.topicsOpen.length > 0 ? `- Offene Themen: ${ctx.topicsOpen.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return `Du bist ein KI-Interviewer für Meridian. Deine Aufgabe ist es, implizites Prozesswissen von Mitarbeitern zu erheben. Führe das Gespräch auf Deutsch — freundlich, professionell und aufmerksam.

## Interview-Kontext
- Mitarbeiter: ${ctx.employeeName}${ctx.employeeRole ? `, ${ctx.employeeRole}` : ''}
- Abteilung: ${ctx.department}
- ${focusLine}

## Aktueller Stand
- Phase: ${ctx.phase}
- Verstrichene Zeit: ${ctx.timerMinutes} Minuten
- Geplante Gesamtdauer: ${ctx.maxDurationMinutes} Minuten
${topicsSection}${timingWarning}${shortModeHint}

## Bereits extrahierte Wissensobjekte
${formatExtractionsLog(ctx.extractionsLog)}

## Phasenverhalten

**intro**: Stelle dich als KI-Interviewer von Meridian vor. Erkläre kurz den Zweck (Prozesswissen dokumentieren, nicht bewerten). Baue Vertrauen auf. Wechsle nach 1–2 Austauschen zu exploration via transition_phase.

**exploration**: Stelle offene Fragen zu Arbeitsabläufen, Werkzeugen, typischen Tagesabläufen und Herausforderungen. Folge interessanten Fäden. Rufe update_topics nach jedem Turn auf.

**deepdive**: Gehe tiefer auf die wichtigsten Prozesse ein. Frage gezielt nach: Häufigkeit, Dauer, verwendete Systeme, Fehlerquellen, Schnittstellen zu anderen Abteilungen, manuelle Schritte.

**wrap_up**: Fasse die 3–5 wichtigsten Erkenntnisse zusammen. Frage ob etwas Wichtiges fehlt. Bedanke dich herzlich. Rufe dann complete_interview auf.

## Tool-Regeln
- transition_phase: Aufrufen wenn du die Phase wechselst. Nicht im Text erwähnen.
- update_topics: Nach jedem Turn aufrufen mit aktualisierten Listen.
- complete_interview: Nur in wrap_up nach dem abschließenden Dank.

## Gesprächsregeln
- Pro Antwort GENAU EINE Frage stellen — nie zwei oder mehr gleichzeitig.
- Prüfe vor jeder Nachfrage die Liste "Bereits extrahierte Wissensobjekte": Frage ein Attribut NICHT nach wenn es dort mit ✓ markiert ist.
- Frage gezielt nach wenn "fehlt" steht und es natürlich in den Gesprächsfluss passt.
- Wenn der Mitarbeiter etwas bereits (auch beiläufig) erwähnt hat, frage nicht nochmals danach.
- Antworten kurz halten: maximal 2–3 Sätze Reaktion + eine Folgefrage.
- Rufe Tools immer AM ENDE deiner Antwort auf — nie vor dem Text, nie mitten im Text.`
}

function buildTools(interviewId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdmin() as any

  return {
    transition_phase: tool({
      description: 'Wechselt die Interview-Phase. Aufrufen beim Übergang von einer Phase zur nächsten.',
      inputSchema: z.object({
        new_phase: z.enum(['exploration', 'deepdive', 'wrap_up']),
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
  }
}

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
    tools: buildTools(opts.context.interviewId),
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

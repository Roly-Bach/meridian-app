import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText, tool, stepCountIs } from 'ai'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

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
}

export interface TurnMessage {
  role: 'user' | 'assistant'
  content: string
}

function buildSystemPrompt(ctx: InterviewContext): string {
  const focusLine = ctx.focusTopics
    ? `Fokusthemen des Beraters: ${ctx.focusTopics}`
    : 'Keine spezifischen Fokusthemen — führe eine offene Prozessexploration durch.'

  const timingWarning =
    ctx.timerMinutes >= 60
      ? '\n⚠️ KRITISCH: 60 Minuten erreicht. Beende das Interview sofort mit complete_interview.'
      : ctx.timerMinutes >= 50
      ? '\n⚠️ HINWEIS: 50 Minuten erreicht. Leite aktiv in die wrap_up-Phase über.'
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
${topicsSection}${timingWarning}

## Phasenverhalten

**intro**: Stelle dich als KI-Interviewer von Meridian vor. Erkläre kurz den Zweck (Prozesswissen dokumentieren, nicht bewerten). Baue Vertrauen auf. Wechsle nach 1–2 Austauschen zu exploration via transition_phase.

**exploration**: Stelle offene Fragen zu Arbeitsabläufen, Werkzeugen, typischen Tagesabläufen und Herausforderungen. Folge interessanten Fäden. Rufe update_topics nach jedem Turn auf.

**deepdive**: Gehe tiefer auf die wichtigsten Prozesse ein. Frage gezielt nach: Häufigkeit, Dauer, verwendete Systeme, Fehlerquellen, Schnittstellen zu anderen Abteilungen, manuelle Schritte.

**wrap_up**: Fasse die 3–5 wichtigsten Erkenntnisse zusammen. Frage ob etwas Wichtiges fehlt. Bedanke dich herzlich. Rufe dann complete_interview auf.

## Tool-Regeln
- transition_phase: Aufrufen wenn du die Phase wechselst. Nicht im Text erwähnen.
- update_topics: Nach jedem Turn aufrufen mit aktualisierten Listen.
- complete_interview: Nur in wrap_up nach dem abschließenden Dank.`
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
        await supabase
          .from('interview_state')
          .update({ phase: new_phase, updated_at: new Date().toISOString() })
          .eq('interview_id', interviewId)
        return { success: true, phase: new_phase }
      },
    }),

    update_topics: tool({
      description: 'Aktualisiert die Liste der abgedeckten und offenen Themen nach einem Turn.',
      inputSchema: z.object({
        covered: z.array(z.string()),
        open: z.array(z.string()),
      }),
      execute: async ({ covered, open }) => {
        await supabase
          .from('interview_state')
          .update({
            topics_covered: covered,
            topics_open: open,
            updated_at: new Date().toISOString(),
          })
          .eq('interview_id', interviewId)
        return { success: true }
      },
    }),

    complete_interview: tool({
      description: 'Schließt das Interview ab. Nur in wrap_up nach dem abschließenden Dank aufrufen.',
      inputSchema: z.object({}),
      execute: async () => {
        await supabase
          .from('interviews')
          .update({ status: 'completed', extractions_pending: true })
          .eq('id', interviewId)
        await supabase
          .from('interview_state')
          .update({ phase: 'wrap_up', updated_at: new Date().toISOString() })
          .eq('interview_id', interviewId)
        return { success: true }
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
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const modelId = (process.env.INTERVIEW_MODEL ?? 'claude-opus-4-5') as Parameters<typeof anthropic>[0]

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
    model: anthropic(modelId),
    system: buildSystemPrompt(opts.context),
    messages,
    tools: buildTools(opts.context.interviewId),
    // Allow up to 3 LLM steps so tools can be called and the model can produce
    // follow-up text in the same turn without a separate client roundtrip.
    stopWhen: stepCountIs(3),
    onFinish: opts.onFinish
      ? async ({ text }) => {
          await opts.onFinish!(text)
        }
      : undefined,
  })
}

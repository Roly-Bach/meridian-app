import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

/**
 * PROJ-43 (AC2/AC3): creates an interview parked in phase='clarification' with
 * a fixed set of deterministic SlotCards (varied `direction`) so E2E tests can
 * drive the real two-way Card UI without running a full LLM conversation first.
 */
export async function createClarificationFixtureInterview(): Promise<{ token: string; interviewId: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const workspaceId = process.env.EVAL_WORKSPACE_ID
  if (!url || !serviceKey || !workspaceId) throw new Error('Missing Supabase/EVAL_WORKSPACE_ID env vars')

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const token = randomUUID()

  const { data: interview, error } = await admin
    .from('interviews')
    .insert({
      workspace_id: workspaceId,
      employee_name: 'QA Test Person',
      employee_role: 'Tester',
      department: 'QA',
      status: 'active',
      access_token: token,
      token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      max_duration_minutes: 30,
      next_briefing: {
        clarification_cards: [
          { process_step_id: 'S001', step_title: 'Rechnungsprüfung', question: 'Wie oft kommt dieser Schritt vor?', options: [], slot_key: 'frequency', answer_type: 'single', direction: 'hoch' },
          { process_step_id: 'S001', step_title: 'Rechnungsprüfung', question: 'Wie lange dauert eine einzelne Durchführung?', options: [], slot_key: 'duration', answer_type: 'single', direction: 'niedrig' },
          { process_step_id: 'S002', step_title: 'Monatsabschluss', question: 'Wie häufig treten dabei Fehler oder Korrekturen auf?', options: [], slot_key: 'error_rate_percent', answer_type: 'single', direction: null },
          { process_step_id: 'S002', step_title: 'Monatsabschluss', question: 'Wie ist die Entscheidungslogik?', options: [], slot_key: 'entscheidungslogik', answer_type: 'single' },
        ],
      },
    })
    .select('id')
    .single()
  if (error || !interview) throw new Error(`createClarificationFixtureInterview: insert failed: ${error?.message}`)

  const stepTracker = [
    {
      id: 'S001', title: 'Rechnungsprüfung', reihenfolge: 1, status: 'walkthrough', abhaengigkeiten: null,
      potenzial: {
        frequency: { value: null, quote: 'q', nicht_befund_typ: null, richtung: 'hoch' },
        duration: { value: null, quote: 'q', nicht_befund_typ: null, richtung: 'niedrig' },
        error_rate_percent: null,
        media_breaks: null,
      },
      slots: {
        entscheidungslogik: null, tazite_cues: null, ausnahmen: null, inputs: null, outputs: null,
        hilfsmittel: null, reibungspunkte: null, ausloeser: null, aufgabentyp: null, risiko_schwere: null,
        standardisierungsgrad: null, informationsdichte: null,
      },
    },
    {
      id: 'S002', title: 'Monatsabschluss', reihenfolge: 2, status: 'walkthrough', abhaengigkeiten: null,
      potenzial: {
        frequency: { value: 4, quote: 'q', nicht_befund_typ: null },
        duration: { value: 20, quote: 'q', nicht_befund_typ: null },
        error_rate_percent: null,
        media_breaks: null,
      },
      slots: {
        entscheidungslogik: null, tazite_cues: null, ausnahmen: null, inputs: null, outputs: null,
        hilfsmittel: null, reibungspunkte: null, ausloeser: null, aufgabentyp: null, risiko_schwere: null,
        standardisierungsgrad: null, informationsdichte: null,
      },
    },
  ]

  const { error: stateError } = await admin
    .from('interview_state')
    .insert({ interview_id: interview.id, phase: 'clarification', step_tracker: stepTracker })
  if (stateError) throw new Error(`createClarificationFixtureInterview: state insert failed: ${stateError.message}`)

  return { token, interviewId: interview.id as string }
}

export async function deleteClarificationFixtureInterview(interviewId: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  await admin.from('interview_state').delete().eq('interview_id', interviewId)
  await admin.from('knowledge_objects').delete().eq('interview_id', interviewId)
  await admin.from('process_steps').delete().eq('interview_id', interviewId)
  await admin.from('turns').delete().eq('interview_id', interviewId)
  await admin.from('interviews').delete().eq('id', interviewId)
}

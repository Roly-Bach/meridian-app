import { generateText } from 'ai'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveModel } from '@/lib/llm-provider'
import { generateEmbedding } from './embeddings'
import type { StepEntry } from './interviewAgent'

interface EnrichedAttribute<T> {
  value: T | null
  evidence_quote: string | null
}

interface LLMProcessStep {
  knowledge_object_id: string
  title: string
  description: string | null
  role: string | null
  source_quote: string | null
  step_type: 'action' | 'decision' | null
  condition_text: string | null
  attributes: {
    frequency_per_month: EnrichedAttribute<number>
    duration_minutes: EnrichedAttribute<number>
    data_sources: EnrichedAttribute<string[]>
    rule_based: EnrichedAttribute<boolean>
    error_rate_percent: EnrichedAttribute<number>
    media_breaks: EnrichedAttribute<number>
  }
}

const ENRICHMENT_SYSTEM_PROMPT = `Du bist ein Prozessanalyse-Agent für Meridian. Leite quantitative Attribute für Prozessschritte aus Interview-Transkripten ab.

KRITISCHE REGEL: Setze ein Attribut NUR wenn es im Interview EXPLIZIT genannt wurde.
- Kein Raten, keine Schätzungen, keine Annahmen
- Ohne klaren Beleg im Transkript: value = null, evidence_quote = null
- evidence_quote MUSS ein wörtliches Zitat aus dem Mitarbeiter-Input sein

Attribute:
- frequency_per_month (integer): Nur wenn Häufigkeit explizit genannt ("täglich" → 22, "wöchentlich" → 4, "jeden Montag" → 4, "monatlich" → 1)
- duration_minutes (integer): Nur wenn Dauer explizit genannt ("2 Stunden" → 120, "30 Minuten" → 30)
- data_sources (string[]): Nur explizit genannte Systeme/Tools als Datenquellen
- rule_based (boolean): true NUR bei "immer gleich", "feste Regel", "immer wenn X dann Y" — sonst false
- error_rate_percent (integer 0-100): Nur wenn Fehlerrate/Probleme mit Häufigkeit explizit erwähnt
- media_breaks (integer): Nur wenn Systemwechsel explizit beschrieben

Zusätzlich: Schritt-Typ bestimmen
- step_type = "decision" wenn der Schritt eine Entscheidungsverzweigung beschreibt ("wenn X dann Y sonst Z", "je nachdem ob", "abhängig davon")
- condition_text: Bedingung als Prosatext, z.B. "Wenn interne Kapazität vorhanden → intern, sonst → extern"
- Alle anderen Schritte: step_type = "action", condition_text = null

Ausgabeformat — nur valides JSON, kein Text davor oder danach:
[
  {
    "knowledge_object_id": "uuid",
    "title": "Titel des Prozessschritts",
    "description": "Beschreibung oder null",
    "role": "Rolle oder null",
    "source_quote": "Originalzitat aus dem Interview",
    "step_type": "action",
    "condition_text": null,
    "attributes": {
      "frequency_per_month": { "value": 4, "evidence_quote": "jeden Montag" },
      "duration_minutes": { "value": null, "evidence_quote": null },
      "data_sources": { "value": ["SAP", "Excel"], "evidence_quote": "wir nutzen SAP und Excel" },
      "rule_based": { "value": false, "evidence_quote": null },
      "error_rate_percent": { "value": null, "evidence_quote": null },
      "media_breaks": { "value": null, "evidence_quote": null }
    }
  }
]`

// Guard: only use attribute value if evidence_quote is present and non-empty
export function applyGroundingGuard<T>(attr: EnrichedAttribute<T>): T | null {
  if (!attr || !attr.evidence_quote || attr.evidence_quote.trim() === '') return null
  return attr.value
}

export async function enrichProcessSteps({
  interviewId,
  workspaceId,
}: {
  interviewId: string
  workspaceId: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()

  // ── Idempotency check ────────────────────────────────────────────────────────
  const { count } = await supabase
    .from('process_steps')
    .select('*', { count: 'exact', head: true })
    .eq('interview_id', interviewId)

  if ((count ?? 0) > 0) {
    return
  }

  // ── Fetch process_step knowledge objects ─────────────────────────────────────
  const { data: knowledgeObjects } = await supabase
    .from('knowledge_objects')
    .select('id, content, source_quote, embedding')
    .eq('interview_id', interviewId)
    .eq('type', 'process_step')

  if (!knowledgeObjects || knowledgeObjects.length === 0) {
    return
  }

  // ── Fetch transcript ─────────────────────────────────────────────────────────
  const { data: turns } = await supabase
    .from('turns')
    .select('turn_number, user_input, agent_response')
    .eq('interview_id', interviewId)
    .order('turn_number', { ascending: true })

  const transcript = (turns ?? [])
    .map((t) => `Turn ${t.turn_number}:\nMitarbeiter: ${t.user_input}\nAgent: ${t.agent_response}`)
    .join('\n\n')

  const objectsInput = JSON.stringify(
    knowledgeObjects.map((ko) => ({
      id: ko.id,
      content: ko.content,
      source_quote: ko.source_quote,
    }))
  )

  // ── LLM Enrichment ───────────────────────────────────────────────────────────
  let enriched: LLMProcessStep[] = []
  try {
    const { text } = await generateText({
      model: resolveModel(process.env.ENRICHMENT_MODEL),
      system: ENRICHMENT_SYSTEM_PROMPT,
      prompt: `Vollständiges Transkript:\n${transcript}\n\nProzessschritte zum Anreichern:\n${objectsInput}`,
      maxOutputTokens: 4000,
    })

    const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) throw new Error('Response is not an array')
    enriched = parsed
  } catch (err) {
    console.error('[processEnrichment] LLM enrichment failed:', err)
    return
  }

  // Build embedding lookup: knowledge_object_id → embedding
  const embeddingByKoId = new Map<string, number[] | null>(
    (knowledgeObjects ?? []).map((ko) => [ko.id, ko.embedding as number[] | null])
  )

  // ── Insert with grounding guard ──────────────────────────────────────────────
  for (const step of enriched) {
    if (!step.title) {
      console.error('[processEnrichment] Skipping step without title:', step)
      continue
    }

    const embedding = embeddingByKoId.get(step.knowledge_object_id) ?? null

    const { error } = await supabase.from('process_steps').insert({
      interview_id: interviewId,
      workspace_id: workspaceId,
      title: step.title,
      description: step.description ?? null,
      role: step.role ?? null,
      source_quote: step.source_quote ?? null,
      step_type: step.step_type === 'decision' ? 'decision' : 'action',
      condition_text: step.step_type === 'decision' ? (step.condition_text ?? null) : null,
      embedding,
      frequency_per_month: applyGroundingGuard(step.attributes?.frequency_per_month ?? { value: null, evidence_quote: null }),
      duration_minutes: applyGroundingGuard(step.attributes?.duration_minutes ?? { value: null, evidence_quote: null }),
      data_sources: applyGroundingGuard(step.attributes?.data_sources ?? { value: null, evidence_quote: null }) ?? [],
      rule_based: applyGroundingGuard(step.attributes?.rule_based ?? { value: null, evidence_quote: null }) ?? false,
      error_rate_percent: applyGroundingGuard(step.attributes?.error_rate_percent ?? { value: null, evidence_quote: null }),
      media_breaks: applyGroundingGuard(step.attributes?.media_breaks ?? { value: null, evidence_quote: null }) ?? 0,
    })

    if (error) {
      console.error('[processEnrichment] DB insert failed:', error.message)
    }
  }
}

// ── LLM prompt for tracker-based description/quote generation ─────────────────
const TRACKER_DESCRIPTION_PROMPT = `Du bist ein Prozessanalyst für Meridian. Deine Aufgabe: Generiere für jeden Prozessschritt eine kurze Beschreibung und ein belegendes Zitat direkt aus dem Interview-Transkript.

KRITISCHE REGELN:
- source_quote MUSS ein wörtliches Zitat aus dem Mitarbeiter-Input sein — kein Paraphrasieren, kein Erfinden
- description max 2 Sätze, nur aus dem Transkript belegbar — keine Ergänzungen die nicht gesagt wurden
- step_type = "decision" NUR wenn eine explizite Entscheidungsverzweigung beschrieben wird ("wenn X dann Y sonst Z")
- condition_text: Bedingung als Prosatext, nur wenn step_type = "decision"
- Wenn kein passendes Zitat gefunden: source_quote = null

Ausgabeformat — nur valides JSON, kein Text davor oder danach:
[
  {
    "step_title": "...",
    "description": "...",
    "source_quote": "wörtliches Zitat oder null",
    "step_type": "action",
    "condition_text": null
  }
]`

interface TrackerDescriptionOutput {
  step_title: string
  description: string | null
  source_quote: string | null
  step_type: 'action' | 'decision'
  condition_text: string | null
}

// Creates process_steps from interview_state.step_tracker (authoritative agent source).
// Quantitative slots come directly from step_tracker (no LLM). LLM generates only
// description + source_quote grounded in the transcript.
export async function createProcessStepsFromTracker({
  interviewId,
  workspaceId,
}: {
  interviewId: string
  workspaceId: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()

  // ── Idempotency check ────────────────────────────────────────────────────────
  const { count } = await supabase
    .from('process_steps')
    .select('*', { count: 'exact', head: true })
    .eq('interview_id', interviewId)

  if ((count ?? 0) > 0) return

  // ── Load step_tracker ────────────────────────────────────────────────────────
  const { data: stateRow } = await supabase
    .from('interview_state')
    .select('step_tracker')
    .eq('interview_id', interviewId)
    .single()

  const allSteps = (stateRow?.step_tracker as StepEntry[] | null) ?? []
  const steps = allSteps.filter((s) => s.status !== 'exploring')

  if (steps.length === 0) return

  // ── Load transcript ──────────────────────────────────────────────────────────
  const { data: turns } = await supabase
    .from('turns')
    .select('turn_number, user_input, agent_response')
    .eq('interview_id', interviewId)
    .order('turn_number', { ascending: true })

  const transcript = (turns ?? [])
    .map((t) => `Turn ${t.turn_number}:\nMitarbeiter: ${t.user_input}\nAgent: ${t.agent_response}`)
    .join('\n\n')

  const stepsInput = JSON.stringify(
    steps.map((s) => ({
      step_title: s.title,
      role: s.role ?? null,
      process_steps: s.process_steps ?? [],
      friction_points: s.friction_points ?? [],
      pain_point_primary: s.pain_point_primary ?? null,
    }))
  )

  // ── LLM: generate description + source_quote only ───────────────────────────
  let descriptions: TrackerDescriptionOutput[] = []
  try {
    const { text } = await generateText({
      model: resolveModel(process.env.ENRICHMENT_MODEL),
      system: TRACKER_DESCRIPTION_PROMPT,
      prompt: `Vollständiges Transkript:\n${transcript}\n\nProzessschritte:\n${stepsInput}`,
      maxOutputTokens: 2000,
    })

    const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) throw new Error('Response is not an array')
    descriptions = parsed
  } catch (err) {
    console.error('[createProcessStepsFromTracker] LLM call failed:', err)
    // Fallback: insert with null description/source_quote — slot values still correct
    descriptions = steps.map((s) => ({
      step_title: s.title,
      description: null,
      source_quote: null,
      step_type: 'action' as const,
      condition_text: null,
    }))
  }

  const descByTitle = new Map(descriptions.map((d) => [d.step_title, d]))

  // ── Insert one process_step per tracker entry ────────────────────────────────
  for (const step of steps) {
    const desc = descByTitle.get(step.title)

    const title = step.title
    const description = desc?.description ?? null
    const embedding = await generateEmbedding(`${title} ${description ?? ''}`.trim())

    const { error } = await supabase.from('process_steps').insert({
      interview_id: interviewId,
      workspace_id: workspaceId,
      title,
      description,
      role: step.role ?? null,
      source_quote: desc?.source_quote ?? null,
      step_type: desc?.step_type === 'decision' ? 'decision' : 'action',
      condition_text: desc?.step_type === 'decision' ? (desc.condition_text ?? null) : null,
      embedding: embedding as number[],
      frequency_per_month: (step.slots.frequency_per_month?.value as number) ?? null,
      duration_minutes: (step.slots.duration_minutes?.value as number) ?? null,
      rule_based: (step.slots.rule_based?.value as boolean) ?? false,
      data_sources: (step.slots.data_sources?.value as string[]) ?? [],
      error_rate_percent: (step.slots.error_rate_percent?.value as number) ?? null,
      media_breaks: (step.slots.media_breaks?.value as number) ?? 0,
    })

    if (error) {
      console.error('[createProcessStepsFromTracker] DB insert failed:', error.message)
    }
  }
}

import { generateText } from 'ai'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateEmbedding } from './embeddings'
import { resolveModel } from '@/lib/llm-provider'
import { cosineSim } from './processClustering'
import { buildTraceMetadata, type TraceCtx } from './_telemetry'

export type KnowledgeObjectType = 'process_step' | 'pain_point' | 'tool' | 'role'

const ALLOWED_TYPES: readonly KnowledgeObjectType[] = ['process_step', 'pain_point', 'tool', 'role']

export interface RawExtraction {
  type: KnowledgeObjectType
  content: Record<string, unknown>
  source_quote: string
}

export interface TurnTranscript {
  user_input: string
  agent_response: string
}

const EXTRACTION_SYSTEM_PROMPT = `Du bist ein Extraktions-Agent für Meridian. Deine Aufgabe: Extrahiere strukturiertes Wissen aus Interview-Transkripten.

Extrahiere ausschließlich diese 4 Typen:
- process_step: Ein konkreter Prozessschritt oder Arbeitsablauf.
  Content: {
    title: string,
    description: string,
    role: string,
    step_type: "action" | "decision",
    condition_text?: string
  }
- pain_point: Ein Problem, Engpass oder eine Frustration. Content: { description: string, severity?: "high"|"medium"|"low" }
- tool: Ein verwendetes Tool, System oder Software. Content: { name: string, purpose: string }
- role: Eine genannte Rolle oder Verantwortlichkeit. Content: { title: string, responsibilities: string }

Regeln:
- source_quote MUSS ein wörtliches Zitat aus dem user_input sein — kein Paraphrasieren
- Extrahiere NUR aus dem LETZTEN user_input, nicht aus vorherigen Turns
- Wenn nichts Relevantes im letzten Turn steht, gib ein leeres Array zurück
- Antworte ausschließlich mit validem JSON — kein erklärender Text davor oder danach

Regeln für process_step step_type:
- step_type = "decision" NUR wenn der Mitarbeiter eine Entscheidungsverzweigung beschreibt
  Schlüsselwörter: "wenn", "falls", "je nachdem", "abhängig davon", "manchmal...manchmal", "entweder...oder"
  condition_text: Bedingung als Prosatext, z.B. "Wenn interne Kapazität vorhanden → intern, sonst → extern"
- Alle anderen Schritte: step_type = "action", condition_text weglassen (oder null)

Ausgabeformat:
[
  {
    "type": "process_step",
    "content": { "title": "...", "description": "...", "role": "...", "step_type": "action" },
    "source_quote": "exaktes Zitat aus user_input"
  },
  {
    "type": "process_step",
    "content": { "title": "...", "description": "...", "role": "...", "step_type": "decision", "condition_text": "Wenn X → Y, sonst → Z" },
    "source_quote": "exaktes Zitat aus user_input"
  }
]`

function buildExtractionPrompt(transcript: TurnTranscript[]): string {
  const history = transcript
    .slice(0, -1)
    .map((t, i) => `Turn ${i + 1}:\nMitarbeiter: ${t.user_input}\nAgent: ${t.agent_response}`)
    .join('\n\n')

  const lastTurn = transcript[transcript.length - 1]

  return `${history ? `Bisheriges Gespräch:\n${history}\n\n` : ''}Letzter Turn (extrahiere NUR hieraus):\nMitarbeiter: ${lastTurn.user_input}`
}

export async function extractAndEmbed({
  interviewId,
  workspaceId,
  turnId,
  transcript,
  traceCtx,
}: {
  interviewId: string
  workspaceId: string
  turnId: string
  transcript: TurnTranscript[]
  traceCtx?: TraceCtx
}): Promise<RawExtraction[]> {
  if (transcript.length === 0) return []

  const supabase = getSupabaseAdmin()

  // ── LLM Extraction ──────────────────────────────────────────────────────────
  let extractions: RawExtraction[] = []
  try {
    const { text } = await generateText({
      model: resolveModel(process.env.EXTRACTION_MODEL),
      system: EXTRACTION_SYSTEM_PROMPT,
      prompt: buildExtractionPrompt(transcript),
      maxOutputTokens: 2000,
      experimental_telemetry: buildTraceMetadata('extraction.extractAndEmbed', {
        interviewId,
        model: process.env.EXTRACTION_MODEL ?? 'google/gemini-3.1-flash-lite',
        environment: 'prod',
        ...traceCtx,
      }),
    })

    const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) throw new Error('Response is not an array')
    extractions = parsed
  } catch (err) {
    console.error('[extraction] LLM extraction failed:', err)
    return []
  }

  if (extractions.length === 0) return []

  // ── Embed + Insert each object ───────────────────────────────────────────────
  const inserted: RawExtraction[] = []
  for (const item of extractions) {
    if (!item.type || !item.content || !item.source_quote) {
      console.error('[extraction] Skipping malformed object:', item)
      continue
    }

    if (!ALLOWED_TYPES.includes(item.type)) {
      console.error('[extraction] Invalid type, skipping:', item.type)
      continue
    }

    const embeddingInput = `${item.type}: ${JSON.stringify(item.content)}`
    const embedding = await generateEmbedding(embeddingInput, traceCtx ?? { interviewId })

    const { error } = await supabase.from('knowledge_objects').insert({
      interview_id: interviewId,
      workspace_id: workspaceId,
      type: item.type,
      content: item.content,
      source_quote: item.source_quote,
      turn_id: turnId,
      embedding: embedding as number[],
    })

    if (error) {
      console.error('[extraction] DB insert failed:', error.message)
    } else {
      inserted.push(item)
    }
  }
  return inserted
}

// D13/ADR-006: Workspace-level deduplication of process_step knowledge objects.
// Run async after interview completion. Merges objects with cosine similarity > 0.92
// and the same role into the older entry; increments existing_count on the survivor.
const DEDUP_THRESHOLD = 0.92

export async function deduplicateKnowledgeObjects(workspaceId: string): Promise<void> {
  const supabase = getSupabaseAdmin()

  const { data: objects, error } = await supabase
    .from('knowledge_objects')
    .select('id, content, embedding, existing_count')
    .eq('workspace_id', workspaceId)
    .eq('type', 'process_step')
    .not('embedding', 'is', null)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[dedup] fetch failed:', error.message)
    return
  }
  if (!objects || objects.length < 2) return

  type KORow = { id: string; content: Record<string, unknown>; embedding: number[]; existing_count: number }
  const rows = objects as unknown as KORow[]

  const toDelete = new Set<string>()
  const countUpdates = new Map<string, number>()

  for (let i = 0; i < rows.length; i++) {
    if (toDelete.has(rows[i].id)) continue
    const roleI = rows[i].content?.role as string | undefined

    for (let j = i + 1; j < rows.length; j++) {
      if (toDelete.has(rows[j].id)) continue
      const roleJ = rows[j].content?.role as string | undefined

      if (roleI !== roleJ) continue

      const sim = cosineSim(rows[i].embedding, rows[j].embedding)
      if (sim < DEDUP_THRESHOLD) continue

      toDelete.add(rows[j].id)
      const merged = (countUpdates.get(rows[i].id) ?? rows[i].existing_count) + rows[j].existing_count
      countUpdates.set(rows[i].id, merged)
    }
  }

  if (toDelete.size === 0) return

  // Update existing_count + last_seen_at on survivors
  for (const [id, existing_count] of countUpdates) {
    const { error: upErr } = await supabase
      .from('knowledge_objects')
      .update({ existing_count, last_seen_at: new Date().toISOString() })
      .eq('id', id)
    if (upErr) console.error('[dedup] update failed:', upErr.message)
  }

  // Delete duplicate objects
  const { error: delErr } = await supabase
    .from('knowledge_objects')
    .delete()
    .in('id', [...toDelete])
  if (delErr) console.error('[dedup] delete failed:', delErr.message)
  else console.info(`[dedup] removed ${toDelete.size} duplicate(s) in workspace ${workspaceId}`)
}

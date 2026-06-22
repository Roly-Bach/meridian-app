import { generateText } from 'ai'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateEmbedding } from './embeddings'
import { resolveModel } from '@/lib/llm-provider'
import { cosineSim } from './processClustering'
import { buildTraceMetadata, type TraceCtx } from './_telemetry'

export type KnowledgeObjectType = 'process_step' | 'pain_point' | 'tool'

const ALLOWED_TYPES: readonly KnowledgeObjectType[] = ['pain_point', 'tool']

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

Extrahiere ausschließlich diese 2 Typen:
- pain_point: Ein Problem, Engpass oder eine Frustration. Content: { description: string, severity?: "high"|"medium"|"low" }
- tool: Ein verwendetes Tool, System oder Software. Content: { name: string, purpose: string }

Regeln:
- source_quote MUSS ein wörtliches Zitat aus dem user_input sein — kein Paraphrasieren
- Extrahiere NUR aus dem übergebenen user_input
- Wenn nichts Relevantes steht, gib ein leeres Array zurück
- Antworte ausschließlich mit validem JSON — kein erklärender Text davor oder danach

Ausgabeformat:
[
  {
    "type": "pain_point",
    "content": { "description": "...", "severity": "high" },
    "source_quote": "exaktes Zitat aus user_input"
  },
  {
    "type": "tool",
    "content": { "name": "...", "purpose": "..." },
    "source_quote": "exaktes Zitat aus user_input"
  }
]`

function buildExtractionPrompt(transcript: TurnTranscript[]): string {
  const lastTurn = transcript[transcript.length - 1]
  return `Mitarbeiter: ${lastTurn.user_input}`
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
  const extractionParams = {
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
  }

  function parseExtractionText(text: string): RawExtraction[] {
    const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) throw new Error('Response is not an array')
    return parsed as RawExtraction[]
  }

  try {
    const { text } = await generateText(extractionParams)
    extractions = parseExtractionText(text)
  } catch (firstErr) {
    console.error('[extraction] LLM extraction failed (attempt 1):', firstErr)
    // Retry once with explicit JSON-only instruction appended to prompt
    try {
      const { text: retryText } = await generateText({
        ...extractionParams,
        prompt: buildExtractionPrompt(transcript) + '\n\nWICHTIG: Antworte NUR mit dem JSON-Array. Beginne direkt mit [',
      })
      extractions = parseExtractionText(retryText)
      console.log('[extraction] retry succeeded')
    } catch (retryErr) {
      console.error('[extraction] LLM extraction failed (attempt 2):', retryErr)
      return []
    }
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

// D13/ADR-006: Workspace-level deduplication of knowledge objects.
// Run async after interview completion. Merges objects with cosine similarity > 0.92
// and matching dedup-text into the older entry; increments existing_count on the survivor.
// KI-2: originally pain_point-only (hardcoded .eq('type', 'pain_point') + content.description) —
// tool-type objects were never deduped, leaving multiple records per distinct tool. Generalized
// to run per ALLOWED_TYPES with a type-aware text field.
const DEDUP_THRESHOLD = 0.92

export function levenshtein(a: string, b: string): number {
  const dp = Array.from({length: a.length + 1}, (_, i) =>
    Array.from({length: b.length + 1}, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  )
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[a.length][b.length]
}

// pain_point content: { description, severity? } — tool content: { name, purpose }.
function dedupText(type: KnowledgeObjectType, content: Record<string, unknown>): string {
  const field = type === 'tool' ? 'name' : 'description'
  return (content?.[field] as string | undefined) ?? ''
}

async function deduplicateByType(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  workspaceId: string,
  type: KnowledgeObjectType,
): Promise<void> {
  const { data: objects, error } = await supabase
    .from('knowledge_objects')
    .select('id, content, embedding, existing_count')
    .eq('workspace_id', workspaceId)
    .eq('type', type)
    .not('embedding', 'is', null)
    .order('created_at', { ascending: true })

  if (error) {
    console.error(`[dedup] fetch failed (type=${type}):`, error.message)
    return
  }
  if (!objects || objects.length < 2) return

  type KORow = { id: string; content: Record<string, unknown>; embedding: number[]; existing_count: number }
  const rows = objects as unknown as KORow[]

  const toDelete = new Set<string>()
  const countUpdates = new Map<string, number>()

  for (let i = 0; i < rows.length; i++) {
    if (toDelete.has(rows[i].id)) continue

    for (let j = i + 1; j < rows.length; j++) {
      if (toDelete.has(rows[j].id)) continue

      const sim = cosineSim(rows[i].embedding, rows[j].embedding)
      if (sim < DEDUP_THRESHOLD) continue

      const textI = dedupText(type, rows[i].content)
      const textJ = dedupText(type, rows[j].content)
      if (levenshtein(textI.toLowerCase(), textJ.toLowerCase()) > 8) continue

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
  else console.info(`[dedup] removed ${toDelete.size} duplicate(s) of type=${type} in workspace ${workspaceId}`)
}

export async function deduplicateKnowledgeObjects(workspaceId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  for (const type of ALLOWED_TYPES) {
    await deduplicateByType(supabase, workspaceId, type)
  }
}

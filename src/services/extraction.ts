import { generateText } from 'ai'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateEmbedding } from './embeddings'
import { resolveModel } from '@/lib/llm-provider'

export type KnowledgeObjectType = 'process_step' | 'pain_point' | 'tool' | 'role'

const ALLOWED_TYPES: readonly KnowledgeObjectType[] = ['process_step', 'pain_point', 'tool', 'role']

interface RawExtraction {
  type: KnowledgeObjectType
  content: Record<string, unknown>
  source_quote: string
}

interface TurnTranscript {
  user_input: string
  agent_response: string
}

const EXTRACTION_SYSTEM_PROMPT = `Du bist ein Extraktions-Agent für Meridian. Deine Aufgabe: Extrahiere strukturiertes Wissen aus Interview-Transkripten.

Extrahiere ausschließlich diese 4 Typen:
- process_step: Ein konkreter Prozessschritt oder Arbeitsablauf. Content: { title: string, description: string, role: string }
- pain_point: Ein Problem, Engpass oder eine Frustration. Content: { description: string, severity?: "high"|"medium"|"low" }
- tool: Ein verwendetes Tool, System oder Software. Content: { name: string, purpose: string }
- role: Eine genannte Rolle oder Verantwortlichkeit. Content: { title: string, responsibilities: string }

Regeln:
- source_quote MUSS ein wörtliches Zitat aus dem user_input sein — kein Paraphrasieren
- Extrahiere NUR aus dem LETZTEN user_input, nicht aus vorherigen Turns
- Wenn nichts Relevantes im letzten Turn steht, gib ein leeres Array zurück
- Antworte ausschließlich mit validem JSON — kein erklärender Text davor oder danach

Ausgabeformat:
[
  {
    "type": "process_step",
    "content": { "title": "...", "description": "...", "role": "..." },
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
}: {
  interviewId: string
  workspaceId: string
  turnId: string
  transcript: TurnTranscript[]
}): Promise<void> {
  if (transcript.length === 0) return

  const supabase = getSupabaseAdmin()

  // ── LLM Extraction ──────────────────────────────────────────────────────────
  let extractions: RawExtraction[] = []
  try {
    const { text } = await generateText({
      model: resolveModel(process.env.EXTRACTION_MODEL),
      system: EXTRACTION_SYSTEM_PROMPT,
      prompt: buildExtractionPrompt(transcript),
      maxOutputTokens: 2000,
    })

    const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) throw new Error('Response is not an array')
    extractions = parsed
  } catch (err) {
    console.error('[extraction] LLM extraction failed:', err)
    return
  }

  if (extractions.length === 0) return

  // ── Embed + Insert each object ───────────────────────────────────────────────
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
    const embedding = await generateEmbedding(embeddingInput)

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
    }
  }
}

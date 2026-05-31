import { generateText } from 'ai'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveModel } from '@/lib/llm-provider'

const SIMILARITY_THRESHOLD = parseFloat(
  process.env.CLUSTER_SIMILARITY_THRESHOLD ?? '0.85'
)

export function cosineSim(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

interface ProcessStepRow {
  id: string
  title: string
  description: string | null
  role: string | null
  embedding: number[] | null
  interview_id: string
  interviews: {
    employee_name: string
    employee_role: string | null
  } | null
}

interface ClusterRow {
  id: string
  canonical_title: string
  canonical_description: string | null
  participant_count: number
  participants: Array<{
    interview_id: string
    employee_name: string
    employee_role: string | null
    process_step_id: string
  }>
  representative_embedding: number[] | null
}

interface ProcessStepForSynthesis {
  title: string
  description: string | null
  source_quote: string | null
  frequency_per_month: number | null
  duration_minutes: number | null
  data_sources: string[] | null
  rule_based: boolean | null
  interviews: { employee_name: string; employee_role: string | null } | null
}

async function synthesizeCluster(clusterId: string): Promise<void> {
  const supabase = getSupabaseAdmin()

  const { data: stepsRaw, error } = await supabase
    .from('process_steps')
    .select('title, description, source_quote, frequency_per_month, duration_minutes, data_sources, rule_based, interviews(employee_name, employee_role)')
    .eq('cluster_id', clusterId)

  if (error || !stepsRaw || stepsRaw.length < 2) return

  const steps = stepsRaw as unknown as ProcessStepForSynthesis[]

  const participantSections = steps
    .map((s) => {
      const info = Array.isArray(s.interviews) ? s.interviews[0] : s.interviews
      const name = info?.employee_name ?? 'Unbekannt'
      const role = info?.employee_role ?? 'Unbekannte Rolle'
      const parts = [`**${name} (${role})**`]
      if (s.description) parts.push(`Beschreibung: ${s.description}`)
      if (s.duration_minutes) parts.push(`Dauer: ${s.duration_minutes} Minuten`)
      if (s.frequency_per_month) parts.push(`Häufigkeit: ${s.frequency_per_month}× pro Monat`)
      if (s.data_sources?.length) parts.push(`Tools/Systeme: ${s.data_sources.join(', ')}`)
      if (s.source_quote) parts.push(`Originalzitat: "${s.source_quote}"`)
      return parts.join('\n')
    })
    .join('\n\n---\n\n')

  const prompt = `Vergleiche folgende Beschreibungen desselben Prozessschritts von verschiedenen Mitarbeitern:\n\n${participantSections}\n\nSchreibe eine strukturierte Zusammenfassung auf Deutsch mit:\n1. Gemeinsamkeiten: Was alle Teilnehmer ähnlich beschreiben\n2. Abweichungen: Unterschiede in Dauer, Tools oder Vorgehen\n3. Mögliche Ursachen: Warum gibt es Unterschiede? (z.B. Rolle, Erfahrung, Abteilung, Workarounds)`

  try {
    const { text } = await generateText({
      model: resolveModel(process.env.ENRICHMENT_MODEL),
      prompt,
      maxOutputTokens: 600,
    })

    const { error: updateErr } = await supabase
      .from('process_clusters')
      .update({ canonical_description: text.trim() })
      .eq('id', clusterId)

    if (updateErr) {
      console.error('[processClustering] synthesizeCluster update failed:', updateErr.message)
    }
  } catch (err) {
    console.error('[processClustering] synthesizeCluster LLM failed:', err)
  }
}

export async function clusterProcessSteps(workspaceId: string): Promise<void> {
  const supabase = getSupabaseAdmin()

  // Load unclustered process_steps with embeddings for this workspace
  const { data: unclusteredRaw, error: fetchErr } = await supabase
    .from('process_steps')
    .select('id, title, description, role, embedding, interview_id, interviews(employee_name, employee_role)')
    .eq('workspace_id', workspaceId)
    .is('cluster_id', null)
    .not('embedding', 'is', null)

  if (fetchErr) {
    console.error('[processClustering] Failed to fetch unclustered steps:', fetchErr.message)
    return
  }
  const unclustered = (unclusteredRaw ?? []) as unknown as ProcessStepRow[]
  if (unclustered.length === 0) return

  // Work with a local map so newly created clusters are visible for participant updates within this run
  const clusterParticipants = new Map<string, { count: number; participants: ClusterRow['participants'] }>()

  for (const step of unclustered) {
    if (!step.embedding) continue

    const interviewInfo = Array.isArray(step.interviews) ? step.interviews[0] : step.interviews
    const participantEntry = {
      interview_id: step.interview_id,
      employee_name: interviewInfo?.employee_name ?? 'Unbekannt',
      employee_role: interviewInfo?.employee_role ?? null,
      process_step_id: step.id,
    }

    // Find best matching cluster via pgvector index
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: matchRows, error: rpcErr } = await (supabase as any).rpc('match_process_cluster', {
      query_embedding: step.embedding,
      workspace_id: workspaceId,
      similarity_threshold: SIMILARITY_THRESHOLD,
    })

    if (rpcErr) {
      console.error('[processClustering] RPC match_process_cluster failed:', rpcErr.message)
      continue
    }

    const bestMatch = (matchRows as Array<{ cluster_id: string; similarity: number }> | null)?.[0] ?? null

    if (bestMatch) {
      const clusterId = bestMatch.cluster_id
      const local = clusterParticipants.get(clusterId)

      let updatedParticipants: ClusterRow['participants']
      let updatedCount: number

      if (local) {
        updatedParticipants = [...local.participants, participantEntry]
        updatedCount = local.count + 1
      } else {
        const { data: clusterRow, error: fetchErr } = await supabase
          .from('process_clusters')
          .select('participant_count, participants')
          .eq('id', clusterId)
          .single()

        if (fetchErr || !clusterRow) {
          console.error('[processClustering] Failed to fetch cluster for update:', fetchErr?.message)
          continue
        }
        updatedParticipants = [...(clusterRow.participants as ClusterRow['participants']), participantEntry]
        updatedCount = (clusterRow.participant_count as number) + 1
      }

      const { error: updateErr } = await supabase
        .from('process_clusters')
        .update({ participant_count: updatedCount, participants: updatedParticipants })
        .eq('id', clusterId)

      if (updateErr) {
        console.error('[processClustering] Cluster update failed:', updateErr.message)
        continue
      }

      clusterParticipants.set(clusterId, { count: updatedCount, participants: updatedParticipants })

      const { error: linkErr } = await supabase
        .from('process_steps')
        .update({ cluster_id: clusterId })
        .eq('id', step.id)
      if (linkErr) {
        console.error('[processClustering] Step link failed:', linkErr.message, 'step:', step.id)
      }

    } else {
      // Create new cluster — this step is the representative
      const { data: newCluster, error: insertErr } = await supabase
        .from('process_clusters')
        .insert({
          workspace_id: workspaceId,
          canonical_title: step.title,
          canonical_description: step.description,
          participant_count: 1,
          participants: [participantEntry],
          representative_embedding: step.embedding,
        })
        .select('id, canonical_title, canonical_description, participant_count, participants, representative_embedding')
        .single()

      if (insertErr || !newCluster) {
        console.error('[processClustering] Cluster insert failed:', insertErr?.message)
        continue
      }

      clusterParticipants.set(newCluster.id, { count: 1, participants: [participantEntry] })

      // Link step to new cluster
      const { error: linkErr } = await supabase
        .from('process_steps')
        .update({ cluster_id: newCluster.id })
        .eq('id', step.id)
      if (linkErr) {
        console.error('[processClustering] Step link failed:', linkErr.message, 'step:', step.id)
      }
    }
  }

  // Fire-and-forget synthesis for any cluster that reached ≥2 participants this run
  for (const [clusterId, { count }] of clusterParticipants.entries()) {
    if (count >= 2) {
      void synthesizeCluster(clusterId)
    }
  }
}

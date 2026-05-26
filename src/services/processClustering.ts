import { getSupabaseAdmin } from '@/lib/supabase-admin'

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

  // Load existing clusters for this workspace
  const { data: existingClusters, error: clusterErr } = await supabase
    .from('process_clusters')
    .select('id, canonical_title, canonical_description, participant_count, participants, representative_embedding')
    .eq('workspace_id', workspaceId)

  if (clusterErr) {
    console.error('[processClustering] Failed to fetch clusters:', clusterErr.message)
    return
  }

  // Work with a mutable copy so newly created clusters are visible within this run
  const clusters: ClusterRow[] = (existingClusters ?? []) as unknown as ClusterRow[]

  for (const step of unclustered) {
    if (!step.embedding) continue

    const interviewInfo = Array.isArray(step.interviews) ? step.interviews[0] : step.interviews
    const participantEntry = {
      interview_id: step.interview_id,
      employee_name: interviewInfo?.employee_name ?? 'Unbekannt',
      employee_role: interviewInfo?.employee_role ?? null,
      process_step_id: step.id,
    }

    // Find best matching cluster
    let bestCluster: ClusterRow | null = null
    let bestSim = 0

    for (const cluster of clusters) {
      if (!cluster.representative_embedding) continue
      const sim = cosineSim(step.embedding, cluster.representative_embedding)
      if (sim > bestSim) {
        bestSim = sim
        bestCluster = cluster
      }
    }

    if (bestCluster && bestSim >= SIMILARITY_THRESHOLD) {
      // Extend existing cluster
      const updatedParticipants = [...bestCluster.participants, participantEntry]
      const updatedCount = bestCluster.participant_count + 1

      const { error: updateErr } = await supabase
        .from('process_clusters')
        .update({
          participant_count: updatedCount,
          participants: updatedParticipants,
        })
        .eq('id', bestCluster.id)

      if (updateErr) {
        console.error('[processClustering] Cluster update failed:', updateErr.message)
        continue
      }

      // Update local state
      bestCluster.participant_count = updatedCount
      bestCluster.participants = updatedParticipants

      // Link step to cluster
      const { error: linkErr } = await supabase
        .from('process_steps')
        .update({ cluster_id: bestCluster.id })
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

      clusters.push(newCluster as ClusterRow)

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
}

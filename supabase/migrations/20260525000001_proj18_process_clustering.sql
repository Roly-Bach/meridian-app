-- ============================================================================
-- Migration: PROJ-18 Prozessschritt-Deduplication (Semantic Clustering)
-- Adds process_clusters table + cluster_id / embedding to process_steps
-- Date: 2026-05-25
-- ============================================================================

-- One canonical process per workspace, groups semantically similar process_steps
CREATE TABLE process_clusters (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  canonical_title         text NOT NULL,
  canonical_description   text,
  participant_count       integer NOT NULL DEFAULT 1,
  -- [{interview_id, employee_name, employee_role, process_step_id}]
  participants            jsonb NOT NULL DEFAULT '[]'::jsonb,
  representative_embedding vector(1024),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_process_clusters_workspace ON process_clusters (workspace_id);
CREATE INDEX idx_process_clusters_embedding
  ON process_clusters USING hnsw (representative_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ALTER TABLE process_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_select" ON process_clusters
  FOR SELECT USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_insert" ON process_clusters
  FOR INSERT WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_update" ON process_clusters
  FOR UPDATE USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- Link process_steps to their canonical cluster (nullable until clustered)
ALTER TABLE process_steps ADD COLUMN cluster_id uuid REFERENCES process_clusters(id) ON DELETE SET NULL;
ALTER TABLE process_steps ADD COLUMN embedding vector(1024);

CREATE INDEX idx_process_steps_cluster ON process_steps (cluster_id);

-- updated_at trigger for process_clusters
CREATE TRIGGER process_clusters_updated_at
  BEFORE UPDATE ON process_clusters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

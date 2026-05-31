-- PROJ-24: Cluster-aware Use Case Generation — schema changes
-- 1. process_step_id is now nullable: cluster-level use cases have no individual step
-- 2. cluster_id FK: links cluster UCs to their process_cluster
-- 3. roi_breakdown JSONB: structured ROI data for detail view (freq, duration, rate, etc.)
-- 4. llm_insights JSONB: lazy-cached KI analysis (generated on first detail open, cached forever)

-- Make process_step_id nullable (cluster UCs have process_step_id = null)
ALTER TABLE use_cases ALTER COLUMN process_step_id DROP NOT NULL;

-- Add new columns
ALTER TABLE use_cases
  ADD COLUMN cluster_id   uuid   REFERENCES process_clusters(id) ON DELETE SET NULL,
  ADD COLUMN roi_breakdown jsonb,
  ADD COLUMN llm_insights  jsonb;

-- Index for detail endpoint lookups by cluster
CREATE INDEX idx_use_cases_cluster_id ON use_cases(cluster_id);

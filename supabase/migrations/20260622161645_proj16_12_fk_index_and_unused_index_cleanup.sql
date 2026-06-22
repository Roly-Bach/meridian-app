-- Missing covering index for knowledge_objects.turn_id_fkey
CREATE INDEX idx_knowledge_objects_turn ON knowledge_objects(turn_id);

-- Unused indexes (current advisor snapshot 2026-06-22) — dropped per spec default.
-- Cheap to recreate later if a query pattern needs them (MVP data volume).
DROP INDEX IF EXISTS idx_knowledge_objects_embedding;
DROP INDEX IF EXISTS idx_process_clusters_embedding;
DROP INDEX IF EXISTS idx_interviews_analyst_status;
DROP INDEX IF EXISTS idx_interviews_extractions;

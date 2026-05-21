-- ============================================================================
-- Migration: PROJ-14 Embedding-Modell Auswahl
-- Changes vector dimension from 1536 (OpenAI) to 1024 (jina-embeddings-v3)
-- Switches index from IVFFlat to HNSW (better accuracy at MVP data volumes)
-- Safe: knowledge_objects table is empty at time of migration
-- Date: 2026-05-21
-- ============================================================================

-- Drop old IVFFlat index (tied to old dimension + algorithm)
DROP INDEX IF EXISTS idx_knowledge_objects_embedding;

-- Change vector dimension: 1536 → 1024
ALTER TABLE knowledge_objects
  ALTER COLUMN embedding TYPE vector(1024);

-- Create HNSW index (better than IVFFlat for <1M rows; no minimum row count needed)
CREATE INDEX idx_knowledge_objects_embedding
  ON knowledge_objects
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

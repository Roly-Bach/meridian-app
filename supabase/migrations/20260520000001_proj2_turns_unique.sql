-- ============================================================================
-- Migration: PROJ-2 Patch — turns unique constraint + workspace index
-- Date: 2026-05-20
-- ============================================================================

-- Idempotent unique constraint via CREATE UNIQUE INDEX
CREATE UNIQUE INDEX IF NOT EXISTS turns_interview_turn_unique
  ON turns (interview_id, turn_number);

-- Idempotent index for workspace query
CREATE INDEX IF NOT EXISTS idx_interviews_workspace_created_at
  ON interviews(workspace_id, created_at DESC);

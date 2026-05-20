-- ============================================================================
-- Migration: PROJ-2 Patch — turns unique constraint + workspace index
-- Date: 2026-05-20
-- ============================================================================

-- Prevent duplicate turn_number per interview (race condition guard)
ALTER TABLE turns
  ADD CONSTRAINT turns_interview_turn_unique UNIQUE (interview_id, turn_number);

-- Index to speed up workspace-scoped interview list queries
CREATE INDEX idx_interviews_workspace_created_at ON interviews(workspace_id, created_at DESC);

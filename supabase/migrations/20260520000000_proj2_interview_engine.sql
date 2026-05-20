-- ============================================================================
-- Migration: PROJ-2 Interview Engine Backend
-- Extends interviews table for token-based access + agent state
-- Date: 2026-05-20
-- ============================================================================

-- ============================================================================
-- Step 1: Update interviews.status constraint
-- Old: ('active', 'completed', 'abandoned') DEFAULT 'active'
-- New: ('created', 'active', 'completed') DEFAULT 'created'
-- ============================================================================

ALTER TABLE interviews DROP CONSTRAINT interviews_status_check;

UPDATE interviews SET status = 'completed' WHERE status = 'abandoned';

ALTER TABLE interviews
  ALTER COLUMN status SET DEFAULT 'created',
  ADD CONSTRAINT interviews_status_check
    CHECK (status IN ('created', 'active', 'completed'));

-- ============================================================================
-- Step 2: Update interview_state.phase constraint
-- Old: ('intro', 'process_discovery', 'deep_dive', 'wrap_up', 'completed')
-- New: ('intro', 'exploration', 'deepdive', 'wrap_up')
-- ============================================================================

ALTER TABLE interview_state DROP CONSTRAINT interview_state_phase_check;

UPDATE interview_state SET phase = 'exploration' WHERE phase IN ('process_discovery', 'completed');
UPDATE interview_state SET phase = 'deepdive'    WHERE phase = 'deep_dive';

ALTER TABLE interview_state
  ADD CONSTRAINT interview_state_phase_check
    CHECK (phase IN ('intro', 'exploration', 'deepdive', 'wrap_up'));

-- ============================================================================
-- Step 3: Add new columns to interviews
-- ============================================================================

ALTER TABLE interviews
  ADD COLUMN department         text,
  ADD COLUMN focus_topics       text,
  ADD COLUMN access_token       text,
  ADD COLUMN token_expires_at   timestamptz,
  ADD COLUMN extractions_pending boolean NOT NULL DEFAULT false;

-- Backfill existing rows
UPDATE interviews
SET
  department       = '',
  access_token     = gen_random_uuid()::text,
  token_expires_at = created_at + interval '30 days'
WHERE access_token IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE interviews
  ALTER COLUMN department     SET NOT NULL,
  ALTER COLUMN access_token   SET NOT NULL,
  ALTER COLUMN token_expires_at SET NOT NULL;

-- Unique constraint on access_token
ALTER TABLE interviews
  ADD CONSTRAINT interviews_access_token_key UNIQUE (access_token);

-- ============================================================================
-- Step 4: Indexes
-- ============================================================================

CREATE INDEX idx_interviews_access_token ON interviews(access_token);
CREATE INDEX idx_interviews_extractions   ON interviews(extractions_pending) WHERE extractions_pending = true;

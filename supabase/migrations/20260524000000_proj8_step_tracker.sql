-- ============================================================================
-- Migration: PROJ-8 Interview Design Re-Architektur
-- Adds step_tracker JSONB to interview_state, updates phase constraint
-- Date: 2026-05-24
-- ============================================================================

-- ============================================================================
-- Step 1: Add step_tracker column
-- Schema: Array of { title, role?, status, slots: { slot_name: { value, quote } | null } }
-- ============================================================================

ALTER TABLE interview_state
  ADD COLUMN step_tracker JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ============================================================================
-- Step 2: Update phase constraint
-- Old: intro | exploration | deepdive | wrap_up
-- New: intro | process_loop | coverage_check | wrap_up
-- ============================================================================

ALTER TABLE interview_state DROP CONSTRAINT interview_state_phase_check;

-- Backfill: map old intermediate phases to process_loop
UPDATE interview_state
  SET phase = 'process_loop'
  WHERE phase IN ('exploration', 'deepdive');

ALTER TABLE interview_state
  ADD CONSTRAINT interview_state_phase_check
    CHECK (phase IN ('intro', 'process_loop', 'coverage_check', 'wrap_up'));

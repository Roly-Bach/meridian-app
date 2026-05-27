-- ============================================================================
-- Migration: ADR-008 — Phase-Enum erweitern (walkthrough_step, slot_completion)
-- Date: 2026-05-27
-- ============================================================================

-- Bestehenden Constraint entfernen
ALTER TABLE interview_state DROP CONSTRAINT interview_state_phase_check;

-- Backfill: quantify_step (falls noch in alten Rows) → walkthrough_step
UPDATE interview_state
  SET phase = 'walkthrough_step'
  WHERE phase = 'quantify_step';

-- Backfill: step_tracker JSONB — status 'quantifying' → 'walkthrough'
UPDATE interview_state
  SET step_tracker = (
    SELECT jsonb_agg(
      CASE WHEN elem->>'status' = 'quantifying'
           THEN jsonb_set(elem, '{status}', '"walkthrough"')
           ELSE elem
      END
    )
    FROM jsonb_array_elements(step_tracker) AS elem
  )
  WHERE step_tracker IS NOT NULL
    AND step_tracker != '[]'::jsonb
    AND step_tracker @> '[{"status":"quantifying"}]'::jsonb;

-- Neuen Constraint mit erweiterten Phasen setzen
ALTER TABLE interview_state
  ADD CONSTRAINT interview_state_phase_check
    CHECK (phase IN ('intro', 'process_loop', 'walkthrough_step', 'slot_completion', 'coverage_check', 'wrap_up'));

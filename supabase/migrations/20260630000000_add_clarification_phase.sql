-- Add 'clarification' to the interview_state phase check constraint.
-- PROJ-23 introduced the clarification phase but the 20260529 migration assumed
-- no constraint existed. PGlite (which replays all migrations fresh) hit the
-- violation; Supabase prod may already have the constraint dropped or updated.

ALTER TABLE interview_state DROP CONSTRAINT IF EXISTS interview_state_phase_check;
ALTER TABLE interview_state
  ADD CONSTRAINT interview_state_phase_check
    CHECK (phase IN ('intro', 'process_loop', 'walkthrough_step', 'slot_completion', 'coverage_check', 'wrap_up', 'clarification'));

-- PROJ-42: Collapse interview_state.phase to a 3-phase model (intro/explore/closing),
-- keeping 'clarification' as-is (unchanged mechanism from PROJ-23).
-- Remaps existing rows first, then narrows the check constraint:
--   process_loop / walkthrough_step / slot_completion / coverage_check -> explore
--   wrap_up -> closing
--   intro / clarification -> unchanged

ALTER TABLE interview_state DROP CONSTRAINT IF EXISTS interview_state_phase_check;

UPDATE interview_state
SET phase = CASE phase
  WHEN 'process_loop' THEN 'explore'
  WHEN 'walkthrough_step' THEN 'explore'
  WHEN 'slot_completion' THEN 'explore'
  WHEN 'coverage_check' THEN 'explore'
  WHEN 'wrap_up' THEN 'closing'
  ELSE phase
END
WHERE phase IN ('process_loop', 'walkthrough_step', 'slot_completion', 'coverage_check', 'wrap_up');

ALTER TABLE interview_state
  ADD CONSTRAINT interview_state_phase_check
    CHECK (phase IN ('intro', 'explore', 'closing', 'clarification'));

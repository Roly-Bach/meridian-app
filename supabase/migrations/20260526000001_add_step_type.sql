-- PROJ-3: Add step_type and condition_text to process_steps
-- Enables visual process flow with decision diamonds in the detail view.
-- step_type = 'decision' when a step describes a conditional branching ("wenn X dann Y sonst Z")
-- condition_text captures the branching condition as prose text

ALTER TABLE process_steps
  ADD COLUMN step_type text NOT NULL DEFAULT 'action'
    CHECK (step_type IN ('action', 'decision')),
  ADD COLUMN condition_text text;

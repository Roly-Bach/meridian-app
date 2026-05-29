-- Iteration 3 (PROJ-22 ADR-011): Add Analyst state columns to interviews table.
-- analyst_status tracks the background Analyst run lifecycle.
-- next_briefing stores the Analyst's prepared briefing for the next Talker turn.
-- clarification_answers stores PROJ-21 clarification card responses (basis for PROJ-21).

ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS analyst_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS next_briefing jsonb,
  ADD COLUMN IF NOT EXISTS clarification_answers jsonb;

-- Allow the 'clarification' phase value in interview_state
-- (The phase column is text; ensure 'clarification' is accepted.)
-- No constraint change needed if phase is plain text (no CHECK constraint on phase).

-- Index for quick status checks in Orchestrator hot path (read every turn)
CREATE INDEX IF NOT EXISTS idx_interviews_analyst_status ON interviews(analyst_status)
  WHERE analyst_status IN ('processing', 'failed');

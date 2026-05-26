-- Add substeps JSONB column to process_steps
-- Stores LLM-generated atomic sub-steps for each process step.
-- Generated on-demand (first sheet open), cached for subsequent views.
-- Structure: [{ id, title, step_type, condition_text?, branch_yes?, branch_no?, order }]

ALTER TABLE process_steps
  ADD COLUMN substeps JSONB DEFAULT NULL;

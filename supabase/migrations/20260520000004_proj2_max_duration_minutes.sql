-- Add max_duration_minutes to interviews
-- Allowed values: 10 (test mode), 30 (standard). Default 30.
ALTER TABLE interviews
  ADD COLUMN max_duration_minutes integer NOT NULL DEFAULT 30;

ALTER TABLE interviews
  ADD CONSTRAINT interviews_max_duration_check
  CHECK (max_duration_minutes IN (10, 30));

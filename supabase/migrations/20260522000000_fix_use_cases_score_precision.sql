-- Fix: use_cases.score column overflow
-- score = roi_eur_per_year / effort_factor → can exceed 999.99 (numeric(5,2) limit)
-- Also widen roi columns for safety

ALTER TABLE use_cases
  ALTER COLUMN score           TYPE numeric(12,2),
  ALTER COLUMN roi_eur_per_year TYPE numeric(12,2),
  ALTER COLUMN roi_hours_per_year TYPE numeric(10,2);

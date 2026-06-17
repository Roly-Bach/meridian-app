-- PROJ-25: Prozesswissens-Schema (O1–O5 + Governance)
-- Migrates step_tracker JSONB in interview_state from flat-slots to
-- potenzial + tazite + governance layout.
--
-- Changes per step entry:
--   slots.frequency_per_month → potenzial.frequency_per_month
--   slots.duration_minutes    → potenzial.duration_minutes
--   slots.error_rate_percent  → potenzial.error_rate_percent
--   slots.media_breaks        → potenzial.media_breaks
--   slots.rule_based          → slots.entscheidungslogik
--                                  (value: "rule_based: <value>")
--   slots.data_sources        → slots.hilfsmittel
--   role (top-level)          → governance.rolle
--   reihenfolge               → set from 1-based array index if missing
--
-- DOWN: see bottom of file.
-- Safe to apply twice (idempotent via is_legacy check).

BEGIN;

UPDATE interview_state
SET step_tracker = (
  SELECT jsonb_agg(migrated_step ORDER BY idx)
  FROM (
    SELECT
      idx,
      -- Detect legacy entry: has no potenzial but has old slot keys
      (step->>'potenzial' IS NULL AND (
        step->'slots' ? 'frequency_per_month' OR
        step->'slots' ? 'duration_minutes'    OR
        step->'slots' ? 'rule_based'          OR
        step->'slots' ? 'data_sources'        OR
        step->'slots' ? 'error_rate_percent'  OR
        step->'slots' ? 'media_breaks'
      )) AS is_legacy,
      step,
      CASE
        WHEN (step->>'potenzial' IS NULL AND (
          step->'slots' ? 'frequency_per_month' OR
          step->'slots' ? 'duration_minutes'    OR
          step->'slots' ? 'rule_based'          OR
          step->'slots' ? 'data_sources'        OR
          step->'slots' ? 'error_rate_percent'  OR
          step->'slots' ? 'media_breaks'
        )) THEN
          -- Build migrated step
          jsonb_build_object(
            'title',         step->>'title',
            'reihenfolge',   COALESCE((step->>'reihenfolge')::int, idx),
            'governance',    CASE
                               WHEN step->>'role' IS NOT NULL THEN
                                 jsonb_build_object(
                                   'rolle',              step->>'role',
                                   'organisationseinheit', NULL,
                                   'systeme',            NULL,
                                   'nicht_befund_typ',   NULL
                                 )
                               ELSE step->'governance'
                             END,
            'abhaengigkeiten', step->'abhaengigkeiten',
            'potenzial',     jsonb_build_object(
                               'frequency_per_month', step->'slots'->'frequency_per_month',
                               'duration_minutes',    step->'slots'->'duration_minutes',
                               'error_rate_percent',  step->'slots'->'error_rate_percent',
                               'media_breaks',        step->'slots'->'media_breaks'
                             ),
            'status',        step->>'status',
            'slots',         jsonb_build_object(
                               'entscheidungslogik', CASE
                                 WHEN step->'slots'->'rule_based' IS NOT NULL THEN
                                   jsonb_build_object(
                                     'value',           'rule_based: ' || (step->'slots'->'rule_based'->>'value'),
                                     'quote',           step->'slots'->'rule_based'->>'quote',
                                     'confidence',      step->'slots'->'rule_based'->>'confidence',
                                     'nicht_befund_typ', NULL
                                   )
                                 ELSE step->'slots'->'entscheidungslogik'
                               END,
                               'tazite_cues', step->'slots'->'tazite_cues',
                               'ausnahmen',   step->'slots'->'ausnahmen',
                               'inputs',      step->'slots'->'inputs',
                               'outputs',     step->'slots'->'outputs',
                               'hilfsmittel', CASE
                                 WHEN step->'slots'->'data_sources' IS NOT NULL THEN
                                   jsonb_build_object(
                                     'value',           CASE
                                                          WHEN jsonb_array_length(step->'slots'->'data_sources'->'value') = 0
                                                          THEN 'null'::jsonb
                                                          ELSE step->'slots'->'data_sources'->'value'
                                                        END,
                                     'quote',           step->'slots'->'data_sources'->>'quote',
                                     'confidence',      step->'slots'->'data_sources'->>'confidence',
                                     'nicht_befund_typ', NULL
                                   )
                                 ELSE step->'slots'->'hilfsmittel'
                               END
                             ),
            'process_steps',    step->'process_steps',
            'friction_points',  step->'friction_points',
            'friction_tools',   step->'friction_tools',
            'pain_point_primary', step->'pain_point_primary',
            'embedding',        step->'embedding'
          )
        ELSE
          -- Already new format — only backfill reihenfolge if missing
          CASE
            WHEN step->'reihenfolge' IS NULL THEN
              step || jsonb_build_object('reihenfolge', idx)
            ELSE step
          END
      END AS migrated_step
    FROM interview_state is2,
         jsonb_array_elements(is2.step_tracker) WITH ORDINALITY AS t(step, idx)
    WHERE is2.interview_id = interview_state.interview_id
  ) sub
)
WHERE step_tracker IS NOT NULL
  AND jsonb_array_length(step_tracker) > 0;

COMMIT;

-- ============================================================
-- DOWN (reverse migration — restores flat-slots layout)
-- WARNING: rule_based is reconstructed as string "rule_based: true/false",
-- not the original boolean SlotValue. Manual correction may be needed.
-- ============================================================

-- BEGIN;
-- UPDATE interview_state
-- SET step_tracker = (
--   SELECT jsonb_agg(
--     CASE
--       WHEN step ? 'potenzial' THEN
--         jsonb_build_object(
--           'title',       step->>'title',
--           'role',        step->'governance'->>'rolle',
--           'status',      step->>'status',
--           'slots',       (step->'slots' - 'entscheidungslogik' - 'hilfsmittel')
--                          || step->'potenzial'
--                          || jsonb_build_object(
--                               'rule_based', CASE
--                                 WHEN step->'slots'->'entscheidungslogik' IS NOT NULL THEN
--                                   jsonb_build_object('value', false, 'quote',
--                                     step->'slots'->'entscheidungslogik'->>'quote')
--                                 ELSE 'null'::jsonb
--                               END,
--                               'data_sources', step->'slots'->'hilfsmittel'
--                             ),
--           'process_steps',   step->'process_steps',
--           'friction_points', step->'friction_points',
--           'friction_tools',  step->'friction_tools',
--           'pain_point_primary', step->'pain_point_primary',
--           'embedding',       step->'embedding'
--         )
--       ELSE step
--     END
--   )
--   FROM jsonb_array_elements(step_tracker) AS t(step)
-- )
-- WHERE step_tracker IS NOT NULL
--   AND jsonb_array_length(step_tracker) > 0;
-- COMMIT;

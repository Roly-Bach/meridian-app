-- PROJ-27 / BL-E1.5: Atomic per-slot JSONB update to fix lost-update race condition.
-- record_slot previously did read-modify-write on the full step_tracker array.
-- Concurrent writers (analyst_online + analyst_catchup) clobbered each other's slots.
-- This function patches a single field at path step_tracker[p_step_index][...p_sub_path]
-- using jsonb_set, leaving all other slots untouched.
--
-- Called from record_slot and record_governance in interviewAgent.ts via supabase.rpc().

CREATE OR REPLACE FUNCTION patch_interview_step_field(
  p_interview_id uuid,
  p_step_index    int,
  p_sub_path      text[],
  p_value         jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE interview_state
  SET
    step_tracker = jsonb_set(
      step_tracker,
      (ARRAY[p_step_index::text] || p_sub_path)::text[],
      p_value,
      true   -- create_missing: allow setting nested keys
    ),
    updated_at = now()
  WHERE interview_id = p_interview_id;
END;
$$;

-- Grant execute to authenticated role (same pattern as other RPC functions in this project)
GRANT EXECUTE ON FUNCTION patch_interview_step_field(uuid, int, text[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION patch_interview_step_field(uuid, int, text[], jsonb) TO service_role;

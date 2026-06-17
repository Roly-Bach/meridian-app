-- PROJ-27/B6: Remove unnecessary GRANT TO authenticated on SECURITY DEFINER function.
-- patch_interview_step_field bypasses RLS (SECURITY DEFINER). All callers use service_role
-- (server-side only). The authenticated grant created an unnecessary attack surface:
-- a valid JWT + guessed interview UUID could patch any interview_state row.
REVOKE EXECUTE ON FUNCTION patch_interview_step_field(uuid, int, text[], jsonb) FROM authenticated;

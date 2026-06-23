-- Fix from proj16_01: REVOKE FROM anon, authenticated alone doesn't work — Postgres grants
-- EXECUTE to PUBLIC by default at function creation, and anon/authenticated inherit through
-- PUBLIC membership. Must explicitly revoke from PUBLIC too.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.patch_interview_step_field(uuid, int, text[], jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_knowledge_objects(vector, uuid, text, float, int) FROM PUBLIC;
-- search_knowledge_objects must stay callable by authenticated (used by /api/knowledge/search
-- with a user-session client) — re-grant explicitly since the PUBLIC revoke above also
-- removes the implicit authenticated path.
GRANT EXECUTE ON FUNCTION public.search_knowledge_objects(vector, uuid, text, float, int) TO authenticated;

-- Missed in proj16_01: patch_interview_step_field also had mutable search_path.
ALTER FUNCTION public.patch_interview_step_field(uuid, int, text[], jsonb) SET search_path = public, pg_temp;

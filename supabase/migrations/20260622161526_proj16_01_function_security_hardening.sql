-- PROJ-16 Deliverable 1: Supabase Security-Findings beheben
-- handle_new_user: Trigger-only function, never called via PostgREST RPC by the app.
-- Revoke EXECUTE so it isn't reachable via /rest/v1/rpc/handle_new_user.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- patch_interview_step_field: only ever called from interviewAgent.ts via getSupabaseAdmin()
-- (service_role), never via a user-session client. Safe to revoke anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.patch_interview_step_field(uuid, int, text[], jsonb) FROM anon, authenticated;

-- update_updated_at, match_process_cluster: mutable search_path (function_search_path_mutable WARN).
ALTER FUNCTION public.update_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.match_process_cluster(vector, uuid, float) SET search_path = public, pg_temp;

-- search_knowledge_objects: mutable search_path AND called by /api/knowledge/search via a
-- user-session client (createClient() with NEXT_PUBLIC_SUPABASE_ANON_KEY + cookies) — that
-- route checks auth.getUser() before calling the RPC, so `authenticated` must keep EXECUTE.
-- Only `anon` is revoked (unauthenticated callers are already blocked at the route layer).
ALTER FUNCTION public.search_knowledge_objects(vector, uuid, text, float, int) SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.search_knowledge_objects(vector, uuid, text, float, int) FROM anon;

-- Move pgvector extension from public to extensions schema (Security Advisor: extension_in_public).
-- DB search_path already includes extensions ("$user", public, extensions), so existing
-- table columns of type vector and built indexes keep working unaffected (resolved by OID).
-- Functions with a FIXED search_path that reference the vector type or its operators must be
-- updated explicitly, since fixed search_path ignores the session/database default.
ALTER EXTENSION vector SET SCHEMA extensions;

ALTER FUNCTION public.match_process_cluster(vector, uuid, double precision)
  SET search_path = public, extensions, pg_temp;

ALTER FUNCTION public.search_knowledge_objects(vector, uuid, text, double precision, integer)
  SET search_path = public, extensions, pg_temp;

CREATE OR REPLACE FUNCTION match_process_cluster(
  query_embedding vector(1024),
  workspace_id uuid,
  similarity_threshold float DEFAULT 0.85
)
RETURNS TABLE(cluster_id uuid, similarity float)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT
      pc.id AS cid,
      1 - (pc.representative_embedding <=> query_embedding) AS sim
    FROM process_clusters pc
    WHERE pc.workspace_id = match_process_cluster.workspace_id
  )
  SELECT cid AS cluster_id, sim AS similarity
  FROM candidates
  WHERE sim >= similarity_threshold
  ORDER BY sim DESC
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION search_knowledge_objects(
  query_embedding vector(1024),
  workspace_id uuid,
  object_type text DEFAULT NULL,
  similarity_threshold float DEFAULT 0.70,
  match_count int DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  type text,
  content jsonb,
  source_quote text,
  interview_id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT
      ko.id AS kid,
      ko.type::text AS ktype,
      ko.content AS kcontent,
      ko.source_quote AS kquote,
      ko.interview_id AS kinterview,
      1 - (ko.embedding <=> query_embedding) AS sim
    FROM knowledge_objects ko
    WHERE ko.workspace_id = search_knowledge_objects.workspace_id
      AND (object_type IS NULL OR ko.type::text = object_type)
  )
  SELECT kid, ktype, kcontent, kquote, kinterview, sim
  FROM candidates
  WHERE sim >= similarity_threshold
  ORDER BY sim DESC
  LIMIT match_count;
END;
$$;

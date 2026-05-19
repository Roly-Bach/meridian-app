-- ============================================================================
-- Migration: MVP Schema (workspace-based)
-- Replaces initial schema with workspace-isolated multi-tenant architecture
-- Date: 2026-05-19
-- ============================================================================

-- ============================================================================
-- Cleanup: Drop old schema
-- ============================================================================

DROP TABLE IF EXISTS knowledge_chunks CASCADE;
DROP TABLE IF EXISTS interviews CASCADE;
DROP TABLE IF EXISTS mitarbeiter CASCADE;
DROP TABLE IF EXISTS unternehmen CASCADE;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;

-- ============================================================================
-- Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- Helper: updated_at trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Tables
-- ============================================================================

CREATE TABLE workspaces (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  hourly_rate numeric(10,2) NOT NULL DEFAULT 80.00,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE interviews (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid    NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  employee_name text    NOT NULL,
  employee_role text,
  status        text    NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE interview_state (
  interview_id     uuid    PRIMARY KEY REFERENCES interviews(id) ON DELETE CASCADE,
  phase            text    NOT NULL DEFAULT 'intro'
    CHECK (phase IN ('intro', 'process_discovery', 'deep_dive', 'wrap_up', 'completed')),
  timer_minutes    integer NOT NULL DEFAULT 0,
  topics_covered   text[]  NOT NULL DEFAULT '{}',
  topics_open      text[]  NOT NULL DEFAULT '{}',
  extractions_log  jsonb   NOT NULL DEFAULT '[]'::jsonb,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE turns (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id   uuid    NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  turn_number    integer NOT NULL,
  user_input     text    NOT NULL,
  agent_response text    NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE knowledge_objects (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid    NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  workspace_id uuid    NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type         text    NOT NULL CHECK (type IN ('process_step', 'tool', 'pain_point', 'fact', 'contact')),
  content      jsonb   NOT NULL DEFAULT '{}'::jsonb,
  source_quote text,
  turn_id      uuid    REFERENCES turns(id) ON DELETE SET NULL,
  embedding    vector(1536),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE process_steps (
  id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id         uuid    NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  workspace_id         uuid    NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title                text    NOT NULL,
  description          text,
  role                 text,
  frequency_per_month  integer,
  duration_minutes     integer,
  data_sources         text[]  NOT NULL DEFAULT '{}',
  rule_based           boolean NOT NULL DEFAULT false,
  error_rate_percent   integer,
  media_breaks         integer NOT NULL DEFAULT 0,
  source_quote         text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE use_cases (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  process_step_id  uuid    NOT NULL REFERENCES process_steps(id) ON DELETE CASCADE,
  workspace_id     uuid    NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type             text    NOT NULL,
  title            text    NOT NULL,
  description      text,
  reasoning        text,
  priority         text    CHECK (priority IN ('high', 'medium', 'low')),
  roi_hours_per_year  numeric(10,2),
  roi_eur_per_year    numeric(10,2),
  effort           text    CHECK (effort IN ('low', 'medium', 'high')),
  score            numeric(5,2),
  quarter          text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Triggers: updated_at
-- ============================================================================

CREATE TRIGGER trg_workspaces_updated
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_interview_state_updated
  BEFORE UPDATE ON interview_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- Trigger: Auto-create workspace on user signup
-- Runs with SECURITY DEFINER to allow writing back to auth.users.raw_user_meta_data
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_workspace_id uuid;
  workspace_name   text;
BEGIN
  workspace_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'workspace_name'), ''),
    'My Workspace'
  );

  INSERT INTO workspaces (name, user_id)
  VALUES (workspace_name, NEW.id)
  RETURNING id INTO new_workspace_id;

  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('workspace_id', new_workspace_id::text)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_workspaces_user_id ON workspaces(user_id);
CREATE INDEX idx_interviews_workspace ON interviews(workspace_id);
CREATE INDEX idx_interviews_status ON interviews(status);
CREATE INDEX idx_turns_interview ON turns(interview_id);
CREATE INDEX idx_turns_order ON turns(interview_id, turn_number);
CREATE INDEX idx_knowledge_objects_workspace ON knowledge_objects(workspace_id);
CREATE INDEX idx_knowledge_objects_interview ON knowledge_objects(interview_id);
CREATE INDEX idx_process_steps_workspace ON process_steps(workspace_id);
CREATE INDEX idx_process_steps_interview ON process_steps(interview_id);
CREATE INDEX idx_use_cases_workspace ON use_cases(workspace_id);
CREATE INDEX idx_use_cases_process_step ON use_cases(process_step_id);

-- IVFFlat for semantic search (optimal after initial data load of ~1k+ rows)
CREATE INDEX idx_knowledge_objects_embedding
  ON knowledge_objects
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE workspaces       ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews       ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_state  ENABLE ROW LEVEL SECURITY;
ALTER TABLE turns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_steps    ENABLE ROW LEVEL SECURITY;
ALTER TABLE use_cases        ENABLE ROW LEVEL SECURITY;

-- workspaces: direct user ownership
CREATE POLICY "Users manage own workspace" ON workspaces
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- interviews, knowledge_objects, process_steps, use_cases: workspace_id column
CREATE POLICY "Workspace isolation" ON interviews
  FOR ALL
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Workspace isolation" ON knowledge_objects
  FOR ALL
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Workspace isolation" ON process_steps
  FOR ALL
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Workspace isolation" ON use_cases
  FOR ALL
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

-- interview_state, turns: joined isolation via interviews
CREATE POLICY "Workspace isolation" ON interview_state
  FOR ALL
  USING (
    interview_id IN (
      SELECT i.id FROM interviews i
      JOIN workspaces w ON w.id = i.workspace_id
      WHERE w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    interview_id IN (
      SELECT i.id FROM interviews i
      JOIN workspaces w ON w.id = i.workspace_id
      WHERE w.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace isolation" ON turns
  FOR ALL
  USING (
    interview_id IN (
      SELECT i.id FROM interviews i
      JOIN workspaces w ON w.id = i.workspace_id
      WHERE w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    interview_id IN (
      SELECT i.id FROM interviews i
      JOIN workspaces w ON w.id = i.workspace_id
      WHERE w.user_id = auth.uid()
    )
  );

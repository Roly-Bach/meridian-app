-- ============================================================================
-- Migration: PROJ-10 Access Control & Shared Workspace
-- Date: 2026-05-20
-- ============================================================================
-- Goals:
--   1. Introduce workspace_members for multi-user workspaces
--   2. Replace per-user workspace ownership with membership-based RLS
--   3. Update signup trigger: new users join the existing (first) workspace
-- ============================================================================

-- ----------------------------------------------------------------------------
-- workspace_members table
-- ----------------------------------------------------------------------------
CREATE TABLE workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see own memberships" ON workspace_members
  FOR SELECT USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Backfill: every existing workspace.user_id becomes a member
-- ----------------------------------------------------------------------------
INSERT INTO workspace_members (workspace_id, user_id)
SELECT id, user_id FROM workspaces
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- Drop existing policies (idempotent)
-- Names taken from 20260519000001_mvp_schema.sql + 20260520000002_proj2_rls_policies.sql
-- ----------------------------------------------------------------------------
-- workspaces
DROP POLICY IF EXISTS "Users manage own workspace" ON workspaces;

-- interviews
DROP POLICY IF EXISTS "Workspace isolation" ON interviews;
DROP POLICY IF EXISTS "Enable read access for users based on workspace" ON interviews;
DROP POLICY IF EXISTS "Enable insert for users based on workspace" ON interviews;
DROP POLICY IF EXISTS "Enable update for users based on workspace" ON interviews;
DROP POLICY IF EXISTS "Enable delete for users based on workspace" ON interviews;

-- knowledge_objects
DROP POLICY IF EXISTS "Workspace isolation" ON knowledge_objects;

-- process_steps
DROP POLICY IF EXISTS "Workspace isolation" ON process_steps;

-- use_cases
DROP POLICY IF EXISTS "Workspace isolation" ON use_cases;

-- interview_state
DROP POLICY IF EXISTS "Workspace isolation" ON interview_state;
DROP POLICY IF EXISTS "Enable read access for users based on interview owner" ON interview_state;
DROP POLICY IF EXISTS "Enable insert for users based on interview owner" ON interview_state;
DROP POLICY IF EXISTS "Enable update for users based on interview owner" ON interview_state;

-- turns
DROP POLICY IF EXISTS "Workspace isolation" ON turns;
DROP POLICY IF EXISTS "Enable read access for users based on interview owner" ON turns;
DROP POLICY IF EXISTS "Enable insert for users based on interview owner" ON turns;
DROP POLICY IF EXISTS "Enable update for users based on interview owner" ON turns;

-- ----------------------------------------------------------------------------
-- New policies: workspace_members-based access
-- ----------------------------------------------------------------------------

-- workspaces
CREATE POLICY "Members can view workspace" ON workspaces
  FOR SELECT USING (
    id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Creator can manage workspace" ON workspaces
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- interviews
CREATE POLICY "Workspace members can manage interviews" ON interviews
  FOR ALL
  USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- knowledge_objects
CREATE POLICY "Workspace members can manage knowledge_objects" ON knowledge_objects
  FOR ALL
  USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- process_steps
CREATE POLICY "Workspace members can manage process_steps" ON process_steps
  FOR ALL
  USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- use_cases
CREATE POLICY "Workspace members can manage use_cases" ON use_cases
  FOR ALL
  USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- interview_state (joined via interviews)
CREATE POLICY "Workspace members can manage interview_state" ON interview_state
  FOR ALL
  USING (
    interview_id IN (
      SELECT id FROM interviews WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    interview_id IN (
      SELECT id FROM interviews WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- turns (joined via interviews)
CREATE POLICY "Workspace members can manage turns" ON turns
  FOR ALL
  USING (
    interview_id IN (
      SELECT id FROM interviews WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    interview_id IN (
      SELECT id FROM interviews WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- ----------------------------------------------------------------------------
-- Signup trigger: new users join the existing primary workspace
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  target_workspace_id uuid;
BEGIN
  -- Use the oldest existing workspace as the shared workspace
  SELECT id INTO target_workspace_id
  FROM workspaces
  ORDER BY created_at ASC
  LIMIT 1;

  IF target_workspace_id IS NULL THEN
    -- Bootstrap case: first user creates the workspace
    INSERT INTO workspaces (name, user_id)
    VALUES (
      COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'workspace_name'), ''),
        'Workspace'
      ),
      NEW.id
    )
    RETURNING id INTO target_workspace_id;
  END IF;

  -- Attach user to the workspace
  INSERT INTO workspace_members (workspace_id, user_id)
  VALUES (target_workspace_id, NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- Migration: PROJ-2 Patch — RLS Policies for interviews, state, and turns
-- Date: 2026-05-20
-- ============================================================================

-- RLS for 'interviews' table
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for users based on workspace" ON interviews
FOR SELECT USING (auth.uid() = (SELECT user_id FROM workspaces WHERE id = workspace_id));

CREATE POLICY "Enable insert for users based on workspace" ON interviews
FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM workspaces WHERE id = workspace_id));

CREATE POLICY "Enable update for users based on workspace" ON interviews
FOR UPDATE USING (auth.uid() = (SELECT user_id FROM workspaces WHERE id = workspace_id));

CREATE POLICY "Enable delete for users based on workspace" ON interviews
FOR DELETE USING (auth.uid() = (SELECT user_id FROM workspaces WHERE id = workspace_id));

-- RLS for 'interview_state' table
ALTER TABLE interview_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for users based on interview owner" ON interview_state
FOR SELECT USING (interview_id IN (SELECT id FROM interviews WHERE auth.uid() = (SELECT user_id FROM workspaces WHERE id = workspace_id)));

CREATE POLICY "Enable insert for users based on interview owner" ON interview_state
FOR INSERT WITH CHECK (interview_id IN (SELECT id FROM interviews WHERE auth.uid() = (SELECT user_id FROM workspaces WHERE id = workspace_id)));

CREATE POLICY "Enable update for users based on interview owner" ON interview_state
FOR UPDATE USING (interview_id IN (SELECT id FROM interviews WHERE auth.uid() = (SELECT user_id FROM workspaces WHERE id = workspace_id)));

-- RLS for 'turns' table
ALTER TABLE turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for users based on interview owner" ON turns
FOR SELECT USING (interview_id IN (SELECT id FROM interviews WHERE auth.uid() = (SELECT user_id FROM workspaces WHERE id = workspace_id)));

CREATE POLICY "Enable insert for users based on interview owner" ON turns
FOR INSERT WITH CHECK (interview_id IN (SELECT id FROM interviews WHERE auth.uid() = (SELECT user_id FROM workspaces WHERE id = workspace_id)));

CREATE POLICY "Enable update for users based on interview owner" ON turns
FOR UPDATE USING (interview_id IN (SELECT id FROM interviews WHERE auth.uid() = (SELECT user_id FROM workspaces WHERE id = workspace_id)));

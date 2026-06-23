DROP POLICY "Workspace members can manage turns" ON turns;
CREATE POLICY "Workspace members can manage turns" ON turns
  FOR ALL USING (interview_id IN (SELECT interviews.id FROM interviews WHERE interviews.workspace_id IN (SELECT workspace_members.workspace_id FROM workspace_members WHERE workspace_members.user_id = (select auth.uid()))))
  WITH CHECK (interview_id IN (SELECT interviews.id FROM interviews WHERE interviews.workspace_id IN (SELECT workspace_members.workspace_id FROM workspace_members WHERE workspace_members.user_id = (select auth.uid()))));

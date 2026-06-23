DROP POLICY "Workspace members can manage interview_state" ON interview_state;
CREATE POLICY "Workspace members can manage interview_state" ON interview_state
  FOR ALL USING (interview_id IN (SELECT interviews.id FROM interviews WHERE interviews.workspace_id IN (SELECT workspace_members.workspace_id FROM workspace_members WHERE workspace_members.user_id = (select auth.uid()))))
  WITH CHECK (interview_id IN (SELECT interviews.id FROM interviews WHERE interviews.workspace_id IN (SELECT workspace_members.workspace_id FROM workspace_members WHERE workspace_members.user_id = (select auth.uid()))));

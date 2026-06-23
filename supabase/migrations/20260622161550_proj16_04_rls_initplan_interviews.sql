DROP POLICY "Workspace members can manage interviews" ON interviews;
CREATE POLICY "Workspace members can manage interviews" ON interviews
  FOR ALL USING (workspace_id IN (SELECT workspace_members.workspace_id FROM workspace_members WHERE workspace_members.user_id = (select auth.uid())))
  WITH CHECK (workspace_id IN (SELECT workspace_members.workspace_id FROM workspace_members WHERE workspace_members.user_id = (select auth.uid())));

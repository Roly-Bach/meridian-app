DROP POLICY "Workspace members can manage process_steps" ON process_steps;
CREATE POLICY "Workspace members can manage process_steps" ON process_steps
  FOR ALL USING (workspace_id IN (SELECT workspace_members.workspace_id FROM workspace_members WHERE workspace_members.user_id = (select auth.uid())))
  WITH CHECK (workspace_id IN (SELECT workspace_members.workspace_id FROM workspace_members WHERE workspace_members.user_id = (select auth.uid())));

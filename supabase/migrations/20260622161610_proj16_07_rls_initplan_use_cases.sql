DROP POLICY "Workspace members can manage use_cases" ON use_cases;
CREATE POLICY "Workspace members can manage use_cases" ON use_cases
  FOR ALL USING (workspace_id IN (SELECT workspace_members.workspace_id FROM workspace_members WHERE workspace_members.user_id = (select auth.uid())))
  WITH CHECK (workspace_id IN (SELECT workspace_members.workspace_id FROM workspace_members WHERE workspace_members.user_id = (select auth.uid())));

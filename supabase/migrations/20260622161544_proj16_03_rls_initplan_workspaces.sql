DROP POLICY "Members can view workspace" ON workspaces;
CREATE POLICY "Members can view workspace" ON workspaces
  FOR SELECT USING (id IN (SELECT workspace_members.workspace_id FROM workspace_members WHERE workspace_members.user_id = (select auth.uid())));

DROP POLICY "Creator can manage workspace" ON workspaces;
CREATE POLICY "Creator can manage workspace" ON workspaces
  FOR ALL USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

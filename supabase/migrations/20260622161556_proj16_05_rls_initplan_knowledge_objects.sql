DROP POLICY "Workspace members can manage knowledge_objects" ON knowledge_objects;
CREATE POLICY "Workspace members can manage knowledge_objects" ON knowledge_objects
  FOR ALL USING (workspace_id IN (SELECT workspace_members.workspace_id FROM workspace_members WHERE workspace_members.user_id = (select auth.uid())))
  WITH CHECK (workspace_id IN (SELECT workspace_members.workspace_id FROM workspace_members WHERE workspace_members.user_id = (select auth.uid())));

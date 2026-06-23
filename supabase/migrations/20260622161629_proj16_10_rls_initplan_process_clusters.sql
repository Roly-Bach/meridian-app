DROP POLICY "workspace_member_select" ON process_clusters;
CREATE POLICY "workspace_member_select" ON process_clusters
  FOR SELECT USING (workspace_id IN (SELECT workspace_members.workspace_id FROM workspace_members WHERE workspace_members.user_id = (select auth.uid())));

DROP POLICY "workspace_member_insert" ON process_clusters;
CREATE POLICY "workspace_member_insert" ON process_clusters
  FOR INSERT WITH CHECK (workspace_id IN (SELECT workspace_members.workspace_id FROM workspace_members WHERE workspace_members.user_id = (select auth.uid())));

DROP POLICY "workspace_member_update" ON process_clusters;
CREATE POLICY "workspace_member_update" ON process_clusters
  FOR UPDATE USING (workspace_id IN (SELECT workspace_members.workspace_id FROM workspace_members WHERE workspace_members.user_id = (select auth.uid())));

-- "Creator can manage workspace" (ALL) and "Members can view workspace" (SELECT) both
-- grant SELECT, causing Postgres to evaluate two permissive policies per row on every
-- read. Restrict the creator policy to write actions only — membership already covers
-- the creator's own SELECT access via workspace_members.
DROP POLICY "Creator can manage workspace" ON workspaces;
CREATE POLICY "Creator can manage workspace" ON workspaces
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Creator can update workspace" ON workspaces
  FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Creator can delete workspace" ON workspaces
  FOR DELETE USING (user_id = (select auth.uid()));

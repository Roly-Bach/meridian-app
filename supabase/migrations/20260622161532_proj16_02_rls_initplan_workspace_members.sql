DROP POLICY "Members see own memberships" ON workspace_members;
CREATE POLICY "Members see own memberships" ON workspace_members
  FOR SELECT USING (user_id = (select auth.uid()));

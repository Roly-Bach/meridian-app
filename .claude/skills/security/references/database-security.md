# Database Access Control (Supabase RLS)

## Meridian Table Overview

| Table | RLS | Access Pattern |
|-------|-----|---------------|
| `workspaces` | ✅ | Members via workspace_members |
| `workspace_members` | ✅ | User sees own memberships only |
| `interviews` | ✅ | Workspace members |
| `interview_state` | ✅ | Via interviews → workspace |
| `turns` | ✅ | Via interviews → workspace |
| `knowledge_objects` | ✅ | Workspace members |
| `process_steps` | ✅ | Workspace members |
| `use_cases` | ✅ | Workspace members |

## Critical Patterns to Check

### Enable RLS on Every New Table

When adding a new migration, always include:
```sql
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
```
Tables without RLS are fully readable/writable by anyone with the anon key (which is public).

### Never Use `USING (true)`

```sql
-- BAD: any authenticated user reads all rows
CREATE POLICY "..." ON interviews FOR SELECT TO authenticated USING (true);

-- GOOD: workspace isolation
CREATE POLICY "..." ON interviews FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));
```

### Always Include WITH CHECK on INSERT/UPDATE

Without `WITH CHECK`, a user can insert rows or update `workspace_id` to a workspace they don't own.

### service_role Bypasses RLS

`getSupabaseAdmin()` uses the service_role key and skips all RLS. Every API route that uses it must enforce authorization manually via an explicit workspace membership check:

```typescript
// Pattern used in Meridian routes — verify before using admin client
const { data: membership } = await supabase
  .from('workspace_members')
  .select('workspace_id')
  .eq('user_id', user.id)
  .eq('workspace_id', workspace_id)
  .single()
if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

const admin = getSupabaseAdmin()
// now safe to use admin for this workspace_id
```

### Interview Token Endpoints Are RLS-Exempt by Design

`/api/interview/[token]/*` routes don't use Supabase Auth at all — they authenticate via `access_token`. These routes use `getSupabaseAdmin()` and verify the token by querying the `interviews` table. This is intentional. The security control here is token validity + expiry, not RLS.

### Sensitive Fields

The `workspaces` table currently stores `hourly_rate`. If workspace members could UPDATE this via RLS, they could inflate ROI calculations. The current policy restricts workspace UPDATE to the creator (`user_id = auth.uid()`), which is correct.

### Checking for New Tables Without RLS

Run in Supabase SQL editor to find unprotected tables:
```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT DISTINCT tablename FROM pg_policies
    WHERE schemaname = 'public'
  );
```

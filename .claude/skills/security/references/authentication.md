# Authentication & Authorization

## Two Auth Models in Meridian

### 1. Session-Based Auth (authenticated routes)
Used by all `/api/interviews`, `/api/process-steps`, `/api/use-cases` routes.

Pattern:
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

Always use `getUser()` — never `getSession()` alone. `getUser()` validates the JWT with the Supabase server; `getSession()` reads from the cookie without server-side verification.

### 2. Token-Based Auth (public interview links)
Used by `/api/interview/[token]/*` routes. No Supabase session.

Pattern:
```typescript
const { data: interview } = await supabase
  .from('interviews')
  .select('...')
  .eq('access_token', token)
  .single()
if (!interview) return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
if (new Date(interview.token_expires_at) < new Date()) {
  return NextResponse.json({ error: '...' }, { status: 410 })
}
```

## Authorization After Authentication

Authentication (who are you?) is not enough. Authorization (can you access this?) must also be checked.

For session-based routes that use `getSupabaseAdmin()`:
```typescript
// Must verify workspace membership before any admin query
const { data: membership } = await supabase  // user-scoped client, not admin
  .from('workspace_members')
  .select('workspace_id')
  .eq('user_id', user.id)
  .eq('workspace_id', workspace_id)
  .single()
if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

## Next.js Middleware Is Not the Only Auth Layer

The middleware in Meridian redirects unauthenticated users but is NOT the security boundary. Every API route must re-check auth. CVE-2025-29927 showed middleware can be bypassed via header spoofing.

## Server Components & Data Leakage

Never pass full database rows to Client Components. Select only needed fields:

```typescript
// BAD: leaks all columns including internal fields
const { data } = await supabase.from('workspaces').select('*')

// GOOD
const { data } = await supabase.from('workspaces').select('id, name')
```

## `import 'server-only'`

Add `import 'server-only'` to `src/lib/supabase-admin.ts` to prevent the admin client from being accidentally imported into Client Components (which would expose the service_role key at build time).

# Data Access & Input Validation

## Current Validation Posture

All Meridian API routes use Zod schemas before processing. This is correct and should be maintained for every new route.

## Pattern to Follow

```typescript
const Schema = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().min(1).max(200),
})

export async function POST(req: Request) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  // use parsed.data — never req.body directly
}
```

## Mass Assignment

Never spread request body directly into a Supabase insert/update. Pick only the fields the user is allowed to set:

```typescript
// BAD: attacker could inject workspace_id, status, access_token
await admin.from('interviews').insert(parsed.data)

// GOOD: explicitly pick allowed fields
const { employee_name, employee_role, department, focus_topics, max_duration_minutes } = parsed.data
await admin.from('interviews').insert({ employee_name, employee_role, ... })
```

## URL Parameters

Token and ID from URL params must be validated before use. The interview token is used directly in a database query — Supabase uses parameterized queries internally, so SQL injection isn't possible. But validate length/format to avoid unnecessary DB load:

```typescript
// Add to ChatInputSchema or token validation
const tokenSchema = z.string().uuid() // access_token is a UUID
```

Currently access_token is a `crypto.randomUUID()` result, so UUID validation is appropriate.

## Supabase Parameterization

Supabase's JavaScript client uses parameterized queries — no SQL injection via `.eq()`, `.insert()`, etc. The risk is not SQL injection but logical access control errors (wrong `WHERE` clauses, missing auth checks). These are caught by RLS audit, not input validation.

## LLM Output Validation

When LLM output is parsed into structured data (extraction agent outputs `knowledge_objects`):
- Validate the shape with Zod before inserting into the database
- Don't trust that the LLM always returns well-formed JSON
- Use `.safeParse()` so failures are handled gracefully, not thrown

```typescript
const KnowledgeObjectSchema = z.object({
  title: z.string().max(500),
  content: z.string().max(10000),
  type: z.enum(['process_step', 'tool', 'stakeholder', 'rule']),
})

const validated = KnowledgeObjectSchema.safeParse(llmOutput)
if (!validated.success) {
  console.error('LLM returned invalid structure:', validated.error)
  return // skip this object
}
```

---
name: security
description: Audits the Meridian codebase for security vulnerabilities. Checks RLS policies, missing rate limits on LLM endpoints, exposed API keys, auth bypass vectors, and security headers. Use when asked about security, before deploying changes to auth/API/DB, or when reviewing code that touches user data, API keys, or LLM calls.
license: MIT
metadata:
  author: Meridian (adapted from Chris Raroque's vibe-security-skill)
  version: "1.0"
---

Audit Meridian for security vulnerabilities common in AI-assisted development. Meridian uses Next.js App Router, Supabase (PostgreSQL + RLS + Auth), and multiple LLM providers (Anthropic Claude, Google Gemini, OpenAI embeddings). These are the most likely failure points.

## Core Principle

Never trust the client. Every workspace_id, user role, and feature flag must be validated server-side. The interview token endpoints are public by design — they are the highest-risk surface.

## Meridian-Specific Risk Surface

1. **Token-based interview endpoints** (`/api/interview/[token]/*`) — authenticated via access token only, no Supabase session. Public by design. Any logic change here needs extra scrutiny.
2. **LLM calls** — chat, process-step enrichment, and use-case generation all call external AI APIs. No rate limiting means a leaked token or credential can drain billing.
3. **Supabase service_role usage** — several API routes use `getSupabaseAdmin()` (service_role bypasses RLS). These routes must enforce authorization themselves.
4. **Workspace isolation** — all data is scoped to workspaces. The workspace_members table is the authorization boundary. Any query missing the membership check leaks cross-workspace data.
5. **New `[id]`/detail routes — IDOR** <!-- source: PROJ-24 (/retro 2026-06-22) — use-case detail route accepted any ID, cross-workspace object access never checked until QA --> Every new route that takes a resource ID (`[id]`, query param, or body field) must explicitly verify the resource belongs to the caller's workspace before returning or mutating it — a valid auth session is not enough, the object itself must be ownership-checked.

## Audit Process

For each step, load the relevant reference file only if applicable to what's being audited.

1. **Secrets & Environment Variables** — Scan for `NEXT_PUBLIC_` on sensitive keys (service_role, API secrets). Verify `.env.local` is gitignored. See `references/secrets-and-env.md`.

2. **RLS & Database Access** — Check migration files for missing `ENABLE ROW LEVEL SECURITY`, `USING (true)`, missing `WITH CHECK`, and tables added without policies. See `references/database-security.md`.

3. **Authentication & Authorization** — Verify every `app/api/` route calls `getUser()` or validates the interview token. Check that `getSupabaseAdmin()` routes manually enforce workspace membership. See `references/authentication.md`.

4. **Rate Limiting on LLM Endpoints** — Check `/api/interview/[token]/chat`, `/api/process-steps/generate`, and any other LLM-calling routes for per-token and per-IP limits. See `references/rate-limiting.md`.

5. **AI API Key Protection** — Verify ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, OPENAI_API_KEY are never in `NEXT_PUBLIC_` vars and never referenced in client components. See `references/ai-integration.md`.

6. **Security Headers** — Verify `next.config.ts` has CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy. See `references/deployment.md`.

7. **Input Validation** — Confirm Zod schemas on all route handlers and that user input is never concatenated into prompts unsanitized. See `references/data-access.md`.

Skip sections not relevant to the change being reviewed.

## Core Instructions

- Report only genuine security issues. Do not nitpick style.
- Prioritize by exploitability: a leaked API key or bypassed auth beats a missing header.
- If a critical issue is found (admin key exposed, auth bypass, no RLS), flag it at the top immediately.
- For new code generation, consult relevant reference files proactively to avoid introducing vulnerabilities.

## Output Format

Organize by severity: **Critical** → **High** → **Medium** → **Low**.

For each finding:
1. File and line(s)
2. Vulnerability name
3. Concrete attacker impact
4. Before/after code fix

End with a prioritized summary of what to fix first.

### Example Finding

#### High

**`src/app/api/interview/[token]/chat/route.ts` — No rate limit on LLM endpoint**

Anyone with a valid (or stolen) interview token can send unlimited messages, triggering unlimited Claude/Gemini API calls at the workspace owner's expense.

```typescript
// Before: no rate limiting
export async function POST(req, { params }) {
  const { token } = await params
  // ... calls createInterviewStream() directly
}

// After: add per-token sliding window before the LLM call
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, '1 h'), // 60 messages per token per hour
})
export async function POST(req, { params }) {
  const { token } = await params
  const { success } = await ratelimit.limit(`interview:${token}`)
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  // ...
}
```

## References

- `references/secrets-and-env.md` — Which env vars are safe client-side vs. server-only
- `references/database-security.md` — Supabase RLS patterns, WITH CHECK, service_role risks
- `references/authentication.md` — JWT, token validation, Server Action auth
- `references/rate-limiting.md` — Rate limiting for LLM endpoints and abuse prevention
- `references/ai-integration.md` — API key protection, spending caps, prompt injection
- `references/deployment.md` — Security headers, source maps, preview deployment risks
- `references/data-access.md` — Input validation, Zod usage, mass assignment

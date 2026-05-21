# Rate Limiting & Abuse Prevention

## Current Status in Meridian

**No rate limiting is implemented.** This is the highest-risk open item.

## Endpoints That Need Rate Limiting

| Endpoint | Risk | Recommended Limit |
|----------|------|-------------------|
| `POST /api/interview/[token]/chat` | LLM call (Claude/Gemini), public token auth | 60 req/hour per token + 200/day per token |
| `POST /api/process-steps/generate` | LLM enrichment call | 10 req/hour per user |
| `POST /api/use-cases/generate` | Heuristic engine (no LLM, but DB-heavy) | 30 req/hour per user |
| `POST /api/interviews` | Creates interview + state | 50 req/hour per user |

The chat endpoint is the most critical: it is publicly accessible via token only, calls an LLM on every request, and has no auth wall.

## Why Frontend Limits Don't Work

Frontend-only limits (disabled button, counter in localStorage) are meaningless. An attacker opens DevTools, finds the endpoint, and calls it directly with `curl`. Rate limiting must happen on the server.

## Implementation Options

### Option A: Upstash Redis (recommended for Vercel)

Serverless-compatible, no infrastructure to manage.

```bash
npm install @upstash/ratelimit @upstash/redis
```

```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, '1 h'),
})

// In the chat route:
const { success, reset } = await ratelimit.limit(`interview:${token}`)
if (!success) {
  return NextResponse.json(
    { error: 'Rate limit exceeded. Try again later.' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)) },
    }
  )
}
```

Env vars needed:
```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

### Option B: Supabase private schema table

Store counters in a table not exposed via PostgREST. Access only via `SECURITY DEFINER` functions.

**Do NOT store rate limit counters in a public Supabase table** — users can reset their own counters via the REST API.

## Billing Protection (Manual Steps)

Even before implementing code-level rate limiting:

1. Set a **spending cap** in the Anthropic console (your account → Limits)
2. Set a **spending cap** in Google AI Studio / Vertex AI
3. Set a **usage limit** in OpenAI dashboard
4. Set Vercel function invocation alerts

A cap that kills the service for an hour is infinitely better than an uncapped $10,000 bill.

## Combine Per-Token and Per-IP

For the interview chat endpoint:
- Per-token limit: prevents one leaked token from being abused
- Per-IP limit: prevents mass creation of interviews to get more tokens

```typescript
const tokenLimit = await tokenRatelimit.limit(`interview:${token}`)
const ipLimit = await ipRatelimit.limit(req.headers.get('x-forwarded-for') ?? 'unknown')
if (!tokenLimit.success || !ipLimit.success) {
  return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
}
```

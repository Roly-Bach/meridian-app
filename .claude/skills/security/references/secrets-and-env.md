# Secrets & Environment Variables

## Meridian Env Var Classification

### Safe for `NEXT_PUBLIC_` (browser-visible)
- `NEXT_PUBLIC_SUPABASE_URL` — public project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key enforces RLS, safe to expose

### Must NEVER have `NEXT_PUBLIC_` prefix
- `SUPABASE_SERVICE_ROLE_KEY` — bypasses all RLS; anyone with this key owns your database
- `ANTHROPIC_API_KEY` — billable API key
- `GOOGLE_GENERATIVE_AI_API_KEY` — billable API key
- `OPENAI_API_KEY` — billable API key
- `ALLOWED_EMAILS` — internal allowlist, no need to expose

## Hardcoded Credentials

Never hardcode API keys in source files. If a secret was committed to Git history, rotate it immediately — deleting the file doesn't remove it from history.

Scan for leaks:
```bash
git log -p | grep -E '(ANTHROPIC_API_KEY|GOOGLE_GENERATIVE|OPENAI_API_KEY|service_role)'
```

## .gitignore Check

`.env.local` must be in `.gitignore`. Verify:
```bash
git ls-files | grep -E '\.env'
```
If any `.env.local` or `.env` appears in the output, it's tracked. Remove with `git rm --cached .env.local` and rotate all keys.

## Detection Pattern

When auditing, look for:
- `process.env.NEXT_PUBLIC_` referencing anything with "secret", "service", "key", "anthropic", "openai", "google" in the name
- API keys in string literals: `sk-`, `AKIA`, `AIza`, `sk_live_`
- Client components that import from `@/lib/supabase-admin` (the admin client uses service_role)

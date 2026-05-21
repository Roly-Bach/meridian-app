# Deployment Security

## Security Headers (Current State)

`next.config.ts` currently sets:

| Header | Value | Status |
|--------|-------|--------|
| X-Frame-Options | DENY | ✅ |
| X-Content-Type-Options | nosniff | ✅ |
| Referrer-Policy | strict-origin-when-cross-origin | ✅ |
| Strict-Transport-Security | max-age=31536000; includeSubDomains | ✅ |
| X-Permitted-Cross-Domain-Policies | none | ✅ |
| Permissions-Policy | camera=(), microphone=(), geolocation=() | ✅ |
| Content-Security-Policy | see next.config.ts | ✅ |

## CSP Notes

The current CSP uses `'unsafe-inline'` and `'unsafe-eval'` for scripts because Next.js App Router requires them (inline scripts for hydration). This is acceptable for now.

When tightening in the future:
- Use nonce-based CSP instead of `'unsafe-inline'`
- Next.js 15 has built-in nonce support via middleware

The CSP `connect-src` allows `*.supabase.co` and `wss://*.supabase.co` for Supabase realtime/API calls.

## Environment Separation (Vercel)

Preview deployments (PRs) should never use production API keys. Set up separate env var groups in Vercel:

| Environment | Keys |
|-------------|------|
| Production | Real Anthropic/Google/OpenAI/Supabase prod keys |
| Preview | Test/staging Supabase project, lower-quota AI keys |
| Development | Local .env.local |

A preview deployment is publicly accessible to anyone with the URL. Never put production DB credentials in preview.

## Pre-Deploy Checklist

- [ ] `git ls-files | grep .env` returns nothing
- [ ] No `NEXT_PUBLIC_` prefix on service_role or AI API keys
- [ ] Spending caps set on all AI providers
- [ ] Vercel function timeout configured (default 300s is fine)
- [ ] Error pages don't leak stack traces in production

## Source Maps

Next.js disables source maps in production builds by default. Do not add `productionBrowserSourceMaps: true` to `next.config.ts` — it exposes your full source code in DevTools.

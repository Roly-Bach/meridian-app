# PROJ-12: Rate Limiting

## Status: Deployed
**Created:** 2026-05-21
**Last Updated:** 2026-05-21
**Type:** Feature
**Domain:** Platform
**Extends:** —
**Appetite:** —
**Bugs:** —

## Dependencies
- Requires: PROJ-2 (Interview Engine Backend) — betrifft die Chat- und Reconnect-Endpunkte
- Requires: PROJ-3 (Interview UI) — Fehlermeldung wird im Chat-UI angezeigt
- Externes Infra: Upstash Redis (neues Konto / Datenbank erforderlich)

## Kontext & Motivation

Meridian ruft auf vier Endpunkten externe AI-APIs auf (Anthropic, Google, OpenAI). Ohne serverseitige Limits kann ein Angreifer mit einem gültigen Interview-Token oder einem kompromittierten Account unbegrenzt LLM-Calls auslösen — mit direkten Kosten für den Workspace-Owner. Frontend-Limits bieten keinen Schutz, da API-Endpunkte direkt ansteuerbar sind.

## Zu schützende Endpunkte

| Endpunkt | Auth-Typ | AI-Call | Limit-Strategie |
|----------|----------|---------|-----------------|
| `POST /api/interview/[token]/chat` | Token (öffentlich) | Claude/Gemini | Per-Token + Per-IP |
| `POST /api/interview/[token]/reconnect` | Token (öffentlich) | Claude/Gemini | Per-Token + Per-IP |
| `POST /api/process-steps/generate` | Supabase Session | Anthropic | Per-User |
| `POST /api/use-cases/generate` | Supabase Session | — (Heuristik, kein LLM) | Per-User (DB-Schutz) |

## User Stories

- Als Workspace-Owner möchte ich, dass ein missbrauchter Interview-Link nicht unbegrenzt AI-Kosten verursachen kann, damit ich keine unerwarteten Rechnungen erhalte.
- Als Workspace-Owner möchte ich, dass ein kompromittierter Account nicht alle KI-Operationen meines Workspaces ausschöpfen kann.
- Als Interview-Teilnehmer möchte ich eine verständliche Fehlermeldung sehen, wenn ich zu viele Nachrichten gesendet habe, damit ich weiß, dass ich kurz warten soll.
- Als Consultant möchte ich, dass normale Interview-Sessions (≤30 Min, menschliche Schreibgeschwindigkeit) nie durch Rate Limits blockiert werden.

## Acceptance Criteria

### Token-Endpoints (chat + reconnect)
- [ ] Pro Interview-Token: max. 120 Requests pro Stunde (Sliding Window). Darüber hinaus: HTTP 429.
- [ ] Pro IP-Adresse: max. 200 Requests pro Stunde über alle Token-Endpoints. Darüber hinaus: HTTP 429.
- [ ] Bei 429 zeigt das Interview-Chat-UI eine deutschsprachige Fehlermeldung: „Sie haben zu viele Nachrichten gesendet. Bitte warten Sie einen Moment."
- [ ] Ein normales 30-Minuten-Interview (realistische Schreibgeschwindigkeit, ≤60 Nachrichten) erreicht das Limit nie.
- [ ] Der `Retry-After`-Header wird im 429-Response mitgeliefert.

### Auth-gesicherte LLM-Endpoints
- [ ] `POST /api/process-steps/generate`: max. 10 Requests pro Stunde pro User-ID.
- [ ] `POST /api/use-cases/generate`: max. 30 Requests pro Stunde pro User-ID.
- [ ] Bei 429 gibt die API einen strukturierten JSON-Fehler zurück: `{ "error": "Rate limit exceeded. Try again later." }`.

### Infrastruktur
- [ ] Rate-Limit-Counter laufen auf Upstash Redis (Sliding Window Algorithmus).
- [ ] Upstash-Credentials (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) sind als Server-only Env Vars konfiguriert (kein `NEXT_PUBLIC_`-Prefix).
- [ ] Fällt Upstash aus (Verbindungsfehler), schlägt der Endpunkt offen durch (fail-open) — Requests werden nicht fälschlicherweise blockiert.

## Edge Cases

- **Upstash nicht erreichbar:** Limit-Check schlägt fehl → Request wird trotzdem durchgelassen (fail-open). Ein Ausfall des Rate-Limiters darf kein Service-Ausfall sein.
- **IPv6 / fehlender IP-Header:** Falls `x-forwarded-for` nicht gesetzt ist (lokale Entwicklung), wird ein Fallback-Key `"unknown"` verwendet. Kein Crash.
- **Mehrere Tabs / parallele Requests:** Sliding Window auf Redis ist atomar — kein Race Condition-Problem.
- **Token abgelaufen + Rate Limit:** Token-Expiry-Check kommt vor dem Rate-Limit-Check. Abgelaufene Token erhalten 410, nicht 429.
- **Reconnect + Chat gleichzeitig:** Beide Endpunkte teilen denselben Token-basierten Counter — ein Reconnect-Call verbraucht ein Slot des 120/h-Limits.
- **Workspace-Owner erhöht Limits:** Keine UI dafür in MVP. Limits sind hardcoded und nur per Deployment änderbar.

## Technical Requirements

- Latenz-Overhead durch Rate-Limit-Check: < 20ms (Upstash ist edge-nativ)
- Kein persistenter Zustand in der Next.js-App — ausschließlich Upstash als Counter-Store
- Fail-open bei Upstash-Ausfall (kein Hard-Block)
- Kein Frontend-Code für die eigentliche Limit-Logik — ausschließlich serverseitig

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Neue Dateien
- `src/lib/ratelimit.ts` — zentraler Ort für alle konfigurierten Limiter (tokenLimiter, ipLimiter, userLimiter)

### Geänderte Dateien
- `src/app/api/interview/[token]/chat/route.ts` — tokenLimiter + ipLimiter nach Token-Validierung, vor LLM-Call
- `src/app/api/interview/[token]/reconnect/route.ts` — tokenLimiter + ipLimiter nach Token-Validierung, vor LLM-Call
- `src/app/api/process-steps/generate/route.ts` — userLimiter (10/h) nach Membership-Check
- `src/app/api/use-cases/generate/route.ts` — userLimiter (30/h) nach Membership-Check
- Interview-Chat-Komponente — neuer 429-Fehlerzustand mit deutschsprachiger Meldung

### Counter-Schlüssel in Upstash Redis
| Schlüssel | Limit | Algorithmus |
|---|---|---|
| `interview_token:{token}` | 120/h | Sliding Window |
| `interview_ip:{ip}` | 200/h | Sliding Window |
| `user_processsteps:{user-id}` | 10/h | Sliding Window |
| `user_usecases:{user-id}` | 30/h | Sliding Window |

### Neue Packages
- `@upstash/ratelimit` — Sliding-Window-Algorithmus
- `@upstash/redis` — serverless HTTP-Client

### Neue Env Vars
- `UPSTASH_REDIS_REST_URL` (server-only)
- `UPSTASH_REDIS_REST_TOKEN` (server-only)

### Fail-open
Upstash-Verbindungsfehler → Check wird übersprungen, Request läuft durch. Kein Hard-Block bei Infra-Ausfall.

## Implementation Notes (2026-05-21)

### What was built
- `src/lib/ratelimit.ts` — central rate limit module with four Upstash Sliding Window limiters and fail-open logic
- `POST /api/interview/[token]/chat` — tokenLimiter (120/h) + ipLimiter (200/h) added after token/status checks
- `POST /api/interview/[token]/reconnect` — same tokenLimiter + ipLimiter; handler renamed from `_req` to `req` to allow IP extraction
- `POST /api/process-steps/generate` — userLimiter (10/h) added after membership check
- `POST /api/use-cases/generate` — userLimiter (30/h) added after membership check
- `.env.local.example` updated with `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

### Deviations from spec
None. Fail-open is implemented via try/catch in `runLimit()`. Env vars missing in local dev → `getRedis()` returns null → all limit checks are skipped (no Upstash required for local dev).

### No new DB schema
All counters live in Upstash Redis — no Supabase changes needed.

## QA Test Results

**QA Date:** 2026-05-21
**QA Engineer:** Claude (automated)
**Status:** APPROVED — no Critical or High bugs

### Acceptance Criteria Results

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| AC-1 | Token-Endpoint: max 120 req/h per token, HTTP 429 on breach | PASS | Implemented via `tokenLimiter` sliding window, unit-tested |
| AC-2 | IP-Endpoint: max 200 req/h per IP, HTTP 429 on breach | PASS | Implemented via `ipLimiter`, unit-tested |
| AC-3 | Chat UI: German error toast on 429 | PASS | `useInterviewStream` extracts `error` from 429 JSON body → Sonner toast; E2E tested via route interception |
| AC-4 | Normal 30-min interview (≤60 msgs) never hits limit | PASS | 60 << 120; verified by design |
| AC-5 | `Retry-After` header in 429 response | PASS | Computed as `Math.ceil((result.reset - Date.now()) / 1000)`, unit-tested |
| AC-6 | `process-steps/generate`: max 10 req/h per user | PASS | `processStepsLimiter` after membership check, unit-tested |
| AC-7 | `use-cases/generate`: max 30 req/h per user | PASS | `useCasesLimiter` after membership check, unit-tested |
| AC-8 | Structured JSON error for auth-secured 429 | PASS | `{ "error": "Rate limit exceeded. Try again later." }` |
| AC-9 | Upstash Redis with Sliding Window | PASS | `@upstash/ratelimit` v2.0.8, `slidingWindow` algorithm |
| AC-10 | Env vars without `NEXT_PUBLIC_` prefix | PASS | `process.env.UPSTASH_REDIS_REST_URL/TOKEN`, server-only |
| AC-11 | Fail-open on Upstash outage | PASS | try/catch in `runLimit()` returns `{ blocked: false }` on any error; unit-tested |

### Edge Cases Verified

| Edge Case | Result |
|-----------|--------|
| Upstash not reachable → fail-open | PASS (unit test) |
| Missing `x-forwarded-for` → fallback `"unknown"` | PASS (unit test) |
| Token expiry check before rate limit check | PASS (code review — 410 returned before `checkTokenEndpointLimits`) |
| chat + reconnect share same token counter | PASS (both call `checkTokenEndpointLimits(token, ip)` with same prefix) |

### Bugs Found

| ID | Severity | Description | Fixed? |
|----|----------|-------------|--------|
| — | — | No bugs found | — |

### Security Audit

- Rate limit logic is 100% server-side — no client-side bypass possible ✓
- No `NEXT_PUBLIC_` prefix on Upstash credentials ✓
- Token key uses raw token value — no sensitive data exposed in Redis keys beyond what's already in DB ✓
- IP extraction uses first IP from `x-forwarded-for` (standard proxy behaviour) ✓
- 429 responses contain no sensitive data ✓

### Pre-existing Regression (not caused by PROJ-12)

`src/app/api/interviews/[id]/pdf/pdf.test.ts` fails with `@react-pdf/renderer` not found. This is a pre-existing issue from PROJ-11 (the package is not installed). **PROJ-12 did not introduce this failure.**

### Test Coverage Added

**Unit tests:**
- `src/lib/ratelimit.test.ts` — 13 tests (extractIP, fail-open without env vars, limit/block/fail-open with Upstash mocked)
- `src/app/api/interview/[token]/chat/chat.test.ts` — +1 test (429 with German message + Retry-After)
- `src/app/api/interview/[token]/reconnect/reconnect.test.ts` — +1 test (429 with German message + Retry-After)
- `src/app/api/process-steps/generate/generate.test.ts` — +1 test (429 path)
- `src/app/api/use-cases/generate/generate.test.ts` — +1 test (429 path)

**E2E tests:**
- `tests/PROJ-12-rate-limiting.spec.ts` — 5 tests (chat UI toast on 429, reconnect UI toast on 429, API auth guard checks, token-not-found check)
- Note: Mobile Safari E2E skipped — WebKit browser binary not installed on this machine (pre-existing infra gap)

**Test results:** 129 unit tests pass, 5/5 E2E tests pass (Chromium)

## Deployment

**Deployed:** 2026-05-21
**Production URL:** https://meridian-app.vercel.app
**Git Tag:** v1.12.0-PROJ-12

### Env Vars Required in Vercel
- `UPSTASH_REDIS_REST_URL` (server-only)
- `UPSTASH_REDIS_REST_TOKEN` (server-only)


## Post-Mortem
| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | — |
| Appetite vs. tatsächlich | geschätzt: — / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — |
| Häufigste Fehlerkategorie im Loop | — |

_ohne Backfill, vor v2-Migration deployed_
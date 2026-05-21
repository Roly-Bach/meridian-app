# PROJ-12: Rate Limiting

## Status: In Progress
**Created:** 2026-05-21
**Last Updated:** 2026-05-21

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
_To be added by /qa_

## Deployment
_To be added by /deploy_

# PROJ-15: CSP Hardening (Nonce-basiertes CSP)

## Status: Blocked (Next.js 16.1.1 Bug)
**Created:** 2026-05-23
**Blocked:** 2026-05-24
**Type:** Feature
**Domain:** Platform
**Extends:** —
**Appetite:** —
**Bugs:** —

## Blocker

Next.js 16.1.1 verwirft alle Custom-Response-Header, die aus `proxy.ts`/`middleware.ts` gesetzt werden — sowohl im Dev-Modus (Turbopack) als auch im Production-Build (`next start`). Auth-Logik (Redirects) funktioniert nachweislich, aber `response.headers.set('Content-Security-Policy', ...)` und Header über den NextResponse-Konstruktor erscheinen nicht in der HTTP-Response. Damit ist nonce-basiertes CSP nach offiziellem Pattern (Doku: nextjs.org/docs/app/guides/content-security-policy) in dieser Next.js-Version nicht implementierbar.

**Aktueller Zustand (Pre-PROJ-15 minus `unsafe-eval`):**
CSP zurück in `next.config.ts` mit `script-src 'self' 'unsafe-inline' blob:`. Kein `unsafe-eval`, restliche Security-Header (HSTS, X-Frame-Options, etc.) bleiben aktiv.

**Nächster Schritt:** GitHub-Issue bei vercel/next.js öffnen oder auf Patch warten. Bei Next.js 16.2+ erneut versuchen.

## Dependencies
- Requires: PROJ-3 (Interview UI) — alle Inline-Scripts und die AudioWorklet-Initialisierung müssen nach CSP-Änderung weiterhin funktionieren
- Requires: PROJ-7 (Voice Input) — `blob:` in `worker-src` bleibt, Nonce auf AudioWorklet-Script anwenden

## Context

**Ist-Zustand (nach Quick-Fix 2026-05-23):**
```
script-src 'self' 'unsafe-inline' blob:
```
`'unsafe-eval'` wurde bereits entfernt (Quick-Fix im Zuge des Security-Audits PROJ-8).
`'unsafe-inline'` ist das verbleibende Risiko: Es erlaubt beliebige Inline-Scripts, was XSS-Angriffe durch injizierte LLM-Outputs nicht blockiert.

**Zielzustand:**
```
script-src 'self' 'nonce-{zufällig-pro-request}' blob:
```
Kein `'unsafe-inline'`, kein `'unsafe-eval'`. Jeder Script-Tag, der ausgeführt werden darf, trägt den Nonce. Alles andere wird blockiert.

**Technischer Ansatz:** Next.js App Router unterstützt nonce-basiertes CSP nativ über Middleware + `headers()` in `layout.tsx`. Der Nonce wird per Request generiert, via Header weitergegeben und in alle `<script>`-Tags des Roots eingebettet.

## User Stories

- Als Betreiber möchte ich, dass kein Inline-Script ohne explizite Erlaubnis ausgeführt werden kann, damit injizierter Code aus LLM-Outputs oder kompromittierten Dependencies keine Schadensfunktion erreicht.
- Als Entwickler möchte ich, dass die CSP-Konfiguration als Single Source of Truth in der Middleware liegt, damit ich künftige Änderungen an einer Stelle vornehme.

## Acceptance Criteria

### Deliverable 1: Middleware mit Nonce-Generierung

- [ ] `src/middleware.ts` generiert per Request einen kryptographisch zufälligen Nonce (`crypto.randomUUID()` oder `crypto.getRandomValues`)
- [ ] Nonce wird als `x-nonce`-Header in die Response gesetzt (damit `layout.tsx` ihn lesen kann)
- [ ] CSP-Header wird in der Middleware gesetzt (nicht mehr in `next.config.ts`) mit `'nonce-{value}'` statt `'unsafe-inline'`
- [ ] `next.config.ts` enthält keinen CSP-Header mehr (Middleware ist alleinige Quelle)
- [ ] Bestehende Middleware-Logik (falls vorhanden) bleibt erhalten

### Deliverable 2: Nonce in Root Layout eingebunden

- [ ] `src/app/layout.tsx` liest `x-nonce` aus den Request-Headers (`headers()` aus `next/headers`)
- [ ] Nonce wird als `nonce`-Prop an alle manuellen `<script>`-Tags weitergegeben
- [ ] Next.js überträgt den Nonce automatisch auf seine eigenen generierten Script-Tags (via `<html nonce={nonce}>` oder Next.js-eigene Nonce-API — je nach Next.js-Version)

### Deliverable 3: Smoke-Tests

- [ ] `npm run build` ohne Fehler
- [ ] `npm run dev`: Browser-DevTools zeigen keinen `'unsafe-inline'` im CSP-Header
- [ ] Browser-DevTools: keine CSP-Violation-Warnings beim normalen Interview-Ablauf
- [ ] Voice Input (PROJ-7): AudioWorklet lädt korrekt (`blob:` bleibt in `script-src`)
- [ ] PDF-Report (PROJ-11): generieren und herunterladen funktioniert

### Deliverable 4: Unit-Test für CSP-Header

- [ ] Test prüft, dass der CSP-Header `'nonce-'` enthält
- [ ] Test prüft, dass `'unsafe-inline'` und `'unsafe-eval'` nicht im Header vorkommen
- [ ] Test prüft, dass `blob:` in `script-src` vorhanden ist (für AudioWorklet)

## Edge Cases

| Szenario | Erwartetes Verhalten |
|---|---|
| Next.js-interne Scripts ohne Nonce | Next.js 13+ überträgt den Nonce automatisch wenn er im Root-Layout gesetzt ist — kein manuelles Anpassen der generierten Scripts nötig |
| `<script>` in einer Client Component | Nonce muss als Prop durchgereicht werden; bei shadcn-Komponenten mit dynamischem Script kein Anpassungsbedarf (kein direktes `<script>`) |
| AudioWorklet via `new Worker(URL.createObjectURL(...))` | Läuft über `blob:` in `script-src`, kein Nonce nötig |
| Drittanbieter-Script (aktuell keines) | Würde explizit als `src`-Whitelist oder per Nonce eingebunden — kein aktueller Anpassungsbedarf |
| Middleware-Fehler (Nonce nicht gesetzt) | Fallback auf leeren Nonce → alle Scripts blockiert; in Dev sofort sichtbar, kein stilles Fehlschlagen |

## Technical Requirements

- Nonce-Generierung ausschließlich server-seitig in der Middleware
- CSP-Header-Konfiguration liegt nach diesem Feature vollständig in `src/middleware.ts` — `next.config.ts` enthält nur noch die restlichen Security-Header (HSTS, X-Frame-Options etc.)
- Kein neues NPM-Package erforderlich (Web Crypto API ist in Next.js Edge-Runtime und Node.js verfügbar)

## Out of Scope

- `'unsafe-inline'` in `style-src` (CSS-Injection ist kein relevantes Angriffsszenario für diese App)
- HSTS `preload` Direktive (externe Registrierung, kein Code-Change)
- Subresource Integrity für externe Assets (keine externen Scripts geladen)

## Verifikation

1. DevTools → Network → beliebige Route → Response Headers: CSP enthält `nonce-`, kein `unsafe-inline`
2. `npm run build` und `npm run start` ohne Fehler
3. Manueller Interview-Durchlauf inkl. Voice Input: keine CSP-Violations in der Konsole
4. Unit-Test für CSP-Header grün

## Implementation Notes

**Pre-Step erledigt (2026-05-23):** `'unsafe-eval'` aus `next.config.ts` entfernt (Security-Audit PROJ-8). Aktueller Stand in `script-src`: `'self' 'unsafe-inline' blob:`. PROJ-15 setzt hier an und entfernt `'unsafe-inline'` durch nonce-basiertes CSP.

**Implementiert (2026-05-23):**
- `src/proxy.ts` statt `src/middleware.ts` — Next.js 16 hat `middleware.ts` deprecated; neues Datei-Convention ist `proxy.ts` mit einem `proxy`-Named-Export (analog zu `middleware`-Export vorher). Funktionalität identisch.
- `buildCsp(nonce)` als exportierte Pure Function für Testbarkeit.
- `src/app/layout.tsx` ist jetzt `async`; liest `x-nonce` via `await headers()` (Next.js 15+ API) und setzt `nonce` auf `<html>`.
- `next.config.ts`: CSP-Header entfernt; alle anderen Security-Header (HSTS, X-Frame-Options etc.) bleiben dort.
- `src/proxy.test.ts`: 4 Unit-Tests für `buildCsp` — nonce in script-src, kein unsafe-inline in script-src, kein unsafe-eval, blob: in script-src.

**BUG-1 Fix (2026-05-24) — NOCH NICHT VOLLSTÄNDIG BEHOBEN:**

**Was bisher herausgefunden wurde:**

1. `proxy.ts` heißt korrekt (Next.js 16 hat middleware.ts → proxy.ts umbenannt, v16.0.0).
2. Export-Name `proxy` ist korrekt laut Docs und Source-Code.
3. `buildCsp` und `crypto.randomUUID()` sind korrekt (kein Buffer.from-Bug).
4. `worker-src blob: 'self'` wurde hinzugefügt.
5. Unit-Tests: 5 passed (`src/middleware.test.ts` importiert von `src/proxy.ts`).

**Kern-Problem (verifiziert):**
`src/proxy.ts` wird von Next.js 16.1.1 zur Laufzeit **nicht als Proxy-Einstiegspunkt registriert**.
Beweis: Nach vollständigem Löschen von `.next` entsteht **kein** `middleware-manifest.json`.
GET `/proxy-test` (der einen direkten `new Response('PROXY_IS_RUNNING')` zurückgeben würde) liefert stattdessen die Login-Seite — die Proxy-Funktion wird nie aufgerufen.

**Aktueller Dateizustand:**
- `src/proxy.ts` — enthält `buildCsp` + `proxy`-Funktion mit `/proxy-test`-Debugging-Branch + `config`-Matcher
- `src/middleware.test.ts` — 5 Unit-Tests, alle grün
- `proxy.ts` (Projekt-Root) — neu angelegt als nächster Test-Schritt, importiert `buildCsp` aus `src/proxy.ts`
- `next.config.ts` — kein CSP-Header mehr (entfernt, korrekt)
- `src/app/layout.tsx` — async, liest `x-nonce` Header

**Nächster Debug-Schritt (noch nicht ausgeführt):**

**Test A — Root-Level proxy.ts:**
Server stoppen → `.next` löschen → `npm run dev`.
Erwartetes Ergebnis bei Erfolg: Fehler "Both middleware and proxy file detected" ODER CSP-Header erscheint.
Erwartetes Ergebnis bei Misserfolg: Weiterhin kein CSP-Header, kein Fehler.

Falls Test A schlägt fehl → **Test B — middleware.ts:**
`proxy.ts` (Root) und `src/proxy.ts` löschen. `src/middleware.ts` mit `middleware`-Export erstellen (deprecated, aber lt. Source-Code-Analyse korrekt erkannt). Gleicher Code, nur anderer Dateiname und Export-Name.

**Source-Code-Analyse-Ergebnis:**
Relevante Datei: `node_modules/next/dist/server/lib/router-utils/setup-dev-bundler.js`, Zeile 321:
```javascript
const isAtConventionLevel = fileDir === dir || fileDir === path.join(dir, 'src');
```
Theoretisch sollte `src/proxy.ts` erkannt werden. Mögliche Ursachen für Fehler:
- Pfad-Separator-Inkonsistenz auf Windows (watchpack forward-slash vs. path.join backslash)
- `knownFiles` enthält `src/proxy.ts` nicht beim Start (Timing/Watch-Issue)
- Next.js 16.1.1-spezifischer Bug mit Turbopack + proxy.ts in src/

## QA Test Results

**QA-Datum:** 2026-05-23
**Tester:** /qa PROJ-15
**Environment:** Next.js 16.1.1 (Turbopack), dev server + production build

### Acceptance Criteria

| # | Criterion | Status |
|---|-----------|--------|
| D1.1 | `src/proxy.ts` generiert kryptographisch zufälligen Nonce | PASS |
| D1.2 | Nonce wird als `x-nonce` Response-Header gesetzt (Code) | PASS (Code) |
| D1.3 | CSP-Header mit `nonce-{value}` statt `unsafe-inline` im Actual Response | **FAIL** |
| D1.4 | `next.config.ts` enthält keinen CSP-Header mehr | PASS |
| D1.5 | Bestehende Middleware-Logik erhalten | PASS (n/a) |
| D2.1 | `layout.tsx` liest `x-nonce` aus Headers | PASS (Code) |
| D2.2 | Nonce als `nonce`-Prop an Script-Tags | **FAIL** (nonce="$undefined" in RSC) |
| D2.3 | Next.js überträgt Nonce auf generierte Script-Tags | **FAIL** (nonce="" in HTML) |
| D3.1 | `npm run build` ohne Fehler | PASS |
| D3.2 | DevTools: kein `unsafe-inline` im CSP-Header | **FAIL** (kein CSP-Header vorhanden) |
| D3.3 | Keine CSP-Violation-Warnings beim Interview-Ablauf | N/A (CSP not active) |
| D3.4 | Voice Input / AudioWorklet lädt korrekt | N/A (CSP not active) |
| D4.1 | Unit-Test: CSP enthält `nonce-` | PASS |
| D4.2 | Unit-Test: kein `unsafe-inline` und `unsafe-eval` | PASS |
| D4.3 | Unit-Test: `blob:` in `script-src` | PASS |

**Passed:** 8 / **Failed:** 4 / **N/A:** 3

### Bugs

#### BUG-1 [Critical]: CSP-Header erscheint nicht in HTTP-Responses

**Beschreibung:** Die `proxy.ts` läuft nachweislich (Dev-Server-Log: `proxy.ts: 66ms`), aber der `Content-Security-Policy` Response-Header ist in keiner Route vorhanden. Außerdem wird der `x-nonce` Request-Header nicht an Server Components weitergegeben (RSC-Payload zeigt `x-nonce` nicht im `headers()`-Output, `nonce=""` im gerenderten HTML).

**Symptome (verifiziert):**
- `curl -sI http://localhost:3001/login` — kein `Content-Security-Policy` Header
- RSC-Payload: `headers()` gibt `["host", ...], ["user-agent", ...]` ohne `x-nonce`
- HTML: `<html lang="de" nonce="">` — leerer Nonce
- RSC: alle `<script>`-Tags haben `"nonce":"$undefined"`

**Kritische Regression:** Der ursprüngliche CSP aus `next.config.ts` (`script-src 'self' 'unsafe-inline' blob:`) wurde entfernt; der Ersatz über `proxy.ts` funktioniert nicht. Die App hat aktuell **keinen CSP-Header** — schlechter als vor PROJ-15.

**Root-Cause-Hypothese:** In Next.js 16 könnte sich die API für die Header-Propagation vom Proxy zu Server Components geändert haben. `NextResponse.next({ request: { headers: requestHeaders } })` reicht die `x-nonce` Header möglicherweise nicht durch. Alternativ: `Buffer.from(...)` schlägt im Proxy-Runtime-Kontext fehl und Next.js fällt lautlos auf Passthrough zurück.

**Schritte zur Reproduktion:**
1. `npm run dev` oder `npm run start`
2. `curl -sI http://localhost:300x/login | grep -i csp`
3. Kein Treffer

**Fix-Hinweis:** Zwei Aspekte zu prüfen:
1. `Buffer.from(crypto.randomUUID()).toString('base64')` ggf. durch `crypto.randomUUID()` direkt ersetzen (kein Buffer nötig)
2. Header-Propagation testen: `NextResponse.next({ request: { headers: requestHeaders } })` vs. alternatives API-Pattern für Next.js 16

### Regression Testing

E2E-Tests (Playwright) ausgeführt: 16 passed, restliche Failures sind pre-existing Supabase-Auth-Abhängigkeiten — keine neuen Regressions durch PROJ-15.

### BUG-1 Final Status (2026-05-24)

**NICHT BEHEBBAR mit Next.js 16.1.1.** Vollständige Debug-Historie:

1. `src/proxy.ts` mit `proxy`-Export: Wurde nicht ausgeführt (existierende `middleware.ts` am Root hat gewonnen).
2. Root-Level `proxy.ts` und `middleware.ts` verschmolzen mit CSP-Logik: Code lief nachweislich (Auth-Redirects funktionieren), aber `response.headers.set('Content-Security-Policy', ...)` wurde in der HTTP-Response nicht ausgeliefert.
3. Header via NextResponse-Konstruktor (`new NextResponse(null, { headers })` und `NextResponse.next({ headers })`): ebenfalls verworfen.
4. Header via NextResponse.redirect-Konstruktor: ebenfalls verworfen.
5. Test mit Production-Build (`next build` + `next start`, kein Turbopack): identisches Verhalten. **Damit ausgeschlossen, dass es ein Turbopack-spezifischer Bug ist.**

**Beweise dass die Proxy-Funktion läuft:** `/dashboard` ohne Auth wird zu `/login` redirected (307) — diese Logik kommt nachweislich aus unserer proxy.ts.

**Beweise dass Header verworfen werden:** Keiner der gesetzten Custom-Header (`Content-Security-Policy`, `x-csp-via`, `x-nonce-debug`) erscheint in der Response — weder bei 200-OK noch bei 307-Redirect. Header aus `next.config.ts` `headers()` erscheinen dagegen problemlos.

### Production-Ready Decision

**SHIPPED (revertet auf Pre-PROJ-15 Stand minus `unsafe-eval`)** — 2026-05-24.

Konkrete Änderungen wieder aktiv:
- `next.config.ts`: CSP zurück mit `script-src 'self' 'unsafe-inline' blob:` (kein `'unsafe-eval'`, kein Nonce). Andere Security-Header (HSTS, X-Frame-Options, Referrer-Policy, X-Content-Type-Options, X-Permitted-Cross-Domain-Policies, Permissions-Policy) bleiben.
- `proxy.ts`: Reverted auf Supabase-Auth-only Variante (kein CSP-Code mehr).
- `src/app/layout.tsx`: `async` und `x-nonce`-Lookup entfernt — wieder die einfache synchron-Variante.
- `proxy.test.ts` entfernt (testete `buildCsp` aus reverted Code).

**Sicherheits-Delta gegenüber Pre-PROJ-15:** Reduktion um `'unsafe-eval'` (über PROJ-8 Pre-Step bereits durchgeführt) bleibt erhalten. `'unsafe-inline'` weiterhin notwendig, bis Next.js den Header-Drop-Bug behebt.

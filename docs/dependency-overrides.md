# Dependency Overrides

> Begründung für jeden Eintrag in `package.json` → `overrides`. Bei jedem `npm install` neu prüfen, ob der Parent inzwischen selbst eine sichere Version zieht — dann Override entfernen (siehe PROJ-16).

| Package | Override | CVE/Anlass | Welcher Parent zieht die alte Version | Wann entbehrlich |
|---|---|---|---|---|
| `ajv` | `^6.14.0` | npm audit Finding, 2026-05-23 | `eslint@9.39.2` deklariert `ajv@^6.12.4` | Wenn ESLint selbst auf ajv v8 migriert |
| `minimatch` | `^9.0.7` | npm audit Finding (alte minimatch-Versionen, ReDoS-Klasse) | `eslint@9.39.2` deklariert `minimatch@^3.1.2` direkt | Wenn ESLint selbst minimatch v9+ deklariert |
| `picomatch` | `^4.0.4` | npm audit Finding | `chokidar`/`micromatch` (über `tailwindcss`) ziehen ältere Ranges | Wenn tailwindcss v4 (zieht modernere chokidar-Kette) zum Standard wird |
| `postcss` | `^8.5.10` | npm audit Finding | `tailwindcss@3.4.19` deklariert `postcss@^8.4.47` | Wenn tailwindcss selbst `^8.5.10`+ deklariert |
| `vite` | `^8.0.16` | GHSA-v6wh-96g9-6wx3 (launch-editor NTLMv2), GHSA-fx2h-pf6j-xcff (`server.fs.deny` bypass) — beide bis 8.0.15 verwundbar | `@vitejs/plugin-react@6.0.1` deklariert `vite@^8.0.0` (deckt verwundbaren Bereich ab) | Wenn plugin-react selbst `^8.0.16`+ als Floor deklariert |

## Entfernt (2026-06-22, PROJ-16)

- **`brace-expansion`** (`^2.0.3`): `minimatch@9.0.9` deklariert bereits selbst `brace-expansion@^2.0.2` — npm resolved ohne Override auf `2.1.0` (deduped, einzige Version im Tree). Override war redundant geworden, sobald der `minimatch`-Bump auf v9 durchgesetzt war.

## Nicht-Override-Fix (2026-06-22, PROJ-16)

- **`@opentelemetry/sdk-node`**: direkter Dependency-Bump `^0.218.0` → `^0.219.0` (kein Override, da direkte Dependency in `package.json`). Löste 24 verbleibende Moderate-Vulns in der gesamten `@opentelemetry/*`-Kette. Peer-Deps von `@langfuse/otel@5.4.0` vorher gegen beide Versionen geprüft (kompatibel).

## Routine

Quartalsweise (oder bei jedem `npm audit`-Fund): `npm ls <package>` für jeden Override-Eintrag prüfen, ob noch mehr als eine Version im Tree liegt bzw. ob der Parent jetzt direkt eine sichere Range deklariert.
